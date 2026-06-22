import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthForm from './AuthForm'
import { AuthProvider } from '../auth/AuthProvider'
import { clearToken } from '../auth/token'
import * as api from '../api'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return { ...actual, login: vi.fn(), register: vi.fn(), getMe: vi.fn() }
})

const mockedApi = vi.mocked(api)

const exampleMe: api.Me = {
  user_id: 'user-1',
  email: 'sam@example.com',
  name: 'Sam',
  bio: null,
  city: null,
  languages: null,
  profile_photo: null,
  avg_rating: null,
  created_at: '2026-06-22T00:00:00Z',
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthForm mode="login" />} />
          <Route path="/" element={<div>home-marker</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AuthForm (login)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    clearToken()
  })

  it('logs in and navigates home on success', async () => {
    const user = userEvent.setup()
    mockedApi.login.mockResolvedValue('jwt-token')
    mockedApi.getMe.mockResolvedValue(exampleMe)

    renderLogin()
    await user.type(screen.getByLabelText(/email/i), 'sam@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('home-marker')).toBeInTheDocument()
    expect(mockedApi.login).toHaveBeenCalledWith({
      email: 'sam@example.com',
      password: 'password123',
    })
  })

  it('shows the server error on bad credentials', async () => {
    const user = userEvent.setup()
    mockedApi.login.mockRejectedValue(new api.ApiError(401, 'invalid credentials'))

    renderLogin()
    await user.type(screen.getByLabelText(/email/i), 'sam@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid credentials')
  })
})
