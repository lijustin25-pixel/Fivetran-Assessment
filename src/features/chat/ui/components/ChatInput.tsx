import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { SendIcon, StopIcon } from './icons'

interface ChatInputProps {
  onSubmit: (prompt: string) => void | Promise<void>
  isLoading: boolean
  onStop?: () => void
  onEmptySubmit?: () => void
}

export function ChatInput({
  onSubmit,
  isLoading,
  onStop,
  onEmptySubmit,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const canSend = value.trim().length > 0 && !isLoading

  useEffect(() => {
    const field = fieldRef.current
    if (!field) {
      return
    }
    field.style.height = '0px'
    field.style.height = `${Math.min(field.scrollHeight, 160)}px`
  }, [value])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) {
      return
    }
    const trimmed = value.trim()
    if (!trimmed) {
      onEmptySubmit?.()
      return
    }

    await onSubmit(trimmed)
    setValue('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <label htmlFor="prompt" className="visually-hidden">
        Message
      </label>
      <div className="chat-input__composer">
        <textarea
          ref={fieldRef}
          id="prompt"
          name="prompt"
          className="chat-input__field"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything"
          rows={1}
          disabled={isLoading}
          aria-busy={isLoading}
        />
        {isLoading && onStop ? (
          <button
            type="button"
            className="chat-input__submit chat-input__submit--stop"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            type="submit"
            className="chat-input__submit"
            disabled={!canSend}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        )}
      </div>
    </form>
  )
}
