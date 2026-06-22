// Single source of truth for the JWT. Both the non-React fetch wrapper
// (api.ts) and the React AuthContext read/write through here, so the token
// lives in exactly one place.
//
// Stored in localStorage so it survives a page refresh. Tradeoff: localStorage
// is readable by any script on the page, so a successful XSS would expose the
// token (an httpOnly cookie would not). Accepted for now — the backend is a
// bearer-token API (Authorization header), and cookie auth would mean changing
// the server flow. Revisit if real users' data is ever at stake.
const TOKEN_KEY = 'atour_token'

// In-memory cache so api.ts doesn't hit localStorage on every request.
let cached: string | null = null
let loaded = false

export function getToken(): string | null {
  if (!loaded) {
    cached = localStorage.getItem(TOKEN_KEY)
    loaded = true
  }
  return cached
}

export function setToken(token: string): void {
  cached = token
  loaded = true
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  cached = null
  loaded = true
  localStorage.removeItem(TOKEN_KEY)
}
