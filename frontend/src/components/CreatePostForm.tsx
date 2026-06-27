import { useState } from 'react'
import { createPost, publishPost, ApiError, type Post } from '../api'
import ManageImages from './ManageImages'

type Props = {
  onPublished: (post: Post) => void
}

type Status =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'error'; message: string }
  | { state: 'image-step'; post: Post; publishError?: string }

export default function CreatePostForm({ onPublished }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [location, setLocation] = useState('')
  const [bookingFee, setBookingFee] = useState('')
  const [maxGroupSize, setMaxGroupSize] = useState('')
  const [status, setStatus] = useState<Status>({ state: 'idle' })

  function resetForm() {
    setTitle('')
    setDescription('')
    setDurationHours('')
    setLocation('')
    setBookingFee('')
    setMaxGroupSize('')
  }

  async function handlePublish(post: Post) {
    setStatus({ state: 'image-step', post })
    try {
      const published = await publishPost(post.post_id)
      resetForm()
      onPublished(published)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not publish — try again.'
      setStatus({ state: 'image-step', post, publishError: message })
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
        duration_hours: durationHours ? Number(durationHours) : undefined,
        location: location || undefined,
        booking_fee: bookingFee,
        max_group_size: Number(maxGroupSize),
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Network error — could not reach the server.'
      setStatus({ state: 'error', message })
      return
    }

    setStatus({ state: 'image-step', post: created })
  }

  if (status.state === 'image-step') {
    return (
      <div className="create-image-step">
        <h2>Add photos <span className="muted">(optional)</span></h2>
        <p className="muted">Tourists book more when they can see what the tour looks like.</p>
        <ManageImages postId={status.post.post_id} />
        {status.publishError && <p role="alert">{status.publishError}</p>}
        <div className="form-actions">
          <button type="button" onClick={() => handlePublish(status.post)}>
            Publish listing
          </button>
          <button type="button" className="secondary" onClick={() => handlePublish(status.post)}>
            Skip — publish anyway
          </button>
        </div>
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
        Duration (hours)
        <input
          type="number"
          min="1"
          step="1"
          placeholder="e.g. 3"
          value={durationHours}
          onChange={(e) => setDurationHours(e.target.value)}
        />
      </label>
      <label>
        Location
        <input
          type="text"
          placeholder="e.g. Old Town, Bangkok"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
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
