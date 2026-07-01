import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Profile from './Profile'
import * as api from '../api'
import * as useAuthModule from '../auth/useAuth'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return {
    ...actual,
    listMyBookings: vi.fn(),
    listUserPosts: vi.fn(),
    updateMe: vi.fn(),
    uploadProfilePhoto: vi.fn(),
  }
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

const mockRefreshUser = vi.fn()

function asUser(user: api.Me | null) {
  mockedUseAuth.useAuth.mockReturnValue({
    user,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: mockRefreshUser,
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
    expect(screen.getByText('Porto')).toBeInTheDocument()
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

  it('links to the public profile with the correct (non-editable) label', async () => {
    asUser(exampleMe)
    mockedApi.listMyBookings.mockResolvedValue([])
    mockedApi.listUserPosts.mockResolvedValue([])
    renderProfile()

    const link = screen.getByRole('link', { name: 'View public profile' })
    expect(link).toHaveAttribute('href', '/guides/u1')
  })

  // --- inline editing ---

  it('shows always-visible edit affordances for bio, city, languages, and photo', async () => {
    asUser(exampleMe)
    mockedApi.listMyBookings.mockResolvedValue([])
    mockedApi.listUserPosts.mockResolvedValue([])
    renderProfile()

    expect(screen.getByRole('button', { name: 'Edit bio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit city' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit languages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change profile photo' })).toBeInTheDocument()
  })

  it('saves an edited bio via updateMe with just the bio field, then refreshes the user', async () => {
    const user = userEvent.setup()
    asUser(exampleMe)
    mockedApi.listMyBookings.mockResolvedValue([])
    mockedApi.listUserPosts.mockResolvedValue([])
    mockedApi.updateMe.mockResolvedValue({ ...exampleMe, bio: 'Updated bio' })
    renderProfile()

    await user.click(screen.getByRole('button', { name: 'Edit bio' }))
    const textarea = screen.getByRole('textbox', { name: 'bio' })
    await user.clear(textarea)
    await user.type(textarea, 'Updated bio')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mockedApi.updateMe).toHaveBeenCalledWith({ bio: 'Updated bio' })
    expect(mockRefreshUser).toHaveBeenCalled()
  })

  it('uploads a profile photo and refreshes the user on success', async () => {
    const user = userEvent.setup()
    asUser(exampleMe)
    mockedApi.listMyBookings.mockResolvedValue([])
    mockedApi.listUserPosts.mockResolvedValue([])
    mockedApi.uploadProfilePhoto.mockResolvedValue({
      ...exampleMe,
      profile_photo: 'https://test/me.jpg',
    })
    renderProfile()

    const file = new File(['fake-bytes'], 'me.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    expect(mockedApi.uploadProfilePhoto).toHaveBeenCalledWith(file)
    expect(mockRefreshUser).toHaveBeenCalled()
  })

  it('shows an inline error and keeps the pencil available when a save fails', async () => {
    const user = userEvent.setup()
    asUser(exampleMe)
    mockedApi.listMyBookings.mockResolvedValue([])
    mockedApi.listUserPosts.mockResolvedValue([])
    mockedApi.updateMe.mockRejectedValue(new api.ApiError(422, 'city too long'))
    renderProfile()

    await user.click(screen.getByRole('button', { name: 'Edit city' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('city too long')
  })
})
