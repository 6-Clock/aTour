import { useCallback, useEffect, useState } from 'react'
import {
  ApiError,
  cancelBooking,
  completeBooking,
  confirmBooking,
  listMyBookings,
  type Booking,
} from '../api'

type Status =
  | { state: 'loading' }
  | { state: 'loaded'; bookings: Booking[] }
  | { state: 'error'; message: string }

export default function GuideBookings() {
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const bookings = await listMyBookings('guide')
    setStatus({ state: 'loaded', bookings })
  }, [])

  useEffect(() => {
    let cancelled = false
    listMyBookings('guide')
      .then((bookings) => {
        if (!cancelled) setStatus({ state: 'loaded', bookings })
      })
      .catch((err) => {
        if (cancelled) return
        const message =
          err instanceof ApiError ? err.message : 'Could not load bookings.'
        setStatus({ state: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function runAction(bookingId: string, fn: () => Promise<unknown>) {
    setBusy(bookingId)
    setActionError(null)
    try {
      await fn()
      await refresh()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  if (status.state === 'loading') return <p>Loading bookings…</p>
  if (status.state === 'error') return <p role="alert">{status.message}</p>

  return (
    <section>
      <h3>Bookings on my tours</h3>
      {status.bookings.length === 0 ? (
        <p>No one has booked your tours yet.</p>
      ) : (
        <ul className="rows">
          {status.bookings.map((b) => {
            const disabled = busy === b.booking_id
            return (
              <li key={b.booking_id}>
                <span className={`badge ${b.status}`}>{b.status}</span>
                {b.status === 'pending' && (
                  <button type="button" onClick={() => runAction(b.booking_id, () => confirmBooking(b.booking_id))} disabled={disabled}>
                    Confirm
                  </button>
                )}
                {b.status === 'confirmed' && (
                  <button type="button" onClick={() => runAction(b.booking_id, () => completeBooking(b.booking_id))} disabled={disabled}>
                    Mark completed
                  </button>
                )}
                {(b.status === 'pending' || b.status === 'confirmed') && (
                  <button type="button" className="danger" onClick={() => runAction(b.booking_id, () => cancelBooking(b.booking_id))} disabled={disabled}>
                    Cancel
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {actionError && <p role="alert">{actionError}</p>}
    </section>
  )
}
