import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../domain/chat'
import { Message } from './Message'

interface MessageListProps {
  messages: ChatMessage[]
  streamingMessageId: string | null
}

export function MessageList({
  messages,
  streamingMessageId,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const wasStreamingRef = useRef(false)
  const [liveStatus, setLiveStatus] = useState('')

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMessageId])

  useEffect(() => {
    if (messages.length === 0) {
      setLiveStatus('')
      wasStreamingRef.current = false
      return
    }

    const isStreaming = streamingMessageId !== null
    if (isStreaming) {
      setLiveStatus('Generating response…')
      wasStreamingRef.current = true
      return
    }
    if (wasStreamingRef.current) {
      setLiveStatus('Assistant reply complete.')
      wasStreamingRef.current = false
    }
  }, [messages.length, streamingMessageId])

  if (messages.length === 0) {
    return (
      <section
        className="message-list message-list--empty"
        aria-label="Chat messages"
      >
        <h1 className="message-list__hero">What can I help with?</h1>
      </section>
    )
  }

  return (
    <section className="message-list" aria-label="Chat messages">
      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          isStreaming={message.id === streamingMessageId}
        />
      ))}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>
      <div ref={endRef} />
    </section>
  )
}
