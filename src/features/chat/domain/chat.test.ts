import { describe, expect, it } from 'vitest'
import {
  appendMessageDelta,
  clearActiveChatMessages,
  createEmptySession,
  createInitialChatState,
  deleteChat,
  removeSessionMessage,
  startNewChat,
  titleFromMessages,
  toApiMessages,
  toHistoryEntries,
  truncateText,
  updateActiveMessages,
  updateSessionMessages,
  type ChatMessage,
  type ChatState,
} from './chat'

const messages: ChatMessage[] = [
  {
    id: 'u1',
    role: 'user',
    content: 'What is TypeScript?',
    createdAt: 1,
  },
  {
    id: 'a1',
    role: 'assistant',
    content: 'A typed superset of JavaScript.',
    createdAt: 2,
  },
]

describe('session helpers', () => {
  it('derives title from the first user message', () => {
    expect(titleFromMessages(messages)).toBe('What is TypeScript?')
  })

  it('starts a new chat and preserves the previous session', () => {
    let state = createInitialChatState(10)
    state = updateActiveMessages(state, messages, 20)

    const next = startNewChat(state, 30)
    expect(next.sessions).toHaveLength(2)
    expect(next.activeSessionId).not.toBe(state.activeSessionId)
    expect(
      next.sessions.find((session) => session.id === next.activeSessionId)
        ?.messages,
    ).toEqual([])
    expect(
      next.sessions.find((session) => session.id === state.activeSessionId)
        ?.messages,
    ).toEqual(messages)
  })

  it('does not create a duplicate empty chat', () => {
    const state = createInitialChatState(10)
    const next = startNewChat(state, 20)
    expect(next.sessions).toHaveLength(1)
    expect(next.activeSessionId).toBe(state.activeSessionId)
  })

  it('clears messages in the active chat without deleting it', () => {
    let state = createInitialChatState(1)
    state = updateActiveMessages(state, messages, 2)
    const activeId = state.activeSessionId

    const next = clearActiveChatMessages(state, 3)
    expect(next.activeSessionId).toBe(activeId)
    expect(next.sessions).toHaveLength(1)
    expect(next.sessions[0]?.messages).toEqual([])
    expect(next.sessions[0]?.title).toBe('New chat')
  })

  it('deletes a chat and keeps another session', () => {
    const first = createEmptySession(1)
    const second = {
      ...createEmptySession(2),
      title: 'Older chat',
      messages,
      updatedAt: 2,
    }
    const state: ChatState = {
      sessions: [first, second],
      activeSessionId: first.id,
    }

    const next = deleteChat(state, first.id, 3)
    expect(next.sessions).toHaveLength(1)
    expect(next.activeSessionId).toBe(second.id)
  })

  it('lists history entries newest first', () => {
    let state = createInitialChatState(1)
    state = updateActiveMessages(state, messages, 5)
    state = startNewChat(state, 10)

    const entries = toHistoryEntries(state)
    expect(entries[0]?.title).toBe('New chat')
    expect(entries[1]?.title).toBe('What is TypeScript?')
  })
})

describe('toApiMessages', () => {
  it('drops system and empty messages', () => {
    expect(
      toApiMessages([
        ...messages,
        { id: 's1', role: 'system', content: 'hidden', createdAt: 0 },
        { id: 'a2', role: 'assistant', content: '   ', createdAt: 3 },
      ]),
    ).toEqual([
      { role: 'user', content: 'What is TypeScript?' },
      { role: 'assistant', content: 'A typed superset of JavaScript.' },
    ])
  })
})

describe('truncateText', () => {
  it('leaves short text unchanged', () => {
    expect(truncateText('Hello world', 80)).toBe('Hello world')
  })

  it('truncates long text with an ellipsis', () => {
    expect(truncateText('a'.repeat(100), 20)).toBe(`${'a'.repeat(19)}…`)
  })
})

describe('session-scoped message updates', () => {
  it('appends deltas to a specific session even when it is not active', () => {
    const first = {
      ...createEmptySession(1),
      id: 'a',
      messages,
      updatedAt: 1,
    }
    const second = {
      ...createEmptySession(2),
      id: 'b',
      title: 'Other',
      messages: [],
      updatedAt: 2,
    }
    const state: ChatState = {
      sessions: [first, second],
      activeSessionId: 'b',
    }

    const next = appendMessageDelta(state, 'a', 'a1', ' More')
    expect(next.activeSessionId).toBe('b')
    expect(next.sessions.find((session) => session.id === 'a')?.messages[1]?.content).toBe(
      'A typed superset of JavaScript. More',
    )
    expect(next.sessions.find((session) => session.id === 'b')?.messages).toEqual([])
  })

  it('no-ops append/remove when the session was deleted', () => {
    const state = createInitialChatState(1)
    expect(appendMessageDelta(state, 'missing', 'x', 'y')).toEqual(state)
    expect(removeSessionMessage(state, 'missing', 'x')).toEqual(state)
  })

  it('updates messages for an explicit session id', () => {
    const state = createInitialChatState(1)
    const sessionId = state.activeSessionId
    const next = updateSessionMessages(state, sessionId, messages, 5)
    expect(next.sessions[0]?.messages).toEqual(messages)
    expect(next.sessions[0]?.title).toBe('What is TypeScript?')
  })
})
