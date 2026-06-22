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
}

export type CreatePostInput = {
  title: string
  description?: string
  booking_fee: string
  max_group_size: number
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

// --- posts ---

export function createPost(input: CreatePostInput): Promise<Post> {
  return request<Post>('/api/posts', { method: 'POST', body: JSON.stringify(input) })
}

export function publishPost(postId: string): Promise<Post> {
  return request<Post>(`/api/posts/${postId}/publish`, { method: 'PATCH' })
}

export function listPosts(): Promise<Post[]> {
  return request<Post[]>('/api/posts')
}
