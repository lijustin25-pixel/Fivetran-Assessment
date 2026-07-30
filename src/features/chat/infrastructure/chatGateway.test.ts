import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseSseDataLine, streamChatCompletion } from './chatGateway'
import {
  mapFetchError,
  mapStatusToMessage,
  OpenAIError,
} from './openaiErrors'

describe('mapStatusToMessage', () => {
  it('maps common HTTP statuses to readable messages', () => {
    expect(mapStatusToMessage(401)).toMatch(/Invalid API key/i)
    expect(mapStatusToMessage(429)).toMatch(/Rate limit/i)
    expect(mapStatusToMessage(503)).toMatch(/temporarily unavailable/i)
    expect(mapStatusToMessage(400, 'Bad request detail')).toBe(
      'Bad request detail',
    )
  })
})

describe('mapFetchError', () => {
  it('maps timeout errors', () => {
    const timeout = new DOMException('Timed out', 'TimeoutError')
    expect(mapFetchError(timeout).message).toMatch(/timed out/i)
  })

  it('maps network TypeErrors', () => {
    expect(mapFetchError(new TypeError('Failed to fetch')).message).toMatch(
      /Network error/i,
    )
  })

  it('preserves OpenAIError instances', () => {
    const original = new OpenAIError('Already mapped', 401)
    expect(mapFetchError(original)).toBe(original)
  })
})

describe('parseSseDataLine', () => {
  it('extracts content deltas from SSE data lines', () => {
    expect(
      parseSseDataLine(
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      ),
    ).toBe('Hello')
    expect(parseSseDataLine('data: [DONE]')).toBeNull()
    expect(parseSseDataLine('event: ping')).toBeNull()
  })
})

function createSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]))
        index += 1
        return
      }
      controller.close()
    },
  })
}

describe('streamChatCompletion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('throws when the API key is missing', async () => {
    await expect(
      streamChatCompletion([{ role: 'user', content: 'Hi' }], {
        apiKey: '',
      }),
    ).rejects.toThrow(/Missing OpenAI API key/i)
  })

  it('streams assistant content via onDelta callbacks', async () => {
    const deltas: string[] = []
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseStream([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    })
    vi.stubGlobal('fetch', fetchMock)

    const content = await streamChatCompletion(
      [{ role: 'user', content: 'Hi' }],
      {
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        onDelta: (delta) => {
          deltas.push(delta)
        },
      },
    )

    expect(content).toBe('Hello world')
    expect(deltas).toEqual(['Hello', ' world'])
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      stream: true,
    })
  })

  it('maps non-OK responses to OpenAIError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Incorrect API key' } }),
      }),
    )

    await expect(
      streamChatCompletion([{ role: 'user', content: 'Hi' }], {
        apiKey: 'bad-key',
      }),
    ).rejects.toMatchObject({
      name: 'OpenAIError',
      status: 401,
      message: expect.stringMatching(/Invalid API key/i),
    })
  })

  it('maps fetch failures through mapFetchError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    await expect(
      streamChatCompletion([{ role: 'user', content: 'Hi' }], {
        apiKey: 'test-key',
      }),
    ).rejects.toThrow(/Network error/i)
  })

  it('aborts when the caller signal aborts', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        })
      }),
    )

    const pending = streamChatCompletion([{ role: 'user', content: 'Hi' }], {
      apiKey: 'test-key',
      signal: controller.signal,
    })

    controller.abort()

    await expect(pending).rejects.toThrow(/timed out|aborted/i)
  })
})
