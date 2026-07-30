import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '../../domain/chat'
import { SparkIcon } from './icons'

interface MessageProps {
  message: ChatMessage
  isStreaming?: boolean
}

export function Message({ message, isStreaming = false }: MessageProps) {
  const isUser = message.role === 'user'
  const showTyping = isStreaming && !message.content.trim()

  return (
    <article
      id={`message-${message.id}`}
      className={
        isStreaming
          ? `message message--${isUser ? 'user' : 'assistant'} message--streaming`
          : `message message--${isUser ? 'user' : 'assistant'}`
      }
      aria-label={isUser ? 'Your message' : 'Assistant message'}
      aria-busy={isStreaming || undefined}
    >
      <div className="message__inner">
        {!isUser ? (
          <div className="message__avatar" aria-hidden="true">
            <SparkIcon size={16} />
          </div>
        ) : null}
        <div className="message__content">
          {!isUser ? (
            <div className="message__role">Assistant</div>
          ) : null}
          <div className="message__body">
            {showTyping ? (
              <>
                <div className="typing" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="visually-hidden">Generating response…</span>
              </>
            ) : isUser ? (
              <p>{message.content}</p>
            ) : (
              <>
                <ReactMarkdown>{message.content}</ReactMarkdown>
                {isStreaming ? (
                  <span className="message__cursor" aria-hidden="true" />
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
