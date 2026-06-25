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
  const [imgIdx, setImgIdx] = useState(0)

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
    <article className="detail">
      <p className="detail-back">
        <Link to="/">← Back to tours</Link>
      </p>
      <div className="detail-grid">
        <div className="detail-main">
          <h2>{post.title}</h2>
          {guide && (
            <p className="meta">
              <Link to={`/guides/${post.user_id}`}>by {guide.name}</Link>
              {guide.avg_rating !== null && (
                <span className="rating"> · ★ {guide.avg_rating.toFixed(1)}</span>
              )}
            </p>
          )}
          {post.description && <p>{post.description}</p>}

          {post.images.length === 0 ? (
            <div className="carousel-placeholder" />
          ) : post.images.length === 1 ? (
            <div className="carousel">
              <img src={post.images[0].image_url} alt="" />
            </div>
          ) : (
            <div className="carousel">
              <img src={post.images[imgIdx].image_url} alt="" />
              <button
                className="carousel-btn prev"
                onClick={() => setImgIdx((i) => (i - 1 + post.images.length) % post.images.length)}
                aria-label="Previous image"
              >
                ‹
              </button>
              <button
                className="carousel-btn next"
                onClick={() => setImgIdx((i) => (i + 1) % post.images.length)}
                aria-label="Next image"
              >
                ›
              </button>
              <span className="carousel-counter">{imgIdx + 1} / {post.images.length}</span>
            </div>
          )}

          <h3>Reviews</h3>
          {reviews.length === 0 ? (
            <p className="muted">No reviews yet.</p>
          ) : (
            <ul className="reviews">
              {reviews.map((review) => (
                <li key={review.review_id}>
                  <span className="rating">★ {review.rating}</span>
                  {review.comment && <> — {review.comment}</>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="detail-booking">
          <p className="booking-price">
            ${post.booking_fee} <span className="muted">· up to {post.max_group_size} people</span>
          </p>
          <h3>Available dates</h3>
          {slots.length === 0 ? (
            <p className="muted">No open dates right now.</p>
          ) : (
            <ul className="rows">
              {slots.map((slot) => (
                <li key={slot.slot_id}>
                  <span>{slot.date}</span>
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
        </aside>
      </div>
    </article>
  )
}
