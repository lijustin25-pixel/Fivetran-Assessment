export class OpenAIError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'OpenAIError'
    this.status = status
  }
}

function errorName(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name: unknown }).name
    return typeof name === 'string' ? name : undefined
  }
  return undefined
}

export function mapStatusToMessage(status: number, apiMessage?: string): string {
  if (status === 401) {
    return 'Invalid API key. Check VITE_OPENAI_API_KEY in your .env file.'
  }
  if (status === 429) {
    return 'Rate limit exceeded. Please wait a moment and try again.'
  }
  if (status >= 500) {
    return 'OpenAI is temporarily unavailable. Please try again later.'
  }
  return apiMessage?.trim() || `Request failed with status ${status}.`
}

export function mapFetchError(error: unknown): OpenAIError {
  if (error instanceof OpenAIError) {
    return error
  }

  const name = errorName(error)

  // AbortSignal.timeout → TimeoutError (or AbortError in some runtimes).
  // Callers that cancel intentionally should check controller.signal.aborted
  // before mapping to a user-facing message.
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new OpenAIError(
      'The request timed out. Check your connection and try again.',
    )
  }

  if (error instanceof TypeError) {
    return new OpenAIError(
      'Network error. Check your connection and try again.',
    )
  }

  if (error instanceof Error && error.message) {
    return new OpenAIError(error.message)
  }

  return new OpenAIError('Something went wrong. Please try again.')
}

export function toUserFacingError(error: unknown): string {
  if (error instanceof OpenAIError) {
    return error.message
  }
  // Gateway should throw OpenAIError; map unexpected rejects defensively.
  return mapFetchError(error).message
}
