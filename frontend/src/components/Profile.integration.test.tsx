import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Profile from './Profile'
import { AuthProvider } from '../auth/AuthProvider'
import { clearToken, setToken } from '../auth/token'
import * as api from '../api'

// Deliberately does NOT mock '../auth/useAuth' — this test wraps the REAL
// AuthProvider so it can prove refreshUser() actually re-fetches and updates
// AuthContext, not just that Profile *called* a mocked function. A mocked
// useAuth would hide exactly the wiring bug this test exists to catch.
// Relocated from GuideProfile.integration.test.tsx (2026-07-01 follow-up):
// editing now lives on /me instead of /guides/:id, so this proof moves here.
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return {
    ...actual,
    getMe: vi.fn(),
    listMyBookings: vi.fn(),
    listUserPosts: vi.fn(),
    updateMe: vi.fn(),
  }
})

const mockedApi = vi.mocked(api)

const baseMe: api.Me = {
  user_id: 'u1',
  email: 'sam@example.com',
  name: 'Sam Rivera',
  bio: 'Old bio',
  city: 'Porto',
  languages: ['pt'],
  profile_photo: null,
  avg_rating: null,
  created_at: '2026-01-15T00:00:00Z',
}

function renderProfile() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Profile + AuthProvider integration', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setToken('fake-jwt')
    mockedApi.getMe.mockResolvedValue(baseMe)
    mockedApi.listMyBookings.mockResolvedValue([])
    mockedApi.listUserPosts.mockResolvedValue([])
  })

  afterEach(() => {
    clearToken()
  })

  it('refreshes AuthContext (re-fetches getMe) after saving a profile edit', async () => {
    const user = userEvent.setup()
    mockedApi.updateMe.mockResolvedValue({ ...baseMe, bio: 'New bio' })

    renderProfile()

    // Wait for AuthProvider's bootstrap getMe() to resolve and the page to render.
    const editBio = await screen.findByRole('button', { name: 'Edit bio' })
    expect(mockedApi.getMe).toHaveBeenCalledTimes(1)

    await user.click(editBio)
    const textarea = screen.getByRole('textbox', { name: 'bio' })
    await user.clear(textarea)
    await user.type(textarea, 'New bio')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mockedApi.updateMe).toHaveBeenCalledWith({ bio: 'New bio' })
    // The real proof: refreshUser() called api.getMe() a second time — a
    // mocked useAuth couldn't tell us this actually happened.
    await waitFor(() => expect(mockedApi.getMe).toHaveBeenCalledTimes(2))
  })
})
