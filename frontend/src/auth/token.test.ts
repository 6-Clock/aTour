import { afterEach, describe, expect, it } from 'vitest'
import { clearToken, getToken, setToken } from './token'

afterEach(() => {
  clearToken()
})

describe('token store', () => {
  it('round-trips a token through set/get', () => {
    setToken('jwt-abc')
    expect(getToken()).toBe('jwt-abc')
  })

  it('persists to localStorage under the documented key', () => {
    setToken('jwt-xyz')
    expect(localStorage.getItem('atour_token')).toBe('jwt-xyz')
  })

  it('returns null after clear', () => {
    setToken('jwt-abc')
    clearToken()
    expect(getToken()).toBeNull()
    expect(localStorage.getItem('atour_token')).toBeNull()
  })
})
