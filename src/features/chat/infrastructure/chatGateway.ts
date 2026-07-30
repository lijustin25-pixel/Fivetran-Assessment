import type { ApiChatMessage } from '../domain/chat'
import {
  mapFetchError,
  mapStatusToMessage,
  OpenAIError,
} from './openaiErrors'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 120_000

interface ChatCompletionErrorBody {
  error?: {
    message?: string
  }
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string | null
    }
  }>
}

export function parseSseDataLine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) {
    return null
  }

  const payload = trimmed.slice(5).trim()
  if (!payload || payload === '[DONE]') {
    return null
  }

  try {
    const chunk = JSON.parse(payload) as ChatCompletionChunk
    const content = chunk.choices?.[0]?.delta?.content
    return typeof content === 'string' && content.length > 0 ? content : null
  } catch {
    return null
  }
}

function getApiKey(): string | undefined {
  const key = import.meta.env.VITE_OPENAI_API_KEY?.trim()
  return key || undefined
}

function getModel(): string {
  return import.meta.env.VITE_OPENAI_MODEL?.trim() || 'gpt-4o-mini'
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const data = (await response.json()) as ChatCompletionErrorBody
    return data.error?.message
  } catch {
    return undefined
  }
}

export async function streamChatCompletion(
  messages: ApiChatMessage[],
  options?: {
    apiKey?: string
    model?: string
    signal?: AbortSignal
    onDelta?: (delta: string) => void
  },
): Promise<string> {
  const apiKey = options?.apiKey ?? getApiKey()
  if (!apiKey) {
    throw new OpenAIError(
      'Missing OpenAI API key. Copy .env.example to .env and set VITE_OPENAI_API_KEY.',
    )
  }

  const model = options?.model ?? getModel()
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = options?.signal
    ? AbortSignal.any([timeoutSignal, options.signal])
    : timeoutSignal

  let response: Response
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
      signal,
    })
  } catch (error) {
    throw mapFetchError(error)
  }

  if (!response.ok) {
    const apiMessage = await readErrorMessage(response)
    throw new OpenAIError(
      mapStatusToMessage(response.status, apiMessage),
      response.status,
    )
  }

  if (!response.body) {
    throw new OpenAIError('The model returned an empty stream.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const delta = parseSseDataLine(line)
        if (!delta) {
          continue
        }
        content += delta
        options?.onDelta?.(delta)
      }
    }

    const trailing = parseSseDataLine(buffer)
    if (trailing) {
      content += trailing
      options?.onDelta?.(trailing)
    }
  } catch (error) {
    throw mapFetchError(error)
  } finally {
    reader.releaseLock()
  }

  if (!content.trim()) {
    throw new OpenAIError('The model returned an empty response.')
  }

  return content
}
