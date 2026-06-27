import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import CreatePostForm from './CreatePostForm'
import * as api from '../api'

vi.mock('./ManageImages', () => ({
  default: () => <div data-testid="manage-images" />,
}))

// Keep the real ApiError class and only stub the network functions.
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
  duration_hours: null,
  location: null,
  booking_fee: '25.00',
  max_group_size: 6,
  posted: false,
  created_at: '2026-06-20T00:00:00Z',
  cover_image_url: null,
  guide_name: null,
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

  it('transitions to image-step after successful create, without calling publishPost', async () => {
    const user = userEvent.setup()
    mockedApi.createPost.mockResolvedValue(examplePost)
    const onPublished = vi.fn()

    render(<CreatePostForm onPublished={onPublished} />)
    await fillAndSubmit(user)

    expect(await screen.findByText(/add photos/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /publish listing/i })).toBeInTheDocument()
    expect(screen.getByTestId('manage-images')).toBeInTheDocument()
    expect(mockedApi.publishPost).not.toHaveBeenCalled()
    expect(onPublished).not.toHaveBeenCalled()
  })

  it('publishes and calls onPublished when "Publish listing" is clicked', async () => {
    const user = userEvent.setup()
    mockedApi.createPost.mockResolvedValue(examplePost)
    mockedApi.publishPost.mockResolvedValue({ ...examplePost, posted: true })
    const onPublished = vi.fn()

    render(<CreatePostForm onPublished={onPublished} />)
    await fillAndSubmit(user)
    await screen.findByRole('button', { name: /publish listing/i })
    await user.click(screen.getByRole('button', { name: /publish listing/i }))

    await waitFor(() => expect(onPublished).toHaveBeenCalledWith({ ...examplePost, posted: true }))
    expect(mockedApi.publishPost).toHaveBeenCalledWith('post-1')
  })

  it('publishes and calls onPublished when "Skip — publish anyway" is clicked', async () => {
    const user = userEvent.setup()
    mockedApi.createPost.mockResolvedValue(examplePost)
    mockedApi.publishPost.mockResolvedValue({ ...examplePost, posted: true })
    const onPublished = vi.fn()

    render(<CreatePostForm onPublished={onPublished} />)
    await fillAndSubmit(user)
    await screen.findByRole('button', { name: /skip/i })
    await user.click(screen.getByRole('button', { name: /skip/i }))

    await waitFor(() => expect(onPublished).toHaveBeenCalledWith({ ...examplePost, posted: true }))
    expect(mockedApi.publishPost).toHaveBeenCalledWith('post-1')
  })

  it('shows an inline error and stays in image-step when publish fails', async () => {
    const user = userEvent.setup()
    mockedApi.createPost.mockResolvedValue(examplePost)
    mockedApi.publishPost.mockRejectedValue(new api.ApiError(500, 'server error'))
    const onPublished = vi.fn()

    render(<CreatePostForm onPublished={onPublished} />)
    await fillAndSubmit(user)
    await screen.findByRole('button', { name: /publish listing/i })
    await user.click(screen.getByRole('button', { name: /publish listing/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('server error')
    expect(screen.getByRole('button', { name: /publish listing/i })).toBeInTheDocument()
    expect(onPublished).not.toHaveBeenCalled()
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

  it('sends duration_hours and location when filled in', async () => {
    const user = userEvent.setup()
    mockedApi.createPost.mockResolvedValue(examplePost)

    render(<CreatePostForm onPublished={vi.fn()} />)
    await user.type(screen.getByLabelText(/title/i), 'Street Food Walk')
    await user.type(screen.getByLabelText(/duration/i), '3')
    await user.type(screen.getByLabelText(/location/i), 'Bangkok')
    await user.type(screen.getByLabelText(/booking fee/i), '20')
    await user.type(screen.getByLabelText(/max group size/i), '8')
    await user.click(screen.getByRole('button', { name: /create listing/i }))

    await screen.findByText(/add photos/i)
    expect(mockedApi.createPost).toHaveBeenCalledWith(
      expect.objectContaining({ duration_hours: 3, location: 'Bangkok' }),
    )
  })
})
