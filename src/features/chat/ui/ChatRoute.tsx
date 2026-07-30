import { useState } from 'react'
import { useChat } from '../application/useChat'
import { ChatInput } from './components/ChatInput'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ErrorBanner } from './components/ErrorBanner'
import { HistorySidebar } from './components/HistorySidebar'
import { MenuIcon } from './components/icons'
import { MessageList } from './components/MessageList'
import './ChatRoute.css'

export function ChatRoute() {
  const {
    messages,
    isLoading,
    streamingMessageId,
    error,
    activeSessionId,
    historyEntries,
    actions,
  } = useChat()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const pendingDeleteTitle =
    historyEntries.find((entry) => entry.id === pendingDeleteId)?.title ??
    'this chat'

  return (
    <div className={sidebarOpen ? 'app-shell app-shell--sidebar-open' : 'app-shell'}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close sidebar"
        onClick={() => setSidebarOpen(false)}
      />

      <HistorySidebar
        entries={historyEntries}
        activeSessionId={activeSessionId}
        onSelect={(sessionId) => {
          actions.selectSession(sessionId)
          setSidebarOpen(false)
        }}
        onNewChat={() => {
          actions.startNewChat()
          setSidebarOpen(false)
        }}
        onDeleteChat={(sessionId) => {
          setPendingDeleteId(sessionId)
        }}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete chat?"
        message={`This will permanently delete “${pendingDeleteTitle}”. You can’t undo this.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) {
            actions.deleteChat(pendingDeleteId)
          }
          setPendingDeleteId(null)
        }}
      />

      <div className="app">
        <header className="app__header">
          <button
            type="button"
            className="app__menu"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon />
          </button>
          <div className="app__model">
            <span>AI Chat</span>
          </div>
          <div className="app__header-actions">
            <button
              type="button"
              className="app__header-clear"
              onClick={actions.clearChat}
              disabled={messages.length === 0}
            >
              Clear chat
            </button>
          </div>
        </header>

        <main className="app__main">
          {error ? (
            <div className="app__error">
              <ErrorBanner message={error} onDismiss={actions.dismissError} />
            </div>
          ) : null}
          <MessageList
            messages={messages}
            streamingMessageId={streamingMessageId}
          />
        </main>

        <footer className="app__footer">
          <div className="app__composer-wrap">
            <ChatInput
              onSubmit={actions.sendMessage}
              isLoading={isLoading}
              onStop={actions.stopGenerating}
              onEmptySubmit={() => {
                void actions.sendMessage('')
              }}
            />
            <p className="app__disclaimer">
              AI can make mistakes. Check important info.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
