import { useCallback, useEffect, useState } from 'react'
import { ApiError, addSlots, deleteSlot, listSlots, toggleSlot, type Slot } from '../api'

type Status =
  | { state: 'loading' }
  | { state: 'loaded'; slots: Slot[] }
  | { state: 'error'; message: string }

export default function ManageSlots({ postId }: { postId: string }) {
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [newDate, setNewDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Owner view: listSlots returns ALL slots (incl. closed/past) when authed.
  const refresh = useCallback(async () => {
    const slots = await listSlots(postId)
    setStatus({ state: 'loaded', slots })
  }, [postId])

  useEffect(() => {
    let cancelled = false
    listSlots(postId)
      .then((slots) => {
        if (!cancelled) setStatus({ state: 'loaded', slots })
      })
      .catch((err) => {
        if (cancelled) return
        const message =
          err instanceof ApiError ? err.message : 'Could not load slots.'
        setStatus({ state: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [postId])

  async function runAction(fn: () => Promise<unknown>) {
    setBusy(true)
    setActionError(null)
    try {
      await fn()
      await refresh()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    if (!newDate) return
    await runAction(() => addSlots(postId, [newDate]))
    setNewDate('')
  }

  if (status.state === 'loading') return <p>Loading dates…</p>
  if (status.state === 'error') return <p role="alert">{status.message}</p>

  return (
    <div>
      <h4>Dates</h4>
      {status.slots.length === 0 ? (
        <p>No dates yet.</p>
      ) : (
        <ul>
          {status.slots.map((slot) => (
            <li key={slot.slot_id}>
              {slot.date} — {slot.available ? 'open' : 'closed'}{' '}
              <button type="button" onClick={() => runAction(() => toggleSlot(slot.slot_id))} disabled={busy}>
                {slot.available ? 'Close' : 'Open'}
              </button>{' '}
              <button type="button" onClick={() => runAction(() => deleteSlot(slot.slot_id))} disabled={busy}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd}>
        <label>
          Add a date
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
        </label>
        <button type="submit" disabled={busy || !newDate}>
          Add
        </button>
      </form>
      {actionError && <p role="alert">{actionError}</p>}
    </div>
  )
}
