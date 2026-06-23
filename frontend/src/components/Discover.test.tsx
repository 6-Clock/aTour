import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Discover from './Discover'
import * as api from '../api'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return { ...actual, listPosts: vi.fn() }
})

const mockedApi = vi.mocked(api)

function post(overrides: Partial<api.Post> = {}): api.Post {
  return {
    post_id: 'p1',
    user_id: 'u1',
    title: 'Sunset Food Walk',
    description: null,
    booking_fee: '25.00',
    max_group_size: 6,
    posted: true,
    created_at: '2026-06-22T00:00:00Z',
    cover_image_url: 'https://img/a.jpg',
    ...overrides,
  }
}

function renderDiscover() {
  return render(
    <MemoryRouter>
      <Discover />
    </MemoryRouter>,
  )
}

describe('Discover', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders a panel per tour with cover image and a book link', async () => {
    mockedApi.listPosts.mockResolvedValue([
      post({ post_id: 'p1', title: 'Sunset Food Walk' }),
      post({ post_id: 'p2', title: 'Old Town Hike' }),
    ])
    renderDiscover()

    expect(await screen.findByText('Sunset Food Walk')).toBeInTheDocument()
    expect(screen.getByText('Old Town Hike')).toBeInTheDocument()
    const img = screen.getByAltText('Sunset Food Walk')
    expect(img).toHaveAttribute('src', 'https://img/a.jpg')
    expect(img).toHaveAttribute('loading', 'lazy')
    const links = screen.getAllByRole('link', { name: /view & book/i })
    expect(links[0]).toHaveAttribute('href', '/posts/p1')
  })

  it('shows a fallback panel (no img element) for a post without a cover', async () => {
    mockedApi.listPosts.mockResolvedValue([post({ cover_image_url: null })])
    renderDiscover()

    expect(await screen.findByText('Sunset Food Walk')).toBeInTheDocument()
    expect(screen.queryByAltText('Sunset Food Walk')).not.toBeInTheDocument()
  })

  it('shows an empty state with no tours', async () => {
    mockedApi.listPosts.mockResolvedValue([])
    renderDiscover()
    expect(await screen.findByText(/no tours to discover yet/i)).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    mockedApi.listPosts.mockRejectedValue(new api.ApiError(503, 'database unreachable'))
    renderDiscover()
    expect(await screen.findByRole('alert')).toHaveTextContent('database unreachable')
  })
})
