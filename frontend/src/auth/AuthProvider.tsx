import { useEffect, useState } from 'react'
import * as api from '../api'
import { clearToken, getToken, setToken } from './token'
import { AuthContext, type AuthState } from './context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<api.Me | null>(null)
  const [loading, setLoading] = useState(getToken() !== null)

  // On first load, if a token is stored, resolve who it belongs to. A stale or
  // expired token (401) is cleared so the app starts cleanly logged out.
  useEffect(() => {
    if (getToken() === null) return
    let cancelled = false
    api
      .getMe()
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        clearToken()
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login: AuthState['login'] = async (email, password) => {
    const token = await api.login({ email, password })
    setToken(token)
    setUser(await api.getMe())
  }

  const register: AuthState['register'] = async (email, password, name) => {
    const token = await api.register({ email, password, name })
    setToken(token)
    setUser(await api.getMe())
  }

  const logout: AuthState['logout'] = () => {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
