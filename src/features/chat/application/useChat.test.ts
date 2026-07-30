import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptySession,
  type ChatMessage,
  type ChatState,
} from '../domain/chat'
import { useChat } from './useChat'

const streamChatCompletion = vi.hoisted(() => vi.fn())
const loadChatState = vi.hoisted(() => vi.fn())
const saveChatState = vi.hoisted(() => vi.fn())

vi.mock('../infrastructure/chatGateway', () => ({
  streamChatCompletion,
}))

vi.mock('../infrastructure/chatStorage', () => ({
  loadChatState,
  saveChatState,
}))

function message(
  id: string,
  role: ChatMessage['role'],
  content: string,
): ChatMessage {
  return { id, role, content, createdAt: 1 }
}

function dualSessionState(): ChatState {
  const first = {
    ...createEmptySession(1),
    id: 'session-a',
    title: 'First',
    messages: [message('u0', 'user', 'prior')],
    updatedAt: 1,
  }
  const second = {
    ...createEmptySession(2),
    id: 'session-b',
    title: 'Second',
    messages: [message('u1', 'user', 'other')],
    updatedAt: 2,
  }
  return {
    sessions: [first, second],
    activeSessionId: 'session-a',
  }
}

function deferredStream() {
  let onDelta: ((delta: string) => void) | undefined
  let resolveStream!: (value: string) => void
  let rejectStream!: (reason?: unknown) => void
  let signal: AbortSignal | undefined

  streamChatCompletion.mockImplementation(async (_messages, options) => {
    onDelta = options?.onDelta
    signal = options?.signal
    return new Promise<string>((resolve, reject) => {
      resolveStream = resolve
      rejectStream = reject
      options?.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      )
    })
  })

  return {
    emit: (delta: string) => onDelta?.(delta),
    complete: (value: string) => resolveStream(value),
    fail: (reason: unknown) => rejectStream(reason),
    getSignal: () => signal,
  }
}

describe('useChat', () => {
  beforeEach(() => {
    loadChatState.mockReturnValue(dualSessionState())
    saveChatState.mockReset()
    streamChatCompletion.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects empty prompts without calling the gateway', async () => {
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.actions.sendMessage('   ')
    })

    expect(result.current.error).toMatch(/enter a message/i)
    expect(streamChatCompletion).not.toHaveBeenCalled()
  })

  it('keeps streaming deltas on the originating session after switching', async () => {
    const stream = deferredStream()
    const { result } = renderHook(() => useChat())

    await act(async () => {
      void result.current.actions.sendMessage('Hello')
    })

    await waitFor(() => {
      expect(streamChatCompletion).toHaveBeenCalledOnce()
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      result.current.actions.selectSession('session-b')
    })
    expect(result.current.activeSessionId).toBe('session-b')

    await act(async () => {
      stream.emit('Hello')
      stream.emit(' world')
      stream.complete('Hello world')
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.actions.selectSession('session-a')
    })

    const assistant = result.current.messages.find(
      (entry) => entry.role === 'assistant',
    )
    expect(assistant?.content).toBe('Hello world')
    expect(
      result.current.messages.some(
        (entry) => entry.role === 'user' && entry.content === 'Hello',
      ),
    ).toBe(true)
  })

  it('aborts an in-flight stream when clearing the active chat', async () => {
    const stream = deferredStream()
    const { result } = renderHook(() => useChat())

    await act(async () => {
      void result.current.actions.sendMessage('Hello')
    })

    await waitFor(() => expect(result.current.isLoading).toBe(true))

    await act(async () => {
      result.current.actions.clearChat()
    })

    await waitFor(() => {
      expect(stream.getSignal()?.aborted).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.messages).toEqual([])
      expect(result.current.error).toBeNull()
    })
  })

  it('aborts when deleting the session that owns the stream', async () => {
    const stream = deferredStream()
    const { result } = renderHook(() => useChat())

    await act(async () => {
      void result.current.actions.sendMessage('Hello')
    })

    await waitFor(() => expect(result.current.isLoading).toBe(true))

    await act(async () => {
      result.current.actions.deleteChat('session-a')
    })

    await waitFor(() => {
      expect(stream.getSignal()?.aborted).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.activeSessionId).toBe('session-b')
      expect(result.current.error).toBeNull()
    })
  })

  it('stops generating without surfacing an error and keeps partial text', async () => {
    const stream = deferredStream()
    const { result } = renderHook(() => useChat())

    await act(async () => {
      void result.current.actions.sendMessage('Hello')
    })

    await waitFor(() => expect(result.current.isLoading).toBe(true))

    await act(async () => {
      stream.emit('Partial')
      result.current.actions.stopGenerating()
    })

    await waitFor(() => {
      expect(stream.getSignal()?.aborted).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(
        result.current.messages.find((entry) => entry.role === 'assistant')
          ?.content,
      ).toBe('Partial')
    })
  })

  it('removes an empty assistant placeholder when stopped before tokens', async () => {
    deferredStream()
    const { result } = renderHook(() => useChat())

    await act(async () => {
      void result.current.actions.sendMessage('Hello')
    })

    await waitFor(() => expect(result.current.isLoading).toBe(true))

    await act(async () => {
      result.current.actions.stopGenerating()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(
        result.current.messages.some((entry) => entry.role === 'assistant'),
      ).toBe(false)
      expect(result.current.messages.at(-1)?.content).toBe('Hello')
    })
  })

  it('surfaces gateway errors and removes empty assistant placeholders', async () => {
    streamChatCompletion.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.actions.sendMessage('Hello')
    })

    await waitFor(() => {
      expect(result.current.error).toMatch(/boom/i)
      expect(
        result.current.messages.some((entry) => entry.role === 'assistant'),
      ).toBe(false)
      expect(result.current.messages.at(-1)?.content).toBe('Hello')
    })
  })
})
