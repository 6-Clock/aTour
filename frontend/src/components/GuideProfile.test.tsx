import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GuideProfile from './GuideProfile'
import * as api from '../api'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return {
    ...actual,
    getUser: vi.fn(),
    listUserPosts: vi.fn(),
    listUserReviews: vi.fn(),
  }
})

const mockedApi = vi.mocked(api)

const baseProfile: api.PublicProfile = {
  user_id: 'guide-1',
  name: 'Maria Silva',
  bio: 'Local foodie and Lisbon expert',
  city: 'Lisbon',
  languages: ['pt', 'en'],
  profile_photo: null,
  avg_rating: 4.7,
  review_count: 12,
  tours_completed: 8,
  created_at: '2026-01-01T00:00:00Z',
}

const examplePost: api.Post = {
  post_id: 'p1',
  user_id: 'guide-1',
  title: 'Street Food Walk',
  description: 'The best bites in Alfama',
  duration_hours: null,
  location: null,
  booking_fee: '30.00',
  max_group_size: 8,
  posted: true,
  created_at: '2026-06-01T00:00:00Z',
  cover_image_url: null,
  guide_name: 'Maria Silva',
}

const exampleReview: api.Review = {
  review_id: 'r1',
  booking_id: 'b1',
  rating: 5,
  comment: 'Amazing tour!',
  created_at: '2026-06-10T00:00:00Z',
  reviewer_name: 'Alex Tourist',
}

function renderGuide(id = 'guide-1') {
  return render(
    <MemoryRouter initialEntries={[`/guides/${id}`]}>
      <Routes>
        <Route path="/guides/:id" element={<GuideProfile />} />
      </Routes>
    </MemoryRouter>,
  )
}

// This page reverted to pure read-only display (2026-07-01 follow-up) —
// bio/city/languages/photo editing now lives on /me (Profile.tsx) instead,
// since /guides/:id is a public storefront visible to visitors too. See
// artur-B1-design-20260701-025807.md.
describe('GuideProfile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedApi.listUserReviews.mockResolvedValue([])
  })

  it('renders guide name, city chip, bio, rating, and tours completed', async () => {
    mockedApi.getUser.mockResolvedValue(baseProfile)
    mockedApi.listUserPosts.mockResolvedValue([examplePost])
    renderGuide()

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument()
    expect(screen.getByText('Lisbon')).toBeInTheDocument()
    expect(screen.getByText('Local foodie and Lisbon expert')).toBeInTheDocument()
    expect(screen.getByText(/4\.7/)).toBeInTheDocument()
    expect(screen.getByText(/12 reviews/)).toBeInTheDocument()
    expect(screen.getByText(/8 tours completed/)).toBeInTheDocument()
  })

  it('shows "No reviews yet" when avg_rating is null', async () => {
    mockedApi.getUser.mockResolvedValue({ ...baseProfile, avg_rating: null, review_count: 0 })
    mockedApi.listUserPosts.mockResolvedValue([])
    renderGuide()

    expect(await screen.findByText(/no reviews yet/i)).toBeInTheDocument()
  })

  it('shows "No tours listed yet" when guide has no published posts', async () => {
    mockedApi.getUser.mockResolvedValue(baseProfile)
    mockedApi.listUserPosts.mockResolvedValue([])
    renderGuide()

    expect(await screen.findByText(/no tours listed yet/i)).toBeInTheDocument()
  })

  it('renders published tour cards with links to the post', async () => {
    mockedApi.getUser.mockResolvedValue(baseProfile)
    mockedApi.listUserPosts.mockResolvedValue([examplePost])
    renderGuide()

    const link = await screen.findByRole('link', { name: 'Street Food Walk' })
    expect(link).toHaveAttribute('href', '/posts/p1')
  })

  it('shows an error message when the API fails', async () => {
    mockedApi.getUser.mockRejectedValue(new api.ApiError(404, 'user not found'))
    mockedApi.listUserPosts.mockRejectedValue(new api.ApiError(404, 'user not found'))
    renderGuide()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('never shows edit affordances, even for a visitor who owns this profile', async () => {
    mockedApi.getUser.mockResolvedValue(baseProfile)
    mockedApi.listUserPosts.mockResolvedValue([])
    renderGuide('guide-1')

    await screen.findByText('Maria Silva')
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change profile photo' })).not.toBeInTheDocument()
  })

  // --- reviews section ---

  it('renders reviewer name and comment for each review', async () => {
    mockedApi.getUser.mockResolvedValue(baseProfile)
    mockedApi.listUserPosts.mockResolvedValue([])
    mockedApi.listUserReviews.mockResolvedValue([exampleReview])
    renderGuide()

    expect(await screen.findByText('Alex Tourist')).toBeInTheDocument()
    expect(screen.getByText(/Amazing tour!/)).toBeInTheDocument()
  })

  it('shows a booking CTA when there are no reviews', async () => {
    mockedApi.getUser.mockResolvedValue(baseProfile)
    mockedApi.listUserPosts.mockResolvedValue([])
    mockedApi.listUserReviews.mockResolvedValue([])
    renderGuide()

    expect(
      await screen.findByText(/book a tour to be the first to leave a review/i),
    ).toBeInTheDocument()
  })

  it('shows a scoped error when reviews fail to load, without blocking the rest of the page', async () => {
    mockedApi.getUser.mockResolvedValue(baseProfile)
    mockedApi.listUserPosts.mockResolvedValue([examplePost])
    mockedApi.listUserReviews.mockRejectedValue(new api.ApiError(500, 'boom'))
    renderGuide()

    // Profile and tours still render.
    expect(await screen.findByText('Maria Silva')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Street Food Walk' })).toBeInTheDocument()
    // The reviews section shows its own scoped error (the ApiError's message,
    // same convention as the component's top-level error handling).
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((a) => /boom/i.test(a.textContent ?? ''))).toBe(true)
  })
})
