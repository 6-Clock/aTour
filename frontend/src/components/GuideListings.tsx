import { useCallback, useEffect, useState } from 'react'
import { ApiError, listUserPosts, publishPost, unpublishPost, type Post } from '../api'
import ManageSlots from './ManageSlots'
import ManageImages from './ManageImages'

type Status =
  | { state: 'loading' }
  | { state: 'loaded'; posts: Post[] }
  | { state: 'error'; message: string }

export default function GuideListings({ userId }: { userId: string }) {
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [busy, setBusy] = useState<string | null>(null)

  // Authenticated owner request → returns published AND hidden posts.
  const refresh = useCallback(async () => {
    const posts = await listUserPosts(userId)
    setStatus({ state: 'loaded', posts })
  }, [userId])

  useEffect(() => {
    let cancelled = false
    listUserPosts(userId)
      .then((posts) => {
        if (!cancelled) setStatus({ state: 'loaded', posts })
      })
      .catch((err) => {
        if (cancelled) return
        const message =
          err instanceof ApiError ? err.message : 'Could not load your listings.'
        setStatus({ state: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  async function togglePublish(post: Post) {
    setBusy(post.post_id)
    try {
      await (post.posted ? unpublishPost(post.post_id) : publishPost(post.post_id))
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  if (status.state === 'loading') return <p>Loading your listings…</p>
  if (status.state === 'error') return <p role="alert">{status.message}</p>

  return (
    <section>
      <h3>My listings</h3>
      {status.posts.length === 0 ? (
        <p className="muted">You haven't created any listings yet.</p>
      ) : (
        <div>
          {status.posts.map((post) => (
            <div className="listing" key={post.post_id}>
              <div className="listing-head">
                <span className="title">{post.title}</span>
                <span className={`badge ${post.posted ? 'completed' : 'pending'}`}>
                  {post.posted ? 'published' : 'hidden'}
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => togglePublish(post)}
                  disabled={busy === post.post_id}
                >
                  {post.posted ? 'Unpublish' : 'Publish'}
                </button>
              </div>
              <ManageSlots postId={post.post_id} />
              <ManageImages postId={post.post_id} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
