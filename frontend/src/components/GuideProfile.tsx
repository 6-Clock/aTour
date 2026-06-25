import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, getUser, listUserPosts, type Post, type PublicProfile } from '../api'

export default function GuideProfile() {
  const { id } = useParams<{ id: string }>()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getUser(id), listUserPosts(id)])
      .then(([prof, userPosts]) => {
        if (cancelled) return
        setProfile(prof)
        setPosts(userPosts.filter((p) => p.posted))
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Could not load guide profile.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <p>Loading…</p>
  if (error || !profile) return <p role="alert">{error ?? 'Guide not found.'}</p>

  const initials = profile.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="guide-profile">
      <p className="detail-back">
        <Link to="/">← Back to tours</Link>
      </p>
      <div className="guide-profile-header">
        <div className="guide-avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="guide-meta">
          <h2>{profile.name}</h2>
          <div className="guide-chips">
            {profile.city && <span className="chip">{profile.city}</span>}
            {profile.languages?.map((lang) => (
              <span key={lang} className="chip chip-lang">
                {lang}
              </span>
            ))}
          </div>
          {profile.bio && <p className="guide-bio">{profile.bio}</p>}
          <div className="guide-stats">
            {profile.avg_rating !== null ? (
              <span>
                ★ {profile.avg_rating.toFixed(1)} (
                {profile.review_count} review{profile.review_count !== 1 ? 's' : ''})
              </span>
            ) : (
              <span className="muted">No reviews yet</span>
            )}
            <span className="guide-stat-sep">·</span>
            <span>
              {profile.tours_completed} tour{profile.tours_completed !== 1 ? 's' : ''} completed
            </span>
          </div>
        </div>
      </div>

      <section className="guide-tours">
        <h3>Tours</h3>
        {posts.length === 0 ? (
          <div className="empty-state">
            <p>No tours listed yet.</p>
          </div>
        ) : (
          <ul className="cards">
            {posts.map((post) => (
              <li key={post.post_id}>
                {post.cover_image_url ? (
                  <img
                    className="card-cover"
                    src={post.cover_image_url}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <div className="card-cover card-cover-fallback" aria-hidden="true" />
                )}
                <h3>
                  <Link to={`/posts/${post.post_id}`}>{post.title}</Link>
                </h3>
                {post.description && <p>{post.description}</p>}
                <p className="price">
                  ${post.booking_fee} · up to {post.max_group_size} people
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
