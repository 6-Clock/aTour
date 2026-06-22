import { useState } from 'react'
import { ApiError, createReview } from '../api'

type Status =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'done' }
  | { state: 'error'; message: string }

export default function ReviewForm({ bookingId }: { bookingId: string }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<Status>({ state: 'idle' })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus({ state: 'submitting' })
    try {
      await createReview(bookingId, rating, comment || undefined)
      setStatus({ state: 'done' })
    } catch (err) {
      // 409 = a review already exists for this booking (one per booking).
      const message =
        err instanceof ApiError
          ? err.status === 409
            ? "You've already reviewed this booking."
            : err.message
          : 'Network error — could not submit your review.'
      setStatus({ state: 'error', message })
    }
  }

  if (status.state === 'done') {
    return <p role="status">Thanks for your review!</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Rating
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
      </label>
      <label>
        Comment (optional)
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <button type="submit" disabled={status.state === 'submitting'}>
        {status.state === 'submitting' ? 'Submitting…' : 'Submit review'}
      </button>
      {status.state === 'error' && <p role="alert">{status.message}</p>}
    </form>
  )
}
