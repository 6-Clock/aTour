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

export async function createPost(input: CreatePostInput): Promise<Post> {
  const response = await fetch(`${API_BASE_URL}/api/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response))
  }
  return response.json()
}

export async function publishPost(postId: string): Promise<Post> {
  const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/publish`, {
    method: 'PATCH',
  })
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response))
  }
  return response.json()
}

export async function listPosts(): Promise<Post[]> {
  const response = await fetch(`${API_BASE_URL}/api/posts`)
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response))
  }
  return response.json()
}
