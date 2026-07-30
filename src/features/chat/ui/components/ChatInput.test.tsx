import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  it('keeps send disabled for empty or whitespace-only prompts', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<ChatInput onSubmit={onSubmit} isLoading={false} />)

    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()

    await user.type(screen.getByRole('textbox'), '   ')
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed prompts and clears the field', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ChatInput onSubmit={onSubmit} isLoading={false} />)

    const field = screen.getByRole('textbox')
    await user.type(field, '  Hello world  ')
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(onSubmit).toHaveBeenCalledWith('Hello world')
    expect(field).toHaveValue('')
  })

  it('disables the field while loading and exposes Stop', async () => {
    const user = userEvent.setup()
    const onStop = vi.fn()

    render(<ChatInput onSubmit={vi.fn()} isLoading onStop={onStop} />)

    expect(screen.getByRole('textbox')).toBeDisabled()
    const stop = screen.getByRole('button', { name: /stop generating/i })
    await user.click(stop)
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('submits on Enter and keeps Shift+Enter for newlines', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ChatInput onSubmit={onSubmit} isLoading={false} />)

    const field = screen.getByRole('textbox')
    await user.type(field, 'Hello{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('Hello')

    onSubmit.mockClear()
    await user.type(field, 'Line{Shift>}{Enter}{/Shift}two')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(field).toHaveValue('Line\ntwo')
  })
})

