import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  appendMessageDelta,
  clearActiveChatMessages,
  createChatMessage,
  deleteChat,
  EMPTY_PROMPT_ERROR,
  getActiveSession,
  getSession,
  normalizePrompt,
  removeSessionMessage,
  selectSession,
  startNewChat,
  toApiMessages,
  toHistoryEntries,
  updateSessionMessages,
  type ChatState,
} from '../domain/chat'
import { streamChatCompletion } from '../infrastructure/chatGateway'
import { loadChatState, saveChatState } from '../infrastructure/chatStorage'
import { toUserFacingError } from '../infrastructure/openaiErrors'

function getMessageContent(
  state: ChatState,
  sessionId: string,
  messageId: string,
): string | undefined {
  return getSession(state, sessionId)?.messages.find(
    (message) => message.id === messageId,
  )?.content
}

export function useChat() {
  const [chatState, setChatState] = useState<ChatState>(() => loadChatState())
  const [isLoading, setIsLoading] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const chatStateRef = useRef(chatState)
  chatStateRef.current = chatState

  const abortRef = useRef<AbortController | null>(null)
  const streamingSessionIdRef = useRef<string | null>(null)

  const activeSession = useMemo(
    () => getActiveSession(chatState),
    [chatState],
  )
  const messages = activeSession.messages

  const abortInFlight = useCallback(() => {
    const controller = abortRef.current
    if (!controller) {
      return
    }
    controller.abort()
    abortRef.current = null
    streamingSessionIdRef.current = null
    setIsLoading(false)
    setStreamingMessageId(null)
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
      streamingSessionIdRef.current = null
    }
  }, [])

  useEffect(() => {
    if (streamingMessageId) {
      return
    }
    saveChatState(chatState)
  }, [chatState, streamingMessageId])

  const dismissError = useCallback(() => {
    setError(null)
  }, [])

  const startNewChatAction = useCallback(() => {
    setChatState((current) => startNewChat(current))
    setError(null)
  }, [])

  const selectSessionAction = useCallback((sessionId: string) => {
    setChatState((current) => selectSession(current, sessionId))
    setError(null)
  }, [])

  const clearChat = useCallback(() => {
    if (
      streamingSessionIdRef.current === chatStateRef.current.activeSessionId
    ) {
      abortInFlight()
    }
    setChatState((current) => clearActiveChatMessages(current))
    setError(null)
  }, [abortInFlight])

  const deleteChatAction = useCallback(
    (sessionId: string) => {
      if (streamingSessionIdRef.current === sessionId) {
        abortInFlight()
      }
      setChatState((current) => deleteChat(current, sessionId))
      setError(null)
    },
    [abortInFlight],
  )

  const stopGenerating = useCallback(() => {
    abortInFlight()
  }, [abortInFlight])

  const sendMessage = useCallback(async (prompt: string) => {
    const trimmed = normalizePrompt(prompt)
    if (!trimmed) {
      setError(EMPTY_PROMPT_ERROR)
      return
    }

    if (abortRef.current) {
      return
    }

    const active = getActiveSession(chatStateRef.current)
    const sessionId = active.id
    const userMessage = createChatMessage('user', trimmed)
    const assistantMessage = createChatMessage('assistant', '')
    const historyForApi = toApiMessages([...active.messages, userMessage])

    setChatState((current) => {
      const session = getSession(current, sessionId)
      if (!session) {
        return current
      }
      if (session.messages.some((message) => message.id === userMessage.id)) {
        return current
      }
      return updateSessionMessages(current, sessionId, [
        ...session.messages,
        userMessage,
        assistantMessage,
      ])
    })

    const controller = new AbortController()
    abortRef.current = controller
    streamingSessionIdRef.current = sessionId
    setStreamingMessageId(assistantMessage.id)
    setError(null)
    setIsLoading(true)

    try {
      await streamChatCompletion(historyForApi, {
        signal: controller.signal,
        onDelta: (delta) => {
          setChatState((current) =>
            appendMessageDelta(current, sessionId, assistantMessage.id, delta),
          )
        },
      })
    } catch (err) {
      setChatState((current) => {
        const streamed = getMessageContent(
          current,
          sessionId,
          assistantMessage.id,
        )
        if (!streamed?.trim()) {
          return removeSessionMessage(current, sessionId, assistantMessage.id)
        }
        return current
      })

      if (controller.signal.aborted) {
        return
      }

      setError(toUserFacingError(err))
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        streamingSessionIdRef.current = null
        setIsLoading(false)
        setStreamingMessageId(null)
      }
    }
  }, [])

  return {
    messages,
    isLoading,
    streamingMessageId,
    error,
    activeSessionId: chatState.activeSessionId,
    historyEntries: toHistoryEntries(chatState),
    actions: {
      sendMessage,
      stopGenerating,
      startNewChat: startNewChatAction,
      selectSession: selectSessionAction,
      clearChat,
      deleteChat: deleteChatAction,
      dismissError,
    },
  }
}
