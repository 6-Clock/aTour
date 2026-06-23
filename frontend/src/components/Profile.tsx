import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, listMyBookings, listUserPosts } from '../api'
import { useAuth } from '../auth/useAuth'

// Identity hub for the logged-in user: profile header (read straight off the
// auth Me, no extra fetch) + counts that link out to the existing /bookings and
// /me/posts pages. Deliberately does NOT re-render those lists — it links to
// them (eng-review Issue 3: identity hub + links, no duplication).
type Counts =
  | { state: 'loading' }
  | { state: 'loaded'; bookings: number; listings: number }
  | { state: 'error'; message: string }

function memberSince(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  })
}

export default function Profile() {
  const { user } = useAuth()
  const [counts, setCounts] = useState<Counts>({ state: 'loading' })

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([listMyBookings('tourist'), listUserPosts(user.user_id)])
      .then(([bookings, listings]) => {
        if (!cancelled)
          setCounts({
            state: 'loaded',
            bookings: bookings.length,
            listings: listings.length,
          })
      })
      .catch((err) => {
        if (cancelled) return
        const message =
          err instanceof ApiError ? err.message : 'Could not reach the server.'
        setCounts({ state: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) {
    return (
      <p>
        <Link to="/login">Log in</Link> to see your profile.
      </p>
    )
  }

  return (
    <div className="profile">
      <header className="profile-head">
        <h2>{user.name}</h2>
        <p className="muted">
          {user.city ? `${user.city} · ` : ''}Member since {memberSince(user.created_at)}
        </p>
        {user.avg_rating !== null && (
          <p className="profile-rating">★ {user.avg_rating.toFixed(1)} as a guide</p>
        )}
        {user.bio && <p className="profile-bio">{user.bio}</p>}
      </header>

      <ul className="profile-links">
        <li>
          <Link to="/bookings">
            My bookings
            {counts.state === 'loaded' && (
              <span className="count">{` (${counts.bookings})`}</span>
            )}
          </Link>
        </li>
        <li>
          <Link to="/me/posts">
            My listings
            {counts.state === 'loaded' && (
              <span className="count">{` (${counts.listings})`}</span>
            )}
          </Link>
        </li>
        <li>
          <Link to="/create">Create a listing</Link>
        </li>
      </ul>

      {counts.state === 'error' && <p role="alert">{counts.message}</p>}
    </div>
  )
}
