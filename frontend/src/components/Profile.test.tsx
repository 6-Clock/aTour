import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Profile from './Profile'
import * as api from '../api'
import * as useAuthModule from '../auth/useAuth'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return { ...actual, listMyBookings: vi.fn(), listUserPosts: vi.fn() }
})
vi.mock('../auth/useAuth')

const mockedApi = vi.mocked(api)
const mockedUseAuth = vi.mocked(useAuthModule)

const exampleMe: api.Me = {
  user_id: 'u1',
  email: 'sam@example.com',
  name: 'Sam Rivera',
  bio: 'Lifelong local foodie.',
  city: 'Porto',
  languages: ['en', 'pt'],
  profile_photo: null,
  avg_rating: 4.5,
  created_at: '2026-01-15T00:00:00Z',
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

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  )
}

describe('Profile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows a login prompt when logged out', () => {
    asUser(null)
    renderProfile()
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument()
  })

  it('renders the profile header from the auth user', async () => {
    asUser(exampleMe)
    mockedApi.listMyBookings.mockResolvedValue([])
    mockedApi.listUserPosts.mockResolvedValue([])
    renderProfile()

    expect(screen.getByRole('heading', { name: 'Sam Rivera' })).toBeInTheDocument()
    expect(screen.getByText(/Porto/)).toBeInTheDocument()
    expect(screen.getByText(/4\.5 as a guide/)).toBeInTheDocument()
    expect(screen.getByText('Lifelong local foodie.')).toBeInTheDocument()
  })

  it('shows booking and listing counts that link to their pages', async () => {
    asUser(exampleMe)
    mockedApi.listMyBookings.mockResolvedValue([
      { booking_id: 'b1' } as api.Booking,
      { booking_id: 'b2' } as api.Booking,
    ])
    mockedApi.listUserPosts.mockResolvedValue([{ post_id: 'p1' } as api.Post])
    renderProfile()

    // Wait for the counts to load, then locate links by href (robust to how the
    // accessible name concatenates the count span).
    await screen.findByText(/\(2\)/)
    const links = screen.getAllByRole('link')
    const bookingsLink = links.find((l) => l.getAttribute('href') === '/bookings')
    const listingsLink = links.find((l) => l.getAttribute('href') === '/me/posts')
    expect(bookingsLink).toHaveTextContent('My bookings (2)')
    expect(listingsLink).toHaveTextContent('My listings (1)')
  })
})
