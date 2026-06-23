import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import CreatePostForm from './CreatePostForm'
import * as api from '../api'

// Keep the real ApiError class (it's a function under the hood, so plain
// vi.mock('../api') would auto-mock its constructor too) and only stub the
// network functions.
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return { ...actual, createPost: vi.fn(), publishPost: vi.fn(), listPosts: vi.fn() }
})

const mockedApi = vi.mocked(api)

const examplePost: api.Post = {
  post_id: 'post-1',
  user_id: 'user-1',
  title: 'Sunset Hike',
  description: null,
  booking_fee: '25.00',
  max_group_size: 6,
  posted: false,
  created_at: '2026-06-20T00:00:00Z',
  cover_image_url: null,
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/title/i), 'Sunset Hike')
  await user.type(screen.getByLabelText(/booking fee/i), '25')
  await user.type(screen.getByLabelText(/max group size/i), '6')
  await user.click(screen.getByRole('button', { name: /create listing/i }))
}

describe('CreatePostForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates then auto-publishes on success, calling onPublished', async () => {
    const user = userEvent.setup()
    mockedApi.createPost.mockResolvedValue(examplePost)
    mockedApi.publishPost.mockResolvedValue({ ...examplePost, posted: true })
    const onPublished = vi.fn()

    render(<CreatePostForm onPublished={onPublished} />)
    await fillAndSubmit(user)

    await waitFor(() => expect(onPublished).toHaveBeenCalledWith({ ...examplePost, posted: true }))
    expect(mockedApi.publishPost).toHaveBeenCalledWith('post-1')
  })

  it('shows a validation error message when create fails', async () => {
    const user = userEvent.setup()
    mockedApi.createPost.mockRejectedValue(new api.ApiError(422, 'booking_fee must be >= 0'))

    render(<CreatePostForm onPublished={vi.fn()} />)
    await fillAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('booking_fee must be >= 0')
  })

  it('shows a network error message when the server is unreachable', async () => {
    const user = userEvent.setup()
    mockedApi.createPost.mockRejectedValue(new TypeError('Failed to fetch'))

    render(<CreatePostForm onPublished={vi.fn()} />)
    await fillAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Network error')
  })

  it('offers a retry when create succeeds but publish fails, and retry succeeds', async () => {
    const user = userEvent.setup()
    mockedApi.createPost.mockResolvedValue(examplePost)
    mockedApi.publishPost.mockRejectedValueOnce(new api.ApiError(500, 'boom'))
    mockedApi.publishPost.mockResolvedValueOnce({ ...examplePost, posted: true })
    const onPublished = vi.fn()

    render(<CreatePostForm onPublished={onPublished} />)
    await fillAndSubmit(user)

    const retryButton = await screen.findByRole('button', { name: /retry publish/i })
    await user.click(retryButton)

    await waitFor(() => expect(onPublished).toHaveBeenCalledWith({ ...examplePost, posted: true }))
    expect(mockedApi.publishPost).toHaveBeenCalledTimes(2)
  })
})
