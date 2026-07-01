import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import InlineEditField from './InlineEditField'
import { ApiError } from '../api'

describe('InlineEditField', () => {
  it('shows the static value with an always-visible edit button', () => {
    render(
      <InlineEditField
        label="Bio"
        value="Local foodie"
        kind="textarea"
        placeholder="Add a bio"
        onSave={vi.fn()}
      />,
    )
    expect(screen.getByText('Local foodie')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Bio' })).toBeInTheDocument()
  })

  it('shows placeholder text when value is null', () => {
    render(
      <InlineEditField
        label="Bio"
        value={null}
        kind="textarea"
        placeholder="Add a bio"
        onSave={vi.fn()}
      />,
    )
    expect(screen.getByText('Add a bio')).toBeInTheDocument()
  })

  it('opens an editor on click and saves on Save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <InlineEditField
        label="Bio"
        value="Old bio"
        kind="textarea"
        placeholder="Add a bio"
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit Bio' }))
    const textarea = screen.getByRole('textbox', { name: 'Bio' })
    await user.clear(textarea)
    await user.type(textarea, 'New bio')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith('New bio')
    // Editor closes after a successful save.
    expect(screen.queryByRole('textbox', { name: 'Bio' })).not.toBeInTheDocument()
  })

  it('shows an inline error and keeps the editor open on save failure', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new ApiError(422, 'too long'))
    render(
      <InlineEditField
        label="City"
        value="Lisbon"
        kind="text"
        placeholder="Add a city"
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit City' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('too long')
    // Editor stays open with the draft intact.
    expect(screen.getByRole('textbox', { name: 'City' })).toBeInTheDocument()
  })

  it('reverts the draft and closes without saving on Cancel', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <InlineEditField
        label="City"
        value="Lisbon"
        kind="text"
        placeholder="Add a city"
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit City' }))
    const input = screen.getByRole('textbox', { name: 'City' })
    await user.clear(input)
    await user.type(input, 'Porto')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Lisbon')).toBeInTheDocument()
  })

  it('splits, trims, and drops empty entries for kind="tags"', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <InlineEditField
        label="Languages"
        value={null}
        languages={['English']}
        kind="tags"
        placeholder="Add languages"
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit Languages' }))
    const input = screen.getByRole('textbox', { name: 'Languages' })
    await user.clear(input)
    await user.type(input, 'English, , Spanish,')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith(['English', 'Spanish'])
  })

  it('disables Save/Cancel and shows "Saving…" while the save is pending', async () => {
    const user = userEvent.setup()
    let resolveSave: () => void = () => {}
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve
        }),
    )
    render(
      <InlineEditField
        label="Bio"
        value="Old bio"
        kind="textarea"
        placeholder="Add a bio"
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit Bio' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    resolveSave()
  })
})
