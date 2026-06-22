import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ApiError,
  createBooking,
  getPost,
  getUser,
  listPostReviews,
  listSlots,
  type PostDetail as PostDetailType,
  type PublicProfile,
  type Review,
  type Slot,
} from '../api'
import { useAuth } from '../auth/useAuth'

type Status =
  | { state: 'loading' }
  | { state: 'loaded'; post: PostDetailType; slots: Slot[] }
  | { state: 'error'; message: string }

type Booking =
  | { state: 'idle' }
  | { state: 'booking'; slotId: string }
  | { state: 'message'; ok: boolean; text: string }

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [guide, setGuide] = useState<PublicProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [booking, setBooking] = useState<Booking>({ state: 'idle' })

  // Used by the booking handler to refetch slots after a successful book
  // (capacity changes). Called from an event handler, not the effect.
  const refresh = useCallback(async () => {
    if (!postId) return
    const [post, slots] = await Promise.all([getPost(postId), listSlots(postId)])
    setStatus({ state: 'loaded', post, slots })
  }, [postId])

  useEffect(() => {
    if (!postId) return
    let cancelled = false
    Promise.all([getPost(postId), listSlots(postId), listPostReviews(postId)])
      .then(([post, slots, postReviews]) => {
        if (cancelled) return undefined
        setStatus({ state: 'loaded', post, slots })
        setReviews(postReviews)
        // The post's owner is the guide; fetch their public profile for the
        // name + avg_rating shown below the title.
        return getUser(post.user_id)
      })
      .then((profile) => {
        if (profile && !cancelled) setGuide(profile)
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
  }, [postId])

  async function handleBook(slotId: string) {
    // Booking requires auth — send anonymous visitors to log in first.
    if (!user) {
      navigate('/login')
      return
    }
    setBooking({ state: 'booking', slotId })
    try {
      await createBooking(slotId)
      setBooking({ state: 'message', ok: true, text: 'Booked! See it under "My bookings".' })
      // Capacity may have changed (a full slot drops out of the public list).
      await refresh()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login')
        return
      }
      const text =
        err instanceof ApiError ? err.message : 'Network error — could not book.'
      setBooking({ state: 'message', ok: false, text })
    }
  }

  if (status.state === 'loading') return <p>Loading…</p>
  if (status.state === 'error') return <p role="alert">{status.message}</p>

  const { post, slots } = status

  return (
    <article>
      <p>
        <Link to="/">← Back to tours</Link>
      </p>
      <h2>{post.title}</h2>
      {guide && (
        <p>
          by {guide.name}
          {guide.avg_rating !== null && <> · ★ {guide.avg_rating.toFixed(1)}</>}
        </p>
      )}
      {post.description && <p>{post.description}</p>}
      <p>
        ${post.booking_fee} · up to {post.max_group_size} people
      </p>

      {post.images.length > 0 && (
        <div>
          {post.images.map((image) => (
            <img key={image.image_id} src={image.image_url} alt="" width={240} />
          ))}
        </div>
      )}

      <h3>Available dates</h3>
      {slots.length === 0 ? (
        <p>No open dates right now.</p>
      ) : (
        <ul>
          {slots.map((slot) => (
            <li key={slot.slot_id}>
              {slot.date}{' '}
              <button
                type="button"
                onClick={() => handleBook(slot.slot_id)}
                disabled={booking.state === 'booking'}
              >
                {booking.state === 'booking' && booking.slotId === slot.slot_id
                  ? 'Booking…'
                  : 'Book'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {booking.state === 'message' && (
        <p role={booking.ok ? 'status' : 'alert'}>{booking.text}</p>
      )}

      <h3>Reviews</h3>
      {reviews.length === 0 ? (
        <p>No reviews yet.</p>
      ) : (
        <ul>
          {reviews.map((review) => (
            <li key={review.review_id}>
              ★ {review.rating}
              {review.comment && <> — {review.comment}</>}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
