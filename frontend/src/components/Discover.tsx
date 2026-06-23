import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, listPosts, type Post } from '../api'

// Instagram-reels-style browse: one full-viewport panel per tour, vertical
// scroll-snap. Reuses GET /api/posts (cover_image_url comes from the list now).
// Posts without a cover get a gradient fallback panel instead of a broken image.
type Status =
  | { state: 'loading' }
  | { state: 'loaded'; posts: Post[] }
  | { state: 'error'; message: string }

export default function Discover() {
  const [status, setStatus] = useState<Status>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    listPosts()
      .then((posts) => {
        if (!cancelled) setStatus({ state: 'loaded', posts })
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
  }, [])

  if (status.state === 'loading') return <p>Loading tours…</p>
  if (status.state === 'error') return (
    <div className="empty-state">
      <p role="alert">{status.message}</p>
    </div>
  )
  if (status.posts.length === 0) return (
    <div className="empty-state">
      <p>No tours to discover yet.</p>
    </div>
  )

  return (
    <div className="reels" data-testid="reels">
      {status.posts.map((post) => (
        <section className="reel" key={post.post_id}>
          <div className="reel-inner">
            {post.cover_image_url ? (
              <img
                className="reel-img"
                src={post.cover_image_url}
                alt={post.title}
                loading="lazy"
              />
            ) : (
              <div className="reel-img reel-fallback" aria-hidden="true" />
            )}
            <div className="reel-overlay">
              <h2>{post.title}</h2>
              <p className="reel-price">
                ${post.booking_fee} · up to {post.max_group_size} people
              </p>
              <Link className="btn" to={`/posts/${post.post_id}`}>
                View &amp; book
              </Link>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
