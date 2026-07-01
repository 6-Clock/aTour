import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listPosts, ApiError, type Post } from '../api'
import SearchBar from './SearchBar'

type Status =
  | { state: 'loading' }
  | { state: 'loaded'; posts: Post[] }
  | { state: 'error'; message: string }

// No category field on posts yet — pick a stable per-destination accent hue
// from a hash of the post id, per DESIGN.md's "one accent per card" rule.
const CATEGORIES = ['ocean', 'jungle', 'sunset', 'desert', 'city'] as const

function categoryFor(postId: string) {
  let hash = 0
  for (let i = 0; i < postId.length; i++) {
    hash = (hash * 31 + postId.charCodeAt(i)) >>> 0
  }
  return CATEGORIES[hash % CATEGORIES.length]
}

export default function PostList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [searchParams] = useSearchParams()
  const title = searchParams.get('title') ?? undefined
  const location = searchParams.get('location') ?? undefined
  const isSearching = Boolean(title || location)

  useEffect(() => {
    let cancelled = false

    // No synchronous setState here on purpose (react-hooks/set-state-in-effect):
    // initial state is already 'loading' for first mount, and on refetch
    // (refreshKey or search change) the previous list stays visible until the
    // new data arrives instead of flashing back to a loading state.
    listPosts({ title, location })
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
  }, [refreshKey, title, location])

  return (
    <>
      <SearchBar />

      {status.state === 'loading' && (
        <ul className="cards" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li className="card-skeleton" key={i} />
          ))}
        </ul>
      )}

      {status.state === 'error' && (
        <div className="empty-state">
          <p role="alert">{status.message}</p>
        </div>
      )}

      {status.state === 'loaded' && status.posts.length === 0 && (
        <div className="empty-state">
          {isSearching ? (
            <>
              <p>No tours match your search.</p>
              <Link to="/">Clear search</Link>
            </>
          ) : (
            <p>No listings published yet — check back soon, or be the first to host one.</p>
          )}
        </div>
      )}

      {status.state === 'loaded' && status.posts.length > 0 && (
        <ul className="cards">
          {status.posts.map((post) => (
            <li key={post.post_id} className={`cat-${categoryFor(post.post_id)}`}>
              {post.cover_image_url ? (
                <img className="card-cover" src={post.cover_image_url} alt="" loading="lazy" />
              ) : (
                <div className="card-cover card-cover-fallback" aria-hidden="true" />
              )}
              <span className="card-chip">{categoryFor(post.post_id)}</span>
              <h3>
                <Link to={`/posts/${post.post_id}`}>{post.title}</Link>
              </h3>
              {post.guide_name && (
                <p className="card-guide">
                  by <Link to={`/guides/${post.user_id}`}>{post.guide_name}</Link>
                </p>
              )}
              {post.description && <p>{post.description}</p>}
              <p className="price">
                ${post.booking_fee} · up to {post.max_group_size} people
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
