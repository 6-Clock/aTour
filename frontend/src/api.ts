import { getToken } from './auth/token'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string

export type Post = {
  post_id: string
  user_id: string
  title: string
  description: string | null
  booking_fee: string
  max_group_size: number
  posted: boolean
  created_at: string
  // First image by display_order (null when the post has none). Used by the
  // browse cards + /discover reels feed.
  cover_image_url: string | null
  guide_name: string | null
}

export type CreatePostInput = {
  title: string
  description?: string
  booking_fee: string
  max_group_size: number
}

export type PostImage = {
  image_id: string
  post_id: string
  image_url: string
  display_order: number
}

export type PostDetail = Post & {
  images: PostImage[]
}

export type Slot = {
  slot_id: string
  post_id: string
  date: string
  available: boolean
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export type Booking = {
  booking_id: string
  slot_id: string
  guide_id: string
  tourist_id: string
  status: BookingStatus
  created_at: string
  // Tour context (from slot -> post) so a booking/review can be labeled with
  // its tour without a separate fetch.
  post_id: string
  post_title: string
  slot_date: string
}

export type Review = {
  review_id: string
  booking_id: string
  rating: number
  comment: string | null
  created_at: string
}

// Public profile (no email) — GET /api/users/{id}. avg_rating is null until the
// guide has received reviews.
export type PublicProfile = {
  user_id: string
  name: string
  bio: string | null
  city: string | null
  languages: string[] | null
  profile_photo: string | null
  avg_rating: number | null
  review_count: number
  tours_completed: number
  created_at: string
}

export type Me = {
  user_id: string
  email: string
  name: string
  bio: string | null
  city: string | null
  languages: string[] | null
  profile_photo: string | null
  avg_rating: number | null
  created_at: string
}

export type RegisterInput = {
  email: string
  password: string
  name: string
}

export type LoginInput = {
  email: string
  password: string
}

type TokenResponse = { access_token: string; token_type: string }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') return body.detail
    return JSON.stringify(body.detail)
  } catch {
    return response.statusText
  }
}

// Single request helper: attaches the JWT (when present) and turns non-2xx
// into an ApiError so callers never branch on response.ok themselves.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response))
  }
  // 204 No Content has no body to parse.
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

// --- auth ---

export async function register(input: RegisterInput): Promise<string> {
  const { access_token } = await request<TokenResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return access_token
}

export async function login(input: LoginInput): Promise<string> {
  const { access_token } = await request<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return access_token
}

export function getMe(): Promise<Me> {
  return request<Me>('/api/users/me')
}

export function getUser(userId: string): Promise<PublicProfile> {
  return request<PublicProfile>(`/api/users/${userId}`)
}

// --- posts ---

export function createPost(input: CreatePostInput): Promise<Post> {
  return request<Post>('/api/posts', { method: 'POST', body: JSON.stringify(input) })
}

export function publishPost(postId: string): Promise<Post> {
  return request<Post>(`/api/posts/${postId}/publish`, { method: 'PATCH' })
}

export function unpublishPost(postId: string): Promise<Post> {
  return request<Post>(`/api/posts/${postId}/unpublish`, { method: 'PATCH' })
}

export function listPosts(): Promise<Post[]> {
  return request<Post[]>('/api/posts')
}

// Owner (authenticated) sees all their posts incl. hidden; the public sees
// only published. Used by the guide dashboard for the current user.
export function listUserPosts(userId: string): Promise<Post[]> {
  return request<Post[]>(`/api/users/${userId}/posts`)
}

export function getPost(postId: string): Promise<PostDetail> {
  return request<PostDetail>(`/api/posts/${postId}`)
}

// --- slots & bookings ---

export function listSlots(postId: string): Promise<Slot[]> {
  return request<Slot[]>(`/api/posts/${postId}/slots`)
}

export function addSlots(postId: string, dates: string[]): Promise<Slot[]> {
  return request<Slot[]>(`/api/posts/${postId}/slots`, {
    method: 'POST',
    body: JSON.stringify({ dates }),
  })
}

export function toggleSlot(slotId: string): Promise<Slot> {
  return request<Slot>(`/api/slots/${slotId}/toggle`, { method: 'PATCH' })
}

export function deleteSlot(slotId: string): Promise<void> {
  return request<void>(`/api/slots/${slotId}`, { method: 'DELETE' })
}

export function createBooking(slotId: string): Promise<Booking> {
  return request<Booking>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify({ slot_id: slotId }),
  })
}

export function listMyBookings(role: 'tourist' | 'guide'): Promise<Booking[]> {
  return request<Booking[]>(`/api/bookings/my?as=${role}`)
}

export function confirmBooking(bookingId: string): Promise<Booking> {
  return request<Booking>(`/api/bookings/${bookingId}/confirm`, { method: 'POST' })
}

export function completeBooking(bookingId: string): Promise<Booking> {
  return request<Booking>(`/api/bookings/${bookingId}/complete`, { method: 'POST' })
}

export function cancelBooking(bookingId: string): Promise<Booking> {
  return request<Booking>(`/api/bookings/${bookingId}/cancel`, { method: 'POST' })
}

// --- reviews ---

export function createReview(
  bookingId: string,
  rating: number,
  comment?: string,
): Promise<Review> {
  return request<Review>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({ booking_id: bookingId, rating, comment: comment || null }),
  })
}

export function listPostReviews(postId: string): Promise<Review[]> {
  return request<Review[]>(`/api/posts/${postId}/reviews`)
}
