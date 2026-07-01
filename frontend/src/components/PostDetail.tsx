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
    if (!user) {
      navigate('/login')
      return
    }
    setBooking({ state: 'booking', slotId })
    try {
      await createBooking(slotId)
      const successText = guide
        ? `You're booked! Check My bookings for your upcoming tour with ${guide.name}.`
        : 'Booked! See it under "My bookings".'
      setBooking({ state: 'message', ok: true, text: successText })
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
          <h1 className="detail-title">{post.title}</h1>

          {/* Tour metadata chips */}
          <div className="tour-chips">
            {post.duration_hours && (
              <span className="chip">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {post.duration_hours}h
              </span>
            )}
            {post.location && (
              <span className="chip">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {post.location}
              </span>
            )}
            <span className="chip">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Up to {post.max_group_size} people
            </span>
          </div>

          {/* Guide card — above description so tourists see the guide without scrolling */}
          {guide && (
            <div className="guide-card">
              <div className="guide-card-avatar">
                {guide.profile_photo ? (
                  <img src={guide.profile_photo} alt={guide.name} />
                ) : (
                  <span>{guide.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="guide-card-body">
                <Link to={`/guides/${post.user_id}`}>
                  <h3>{guide.name}</h3>
                </Link>
                {guide.avg_rating !== null && (
                  <p className="guide-card-rating">
                    ★ {guide.avg_rating.toFixed(1)}
                    {guide.review_count > 0 && ` · ${guide.review_count} review${guide.review_count === 1 ? '' : 's'}`}
                  </p>
                )}
                {guide.bio && <p className="guide-card-bio">{guide.bio}</p>}
              </div>
            </div>
          )}

          {post.description && <p className="detail-description">{post.description}</p>}

          {/* Carousel */}
          {post.images.length === 0 ? (
            <div className="carousel-placeholder" />
          ) : post.images.length === 1 ? (
            <div className="carousel">
              <img src={post.images[0].image_url} alt="" />
            </div>
          ) : (
            <>
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
              <div className="carousel-thumbs" role="list">
                {post.images.map((img, i) => (
                  <button
                    key={img.image_id}
                    className={`thumb${i === imgIdx ? ' thumb-active' : ''}`}
                    onClick={() => setImgIdx(i)}
                    aria-label={`View image ${i + 1} of ${post.images.length}`}
                    role="listitem"
                  >
                    <img src={img.image_url} alt="" />
                  </button>
                ))}
              </div>
            </>
          )}

          <h3>Reviews</h3>
          {reviews.length === 0 ? (
            <p className="muted">No reviews yet — book this tour to be the first!</p>
          ) : (
            <ul className="reviews">
              {reviews.map((review) => (
                <li key={review.review_id}>
                  {review.reviewer_name && (
                    <span className="reviewer-name">{review.reviewer_name}</span>
                  )}
                  <span className="rating"> ★ {review.rating}</span>
                  {review.comment && <> — {review.comment}</>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="detail-booking">
          <p className="booking-price">
            ${post.booking_fee}
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
