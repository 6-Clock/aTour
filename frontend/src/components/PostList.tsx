import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPosts, ApiError, type Post } from '../api'

type Status =
  | { state: 'loading' }
  | { state: 'loaded'; posts: Post[] }
  | { state: 'error'; message: string }

export default function PostList({ refreshKey }: { refreshKey: number }) {
  const [status, setStatus] = useState<Status>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false

    // No synchronous setState here on purpose (react-hooks/set-state-in-effect):
    // initial state is already 'loading' for first mount, and on refetch
    // (refreshKey change) the previous list stays visible until the new
    // data arrives instead of flashing back to a loading state.
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
  }, [refreshKey])

  if (status.state === 'loading') {
    return <p>Loading listings…</p>
  }

  if (status.state === 'error') {
    return <p role="alert">{status.message}</p>
  }

  if (status.posts.length === 0) {
    return <p>No listings published yet.</p>
  }

  return (
    <ul>
      {status.posts.map((post) => (
        <li key={post.post_id}>
          <h3>
            <Link to={`/posts/${post.post_id}`}>{post.title}</Link>
          </h3>
          {post.description && <p>{post.description}</p>}
          <p>
            ${post.booking_fee} · up to {post.max_group_size} people
          </p>
        </li>
      ))}
    </ul>
  )
}
