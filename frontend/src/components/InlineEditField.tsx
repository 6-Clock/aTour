import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'

type Kind = 'text' | 'textarea' | 'tags'

type Props = {
  label: string
  value: string | null
  languages?: string[] | null
  kind: Kind
  placeholder: string
  onSave: (next: string | string[]) => Promise<void>
}

function toDraft(kind: Kind, value: string | null, languages: string[] | null | undefined) {
  if (kind === 'tags') return (languages ?? []).join(', ')
  return value ?? ''
}

// Shared click-to-edit control for bio/city/languages on a guide's own profile.
// Always-visible pencil affordance (not hover-only) so it works identically on
// touch devices — hover has no equivalent on mobile.
export default function InlineEditField({
  label,
  value,
  languages,
  kind,
  placeholder,
  onSave,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => toDraft(kind, value, languages))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const pencilRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function openEditor() {
    setDraft(toDraft(kind, value, languages))
    setSaveError(null)
    setEditing(true)
  }

  function closeEditor() {
    setEditing(false)
    setSaveError(null)
    // Return focus to the pencil button so keyboard/screen-reader users don't
    // lose their place on the page.
    pencilRef.current?.focus()
  }

  function handleCancel() {
    if (saving) return
    closeEditor()
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const next: string | string[] =
      kind === 'tags'
        ? draft
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : draft
    try {
      await onSave(next)
      setSaving(false)
      closeEditor()
    } catch (err) {
      setSaving(false)
      setSaveError(err instanceof ApiError ? err.message : 'Could not save — try again.')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') handleCancel()
  }

  const displayValue = kind === 'tags' ? (languages ?? []).join(', ') : value

  if (!editing) {
    return (
      <span className="inline-edit-field">
        {displayValue ? <span>{displayValue}</span> : <span className="muted">{placeholder}</span>}
        <button
          type="button"
          className="inline-edit-pencil"
          aria-label={`Edit ${label}`}
          ref={pencilRef}
          onClick={openEditor}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
      </span>
    )
  }

  return (
    <div className="inline-edit-field inline-edit-field-open" onKeyDown={handleKeyDown}>
      {kind === 'textarea' ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={label}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={label}
        />
      )}
      <div className="inline-edit-actions">
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="secondary" onClick={handleCancel} disabled={saving}>
          Cancel
        </button>
      </div>
      {saveError && (
        <p role="alert" className="inline-edit-error">
          {saveError}
        </p>
      )}
    </div>
  )
}
