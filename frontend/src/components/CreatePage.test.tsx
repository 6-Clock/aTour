import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CreatePage from './CreatePage'
import * as api from '../api'
import * as useAuthModule from '../auth/useAuth'

vi.mock('./ManageImages', () => ({
  default: () => <div data-testid="manage-images" />,
}))

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return { ...actual, createPost: vi.fn(), publishPost: vi.fn() }
})
vi.mock('../auth/useAuth')

const mockedApi = vi.mocked(api)
const mockedUseAuth = vi.mocked(useAuthModule)

const examplePost: api.Post = {
  post_id: 'post-1',
  user_id: 'user-1',
  title: 'Sunset Hike',
  description: null,
  booking_fee: '25.00',
  max_group_size: 6,
  posted: false,
  created_at: '2026-06-20T00:00:00Z',
  cover_image_url: null,
  guide_name: null,
}

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

function asUser(user: api.Me | null) {
  mockedUseAuth.useAuth.mockReturnValue({
    user,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  })
}

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/create']}>
      <Routes>
        <Route path="/create" element={<CreatePage />} />
        <Route path="/posts/:postId" element={<div>listing-page-marker</div>} />
        <Route path="/login" element={<div>login-marker</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CreatePage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('prompts to log in when logged out', () => {
    asUser(null)
    renderCreate()
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument()
  })

  it('navigates to the new listing after create → image-step → publish', async () => {
    const user = userEvent.setup()
    asUser(exampleMe)
    mockedApi.createPost.mockResolvedValue(examplePost)
    mockedApi.publishPost.mockResolvedValue({ ...examplePost, posted: true })

    renderCreate()
    await user.type(screen.getByLabelText(/title/i), 'Sunset Hike')
    await user.type(screen.getByLabelText(/booking fee/i), '25')
    await user.type(screen.getByLabelText(/max group size/i), '6')
    await user.click(screen.getByRole('button', { name: /create listing/i }))

    await screen.findByRole('button', { name: /publish listing/i })
    await user.click(screen.getByRole('button', { name: /publish listing/i }))

    expect(await screen.findByText('listing-page-marker')).toBeInTheDocument()
  })
})
