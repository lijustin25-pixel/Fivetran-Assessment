import {
  CHAT_STORAGE_KEY,
  createInitialChatState,
  createEmptySession,
  isChatMessage,
  isChatSession,
  LEGACY_CHAT_STORAGE_KEY,
  titleFromMessages,
  type ChatMessage,
  type ChatState,
} from '../domain/chat'

function migrateLegacyMessages(messages: ChatMessage[]): ChatState {
  const now = Date.now()
  if (messages.length === 0) {
    return createInitialChatState(now)
  }

  const session = {
    ...createEmptySession(now),
    title: titleFromMessages(messages),
    messages,
    updatedAt: now,
  }

  return {
    sessions: [session],
    activeSessionId: session.id,
  }
}

function parseChatState(parsed: unknown): ChatState | null {
  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const value = parsed as Record<string, unknown>
  if (
    typeof value.activeSessionId !== 'string' ||
    !Array.isArray(value.sessions)
  ) {
    return null
  }

  const sessions = value.sessions.filter(isChatSession)
  if (sessions.length === 0) {
    return null
  }

  const activeSessionId = sessions.some(
    (session) => session.id === value.activeSessionId,
  )
    ? value.activeSessionId
    : sessions[0]!.id

  return { sessions, activeSessionId }
}

export function loadChatState(storage: Storage = localStorage): ChatState {
  try {
    const raw = storage.getItem(CHAT_STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      const state = parseChatState(parsed)
      if (state) {
        return state
      }
    }

    const legacyRaw = storage.getItem(LEGACY_CHAT_STORAGE_KEY)
    if (legacyRaw) {
      const legacyParsed: unknown = JSON.parse(legacyRaw)
      if (Array.isArray(legacyParsed)) {
        const messages = legacyParsed.filter(isChatMessage)
        const migrated = migrateLegacyMessages(messages)
        saveChatState(migrated, storage)
        storage.removeItem(LEGACY_CHAT_STORAGE_KEY)
        return migrated
      }
    }

    return createInitialChatState()
  } catch {
    return createInitialChatState()
  }
}

export function saveChatState(
  state: ChatState,
  storage: Storage = localStorage,
): void {
  try {
    storage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // QuotaExceededError / private mode — keep the in-memory session usable.
  }
}
