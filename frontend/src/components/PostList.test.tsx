import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import PostList from './PostList'
import * as api from '../api'

// PostList renders <Link> to the detail page, so it needs a router context.
function renderList(refreshKey = 0) {
  return render(
    <MemoryRouter>
      <PostList refreshKey={refreshKey} />
    </MemoryRouter>,
  )
}

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
  cover_image_url: null,
  guide_name: null,
}

describe('PostList', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders posts once loaded', async () => {
    mockedApi.listPosts.mockResolvedValue([examplePost])

    renderList()

    expect(await screen.findByText('Sunset Hike')).toBeInTheDocument()
    expect(screen.getByText(/25.00/)).toBeInTheDocument()
  })

  it('shows an empty state with zero published posts', async () => {
    mockedApi.listPosts.mockResolvedValue([])

    renderList()

    expect(await screen.findByText(/no listings published yet/i)).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    mockedApi.listPosts.mockRejectedValue(new api.ApiError(503, 'database unreachable'))

    renderList()

    expect(await screen.findByRole('alert')).toHaveTextContent('database unreachable')
  })

  it('shows a guide name link when guide_name is present', async () => {
    mockedApi.listPosts.mockResolvedValue([
      { ...examplePost, guide_name: 'Maria Silva', user_id: 'guide-1' },
    ])
    renderList()

    const link = await screen.findByRole('link', { name: /maria silva/i })
    expect(link).toHaveAttribute('href', '/guides/guide-1')
  })

  it('shows no guide attribution when guide_name is null', async () => {
    mockedApi.listPosts.mockResolvedValue([{ ...examplePost, guide_name: null }])
    renderList()

    await screen.findByText('Sunset Hike')
    expect(screen.queryByText(/^by /)).not.toBeInTheDocument()
  })
})
