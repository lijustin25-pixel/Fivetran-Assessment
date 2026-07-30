export const CHAT_STORAGE_KEY = 'fivetran-chat-sessions'
export const LEGACY_CHAT_STORAGE_KEY = 'fivetran-chat-history'

export const EMPTY_PROMPT_ERROR = 'Please enter a message before submitting.'
export const DEFAULT_CHAT_TITLE = 'New chat'

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

export interface ApiChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}

export interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string
}

export interface ChatHistoryEntry {
  id: string
  title: string
}

export function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') {
    return false
  }

  const message = value as Record<string, unknown>
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' ||
      message.role === 'assistant' ||
      message.role === 'system') &&
    typeof message.content === 'string' &&
    typeof message.createdAt === 'number'
  )
}

export function isChatSession(value: unknown): value is ChatSession {
  if (!value || typeof value !== 'object') {
    return false
  }

  const session = value as Record<string, unknown>
  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    typeof session.updatedAt === 'number' &&
    Array.isArray(session.messages) &&
    session.messages.every(isChatMessage)
  )
}

export function createChatMessage(
  role: ChatRole,
  content: string,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
  }
}

export function createEmptySession(now = Date.now()): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: DEFAULT_CHAT_TITLE,
    messages: [],
    updatedAt: now,
  }
}

export function createInitialChatState(now = Date.now()): ChatState {
  const session = createEmptySession(now)
  return {
    sessions: [session],
    activeSessionId: session.id,
  }
}

export function titleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((message) => message.role === 'user')
  if (!firstUser) {
    return DEFAULT_CHAT_TITLE
  }
  return truncateText(firstUser.content, 48)
}

export function getActiveSession(state: ChatState): ChatSession {
  return (
    state.sessions.find((session) => session.id === state.activeSessionId) ??
    state.sessions[0] ??
    createEmptySession()
  )
}

export function sortSessions(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function toHistoryEntries(state: ChatState): ChatHistoryEntry[] {
  return sortSessions(state.sessions).map((session) => ({
    id: session.id,
    title: session.title,
  }))
}

export function getSession(
  state: ChatState,
  sessionId: string,
): ChatSession | undefined {
  return state.sessions.find((session) => session.id === sessionId)
}

/** Update messages for a specific session (safe if the session was deleted). */
export function updateSessionMessages(
  state: ChatState,
  sessionId: string,
  messages: ChatMessage[],
  now = Date.now(),
): ChatState {
  if (!state.sessions.some((session) => session.id === sessionId)) {
    return state
  }

  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            messages,
            title: titleFromMessages(messages),
            updatedAt: now,
          }
        : session,
    ),
  }
}

export function updateActiveMessages(
  state: ChatState,
  messages: ChatMessage[],
  now = Date.now(),
): ChatState {
  return updateSessionMessages(state, state.activeSessionId, messages, now)
}

export function appendMessageDelta(
  state: ChatState,
  sessionId: string,
  messageId: string,
  delta: string,
): ChatState {
  const session = getSession(state, sessionId)
  if (!session) {
    return state
  }

  const messages = session.messages.map((message) =>
    message.id === messageId
      ? { ...message, content: message.content + delta }
      : message,
  )
  return updateSessionMessages(state, sessionId, messages)
}

export function removeSessionMessage(
  state: ChatState,
  sessionId: string,
  messageId: string,
): ChatState {
  const session = getSession(state, sessionId)
  if (!session) {
    return state
  }

  return updateSessionMessages(
    state,
    sessionId,
    session.messages.filter((message) => message.id !== messageId),
  )
}

/** Start a fresh chat. No-ops when the active chat is already empty. */
export function startNewChat(state: ChatState, now = Date.now()): ChatState {
  const active = getActiveSession(state)
  if (active.messages.length === 0) {
    return {
      ...state,
      activeSessionId: active.id,
    }
  }

  const session = createEmptySession(now)
  return {
    sessions: [session, ...state.sessions],
    activeSessionId: session.id,
  }
}

export function selectSession(state: ChatState, sessionId: string): ChatState {
  if (!state.sessions.some((session) => session.id === sessionId)) {
    return state
  }
  return {
    ...state,
    activeSessionId: sessionId,
  }
}

/** Wipe messages in the active chat but keep the session. */
export function clearActiveChatMessages(
  state: ChatState,
  now = Date.now(),
): ChatState {
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === state.activeSessionId
        ? {
            ...session,
            title: DEFAULT_CHAT_TITLE,
            messages: [],
            updatedAt: now,
          }
        : session,
    ),
  }
}

/** Remove a chat session. Always leaves at least one empty session. */
export function deleteChat(
  state: ChatState,
  sessionId: string,
  now = Date.now(),
): ChatState {
  const remaining = state.sessions.filter((session) => session.id !== sessionId)

  if (remaining.length === 0) {
    return createInitialChatState(now)
  }

  const nextActiveId =
    state.activeSessionId === sessionId
      ? sortSessions(remaining)[0]!.id
      : state.activeSessionId

  return {
    sessions: remaining,
    activeSessionId: nextActiveId,
  }
}

export function toApiMessages(messages: ChatMessage[]): ApiChatMessage[] {
  return messages
    .filter((message) => message.role !== 'system')
    .filter((message) => message.content.trim().length > 0)
    .map(({ role, content }) => ({
      role: role as 'user' | 'assistant',
      content,
    }))
}

export function normalizePrompt(prompt: string): string {
  return prompt.trim()
}

export function truncateText(value: string, maxLength = 80): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 1)}…`
}
