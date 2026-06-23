import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PostDetail from './PostDetail'
import * as api from '../api'
import * as useAuthModule from '../auth/useAuth'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return {
    ...actual,
    getPost: vi.fn(),
    listSlots: vi.fn(),
    createBooking: vi.fn(),
    listPostReviews: vi.fn(),
    getUser: vi.fn(),
  }
})
vi.mock('../auth/useAuth')

const mockedApi = vi.mocked(api)
const mockedUseAuth = vi.mocked(useAuthModule)

const examplePost: api.PostDetail = {
  post_id: 'p1',
  user_id: 'guide-1',
  title: 'Sunset Hike',
  description: 'Golden hour on the ridge',
  booking_fee: '25.00',
  max_group_size: 6,
  posted: true,
  created_at: '2026-06-22T00:00:00Z',
  cover_image_url: null,
  images: [],
}

const exampleSlot: api.Slot = {
  slot_id: 's1',
  post_id: 'p1',
  date: '2026-07-01',
  available: true,
}

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

function asUser(user: api.Me | null) {
  mockedUseAuth.useAuth.mockReturnValue({
    user,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  })
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/posts/p1']}>
      <Routes>
        <Route path="/posts/:postId" element={<PostDetail />} />
        <Route path="/login" element={<div>login-marker</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PostDetail booking flow', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedApi.getPost.mockResolvedValue(examplePost)
    mockedApi.listSlots.mockResolvedValue([exampleSlot])
    mockedApi.listPostReviews.mockResolvedValue([])
    mockedApi.getUser.mockResolvedValue({
      user_id: 'guide-1',
      name: 'Guide',
      bio: null,
      city: null,
      languages: null,
      profile_photo: null,
      avg_rating: null,
      created_at: '2026-06-22T00:00:00Z',
    })
  })

  it('books a slot and confirms success', async () => {
    const user = userEvent.setup()
    asUser(exampleMe)
    mockedApi.createBooking.mockResolvedValue({
      booking_id: 'b1',
      slot_id: 's1',
      guide_id: 'guide-1',
      tourist_id: 'tourist-1',
      status: 'pending',
      created_at: '2026-06-22T00:00:00Z',
      post_id: 'p1',
      post_title: 'Test Tour',
      slot_date: '2026-07-01',
    })

    renderDetail()
    await user.click(await screen.findByRole('button', { name: /^book$/i }))

    expect(await screen.findByText(/Booked!/)).toBeInTheDocument()
    expect(mockedApi.createBooking).toHaveBeenCalledWith('s1')
  })

  it('shows the full-slot error from the backend', async () => {
    const user = userEvent.setup()
    asUser(exampleMe)
    mockedApi.createBooking.mockRejectedValue(new api.ApiError(409, 'this slot is full'))

    renderDetail()
    await user.click(await screen.findByRole('button', { name: /^book$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('this slot is full')
  })

  it('redirects a logged-out visitor to login when booking', async () => {
    const user = userEvent.setup()
    asUser(null)

    renderDetail()
    await user.click(await screen.findByRole('button', { name: /^book$/i }))

    expect(await screen.findByText('login-marker')).toBeInTheDocument()
    expect(mockedApi.createBooking).not.toHaveBeenCalled()
  })
})
