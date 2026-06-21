import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import PostList from './PostList'
import * as api from '../api'

// Keep the real ApiError class (see CreatePostForm.test.tsx for why) and
// only stub the network functions.
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return { ...actual, createPost: vi.fn(), publishPost: vi.fn(), listPosts: vi.fn() }
})

const mockedApi = vi.mocked(api)

const examplePost: api.Post = {
  post_id: 'post-1',
  user_id: 'user-1',
  title: 'Sunset Hike',
  description: 'A lovely walk',
  booking_fee: '25.00',
  max_group_size: 6,
  posted: true,
  created_at: '2026-06-20T00:00:00Z',
}

describe('PostList', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders posts once loaded', async () => {
    mockedApi.listPosts.mockResolvedValue([examplePost])

    render(<PostList refreshKey={0} />)

    expect(await screen.findByText('Sunset Hike')).toBeInTheDocument()
    expect(screen.getByText(/25.00/)).toBeInTheDocument()
  })

  it('shows an empty state with zero published posts', async () => {
    mockedApi.listPosts.mockResolvedValue([])

    render(<PostList refreshKey={0} />)

    expect(await screen.findByText(/no listings published yet/i)).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    mockedApi.listPosts.mockRejectedValue(new api.ApiError(503, 'database unreachable'))

    render(<PostList refreshKey={0} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('database unreachable')
  })
})
