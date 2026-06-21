import { useState } from 'react'
import { createPost, publishPost, ApiError, type Post } from '../api'

type Props = {
  onPublished: (post: Post) => void
}

type Status =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'error'; message: string }
  | { state: 'needs-publish-retry'; post: Post }

export default function CreatePostForm({ onPublished }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [bookingFee, setBookingFee] = useState('')
  const [maxGroupSize, setMaxGroupSize] = useState('')
  const [status, setStatus] = useState<Status>({ state: 'idle' })

  function resetForm() {
    setTitle('')
    setDescription('')
    setBookingFee('')
    setMaxGroupSize('')
  }

  async function retryPublish(post: Post) {
    setStatus({ state: 'submitting' })
    try {
      const published = await publishPost(post.post_id)
      setStatus({ state: 'idle' })
      resetForm()
      onPublished(published)
    } catch {
      setStatus({ state: 'needs-publish-retry', post })
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus({ state: 'submitting' })

    let created: Post
    try {
      created = await createPost({
        title,
        description: description || undefined,
        booking_fee: bookingFee,
        max_group_size: Number(maxGroupSize),
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Network error — could not reach the server.'
      setStatus({ state: 'error', message })
      return
    }

    // Auto-publish: this slice has no owner-dashboard view, so an
    // unpublished post would otherwise be invisible. If this fails,
    // the post still exists (with a real post_id) — offer a retry
    // instead of losing it silently.
    try {
      const published = await publishPost(created.post_id)
      setStatus({ state: 'idle' })
      resetForm()
      onPublished(published)
    } catch {
      setStatus({ state: 'needs-publish-retry', post: created })
    }
  }

  if (status.state === 'needs-publish-retry') {
    return (
      <div role="alert">
        <p>
          "{status.post.title}" was created but couldn't be published. It
          still exists — retry publishing it?
        </p>
        <button type="button" onClick={() => retryPublish(status.post)}>
          Retry publish
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create a listing</h2>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        Booking fee
        <input
          type="number"
          min="0"
          step="0.01"
          value={bookingFee}
          onChange={(e) => setBookingFee(e.target.value)}
          required
        />
      </label>
      <label>
        Max group size
        <input
          type="number"
          min="1"
          step="1"
          value={maxGroupSize}
          onChange={(e) => setMaxGroupSize(e.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={status.state === 'submitting'}>
        {status.state === 'submitting' ? 'Creating…' : 'Create listing'}
      </button>
      {status.state === 'error' && <p role="alert">{status.message}</p>}
    </form>
  )
}
