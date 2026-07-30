import {
  truncateText,
  type ChatHistoryEntry,
} from '../../domain/chat'
import { ComposeIcon, SparkIcon, TrashIcon } from './icons'

interface HistorySidebarProps {
  entries: ChatHistoryEntry[]
  activeSessionId: string
  onSelect: (sessionId: string) => void
  onNewChat: () => void
  onDeleteChat: (sessionId: string) => void
}

export function HistorySidebar({
  entries,
  activeSessionId,
  onSelect,
  onNewChat,
  onDeleteChat,
}: HistorySidebarProps) {
  return (
    <aside className="history-sidebar" aria-label="Chat history">
      <div className="history-sidebar__top">
        <div className="history-sidebar__brand">
          <span className="history-sidebar__logo" aria-hidden="true">
            <SparkIcon size={18} />
          </span>
          <span className="history-sidebar__brand-name">AI Chat</span>
        </div>

        <button
          type="button"
          className="history-sidebar__new"
          onClick={onNewChat}
        >
          <span className="history-sidebar__new-icon" aria-hidden="true">
            <ComposeIcon />
          </span>
          New chat
        </button>
      </div>

      <div className="history-sidebar__section">
        <h2 className="history-sidebar__section-label">Chats</h2>

        {entries.length === 0 ? (
          <p className="history-sidebar__empty">No chats yet</p>
        ) : (
          <ol className="history-sidebar__list">
            {entries.map((entry) => {
              const isActive = entry.id === activeSessionId
              return (
                <li
                  key={entry.id}
                  className={
                    isActive
                      ? 'history-sidebar__row history-sidebar__row--active'
                      : 'history-sidebar__row'
                  }
                >
                  <button
                    type="button"
                    className="history-sidebar__item"
                    onClick={() => onSelect(entry.id)}
                    aria-current={isActive ? 'true' : undefined}
                    title={entry.title}
                  >
                    {truncateText(entry.title, 48)}
                  </button>
                  <button
                    type="button"
                    className="history-sidebar__delete"
                    aria-label={`Delete ${entry.title}`}
                    title="Delete chat"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDeleteChat(entry.id)
                    }}
                  >
                    <TrashIcon />
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </aside>
  )
}
