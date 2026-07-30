import { beforeEach, describe, expect, it } from 'vitest'
import {
  CHAT_STORAGE_KEY,
  createInitialChatState,
  LEGACY_CHAT_STORAGE_KEY,
  type ChatMessage,
} from '../domain/chat'
import { loadChatState, saveChatState } from './chatStorage'

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
  }
}

const sampleMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'Hello',
    createdAt: 1,
  },
  {
    id: '2',
    role: 'assistant',
    content: 'Hi there',
    createdAt: 2,
  },
]

describe('chatStorage', () => {
  let storage: Storage

  beforeEach(() => {
    storage = createMemoryStorage()
  })

  it('returns an initial empty session when nothing is stored', () => {
    const state = loadChatState(storage)
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0]?.messages).toEqual([])
  })

  it('saves and loads chat state', () => {
    const state = createInitialChatState(1)
    state.sessions[0] = {
      ...state.sessions[0]!,
      title: 'Hello',
      messages: sampleMessages,
      updatedAt: 2,
    }

    saveChatState(state, storage)
    expect(loadChatState(storage)).toEqual(state)
    expect(storage.getItem(CHAT_STORAGE_KEY)).toContain('Hello')
  })

  it('migrates legacy message arrays into a session', () => {
    storage.setItem(LEGACY_CHAT_STORAGE_KEY, JSON.stringify(sampleMessages))

    const state = loadChatState(storage)
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0]?.messages).toEqual(sampleMessages)
    expect(storage.getItem(LEGACY_CHAT_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(CHAT_STORAGE_KEY)).toBeTruthy()
  })

  it('returns an initial session for corrupt JSON', () => {
    storage.setItem(CHAT_STORAGE_KEY, '{not-json')
    const state = loadChatState(storage)
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0]?.messages).toEqual([])
  })

  it('swallows storage write failures', () => {
    const failing: Storage = {
      ...storage,
      setItem() {
        throw new Error('QuotaExceededError')
      },
    }
    expect(() => saveChatState(createInitialChatState(1), failing)).not.toThrow()
  })
})
