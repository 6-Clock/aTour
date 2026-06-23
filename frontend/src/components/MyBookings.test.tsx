import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyBookings from './MyBookings'
import * as api from '../api'
import * as useAuthModule from '../auth/useAuth'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return { ...actual, listMyBookings: vi.fn(), cancelBooking: vi.fn(), createReview: vi.fn() }
})
vi.mock('../auth/useAuth')

const mockedApi = vi.mocked(api)
const mockedUseAuth = vi.mocked(useAuthModule)

const exampleMe: api.Me = {
  user_id: 'tourist-1',
  email: 'sam@example.com',
  name: 'Sam',
  bio: null,
  city: null,
  languages: null,
  profile_photo: null,
  avg_rating: null,
  created_at: '2026-06-22T00:00:00Z',
}

function booking(overrides: Partial<api.Booking> = {}): api.Booking {
  return {
    booking_id: 'b1',
    slot_id: 's1',
    guide_id: 'guide-1',
    tourist_id: 'tourist-1',
    status: 'confirmed',
    created_at: '2026-06-22T00:00:00Z',
    post_id: 'p1',
    post_title: 'Sunset Food Walk',
    slot_date: '2026-07-01',
    ...overrides,
  }
}

function asUser(user: api.Me | null) {
  mockedUseAuth.useAuth.mockReturnValue({
    user,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  })
}

function renderBookings() {
  return render(
    <MemoryRouter>
      <MyBookings />
    </MemoryRouter>,
  )
}

describe('MyBookings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows a login prompt when logged out', () => {
    asUser(null)
    renderBookings()
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument()
  })

  it('renders the tour title (linked) and date for each booking', async () => {
    asUser(exampleMe)
    mockedApi.listMyBookings.mockResolvedValue([booking()])
    renderBookings()

    const title = await screen.findByRole('link', { name: 'Sunset Food Walk' })
    expect(title).toHaveAttribute('href', '/posts/p1')
    // Locale-agnostic: assert the year renders (exact month/day format varies by runner).
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('offers a labeled review form only on completed bookings', async () => {
    asUser(exampleMe)
    mockedApi.listMyBookings.mockResolvedValue([booking({ status: 'completed' })])
    renderBookings()

    expect(await screen.findByText(/Reviewing/i)).toHaveTextContent('Sunset Food Walk')
    expect(screen.getByRole('button', { name: /submit review/i })).toBeInTheDocument()
  })

  it('does not show a review form on a non-completed booking', async () => {
    asUser(exampleMe)
    mockedApi.listMyBookings.mockResolvedValue([booking({ status: 'confirmed' })])
    renderBookings()

    await screen.findByRole('link', { name: 'Sunset Food Walk' })
    expect(screen.queryByText(/Reviewing/i)).not.toBeInTheDocument()
  })
})
