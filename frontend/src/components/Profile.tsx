import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ApiError,
  listMyBookings,
  listUserPosts,
  updateMe,
  uploadProfilePhoto,
  type UpdateMeInput,
} from '../api'
import { useAuth } from '../auth/useAuth'
import InlineEditField from './InlineEditField'

// Identity hub for the logged-in user: profile header (read straight off the
// auth Me, no extra fetch) + counts that link out to the existing /bookings and
// /me/posts pages, plus a link to the guide's own public /guides/:id storefront
// (reviews + postings — reverted to read-only in the B1 follow-up; editing
// lives here instead, since this is the private page the user actually manages
// themselves). Deliberately does NOT re-render bookings/listings inline — it
// links to them (eng-review Issue 3: identity hub + links, no duplication).
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
  const { user, refreshUser } = useAuth()
  const [counts, setCounts] = useState<Counts>({ state: 'loading' })
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      <div className="empty-state">
        <p>
          <Link to="/login">Log in</Link> to see your profile.
        </p>
      </div>
    )
  }

  async function handleSaveField(field: 'bio' | 'city' | 'languages', next: string | string[]) {
    const payload = { [field]: next } as UpdateMeInput
    await updateMe(payload)
    await refreshUser()
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    setPhotoError(null)
    setPhotoUploading(true)
    try {
      await uploadProfilePhoto(file)
      await refreshUser()
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Upload failed.')
    } finally {
      setPhotoUploading(false)
    }
  }

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="profile">
      <header className="profile-head guide-profile-header">
        <div className="guide-avatar-wrap">
          <div className="guide-avatar" aria-hidden={!user.profile_photo}>
            {user.profile_photo ? (
              <img src={user.profile_photo} alt={user.name} />
            ) : (
              initials
            )}
            {photoUploading && (
              <div className="guide-avatar-uploading">
                <span className="spinner" aria-hidden="true" />
              </div>
            )}
          </div>
          {!photoUploading && (
            <>
              <button
                type="button"
                className="guide-avatar-badge"
                aria-label="Change profile photo"
                onClick={() => fileInputRef.current?.click()}
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
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="visually-hidden"
                onChange={handlePhotoChange}
              />
            </>
          )}
        </div>
        <div className="guide-meta">
          <h2>{user.name}</h2>
          {photoError && (
            <p role="alert" className="guide-avatar-error">
              {photoError}
            </p>
          )}
          <p className="muted">Member since {memberSince(user.created_at)}</p>
          <InlineEditField
            label="city"
            value={user.city}
            kind="text"
            placeholder="Add a city"
            onSave={(next) => handleSaveField('city', next)}
          />
          <InlineEditField
            label="languages"
            value={null}
            languages={user.languages}
            kind="tags"
            placeholder="Add languages"
            onSave={(next) => handleSaveField('languages', next)}
          />
          {user.avg_rating !== null && (
            <p className="profile-rating">★ {user.avg_rating.toFixed(1)} as a guide</p>
          )}
          <InlineEditField
            label="bio"
            value={user.bio}
            kind="textarea"
            placeholder="Add a bio"
            onSave={(next) => handleSaveField('bio', next)}
          />
        </div>
      </header>

      <ul className="profile-links">
        <li>
          <Link to={`/guides/${user.user_id}`}>View public profile</Link>
        </li>
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
