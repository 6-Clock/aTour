import { createContext } from 'react'
import type { Me } from '../api'

export type AuthState = {
  // null = logged out. undefined while we're still bootstrapping a stored token.
  user: Me | null
  // True only during the initial "do we have a valid stored token?" check.
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  // Re-fetches the current user so edits made elsewhere (e.g. GuideProfile's
  // inline edit) are reflected here instead of going stale until reload/re-login.
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
