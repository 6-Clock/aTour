import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listUserReviews, updateMe, uploadProfilePhoto } from './api'
import { clearToken } from './auth/token'

function mockFetchOnce(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('api.ts — new guide-profile functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    clearToken()
  })

  it('listUserReviews hits GET /api/users/{id}/reviews', async () => {
    const fetchMock = mockFetchOnce([])
    vi.stubGlobal('fetch', fetchMock)

    await listUserReviews('guide-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/users/guide-1/reviews')
    expect(init?.method ?? 'GET').toBe('GET')
  })

  it('updateMe hits PUT /api/users/me with a JSON body', async () => {
    const fetchMock = mockFetchOnce({ user_id: 'guide-1' })
    vi.stubGlobal('fetch', fetchMock)

    await updateMe({ bio: 'New bio' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/users/me')
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(JSON.stringify({ bio: 'New bio' }))
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
  })

  it('uploadProfilePhoto hits POST /api/users/me/photo with a FormData body', async () => {
    const fetchMock = mockFetchOnce({ user_id: 'guide-1', profile_photo: 'https://x/y.jpg' })
    vi.stubGlobal('fetch', fetchMock)

    const file = new File(['fake-bytes'], 'me.jpg', { type: 'image/jpeg' })
    await uploadProfilePhoto(file)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/users/me/photo')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBe(file)
    // FormData bodies must NOT get a manual Content-Type — the browser sets
    // the multipart boundary itself.
    expect(new Headers(init.headers).get('Content-Type')).toBeNull()
  })
})
