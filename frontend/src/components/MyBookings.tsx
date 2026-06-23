import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, cancelBooking, listMyBookings, type Booking } from '../api'
import { useAuth } from '../auth/useAuth'
import ReviewForm from './ReviewForm'

type Status =
  | { state: 'loading' }
  | { state: 'loaded'; bookings: Booking[] }
  | { state: 'error'; message: string }

// pending/confirmed are the cancellable (active) states; cancelled/completed
// are terminal — mirrors the backend's ACTIVE_STATUSES guard.
const ACTIVE: Booking['status'][] = ['pending', 'confirmed']

// slot_date is a calendar date ("2026-07-01"); parse as local midnight so the
// rendered day doesn't shift across timezones.
function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function MyBookings() {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [cancelling, setCancelling] = useState<string | null>(null)

  // Used by the cancel handler to refetch after a successful cancel. Called
  // from an event handler, not the effect.
  const refresh = useCallback(async () => {
    const bookings = await listMyBookings('tourist')
    setStatus({ state: 'loaded', bookings })
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listMyBookings('tourist')
      .then((bookings) => {
        if (!cancelled) setStatus({ state: 'loaded', bookings })
      })
      .catch((err) => {
        if (cancelled) return
        const message =
          err instanceof ApiError ? err.message : 'Could not reach the server.'
        setStatus({ state: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleCancel(bookingId: string) {
    setCancelling(bookingId)
    try {
      await cancelBooking(bookingId)
      await refresh()
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not cancel — try again.'
      setStatus({ state: 'error', message })
    } finally {
      setCancelling(null)
    }
  }

  if (!user) {
    return (
      <div className="empty-state">
        <p>
          <Link to="/login">Log in</Link> to see your bookings.
        </p>
      </div>
    )
  }
  if (status.state === 'loading') return <p>Loading your bookings…</p>
  if (status.state === 'error') return (
    <div className="empty-state">
      <p role="alert">{status.message}</p>
    </div>
  )
  if (status.bookings.length === 0) return (
    <div className="empty-state">
      <p>You have no bookings yet — go find something to wander to.</p>
    </div>
  )

  return (
    <div>
      <h2>My bookings</h2>
      <ul className="booking-list">
        {status.bookings.map((b) => (
          <li key={b.booking_id}>
            <div className="row-head">
              <div className="booking-tour">
                <Link to={`/posts/${b.post_id}`} className="booking-title">
                  {b.post_title}
                </Link>
                <span className="booking-date muted">{formatDate(b.slot_date)}</span>
              </div>
              <span className={`badge ${b.status}`}>{b.status}</span>
              {ACTIVE.includes(b.status) && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleCancel(b.booking_id)}
                  disabled={cancelling === b.booking_id}
                >
                  {cancelling === b.booking_id ? 'Cancelling…' : 'Cancel'}
                </button>
              )}
            </div>
            {/* Only completed bookings are reviewable (backend gates on it). */}
            {b.status === 'completed' && (
              <ReviewForm bookingId={b.booking_id} postTitle={b.post_title} />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
