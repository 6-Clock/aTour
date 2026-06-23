import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth/useAuth'

type Mode = 'login' | 'register'

type Status = { state: 'idle' } | { state: 'submitting' } | { state: 'error'; message: string }

export default function AuthForm({ mode }: { mode: Mode }) {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<Status>({ state: 'idle' })

  const isRegister = mode === 'register'

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus({ state: 'submitting' })
    try {
      if (isRegister) {
        await register(email, password, name)
      } else {
        await login(email, password)
      }
      navigate('/')
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Network error — could not reach the server.'
      setStatus({ state: 'error', message })
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>{isRegister ? 'Create your account' : 'Log in'}</h2>
        {isRegister && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isRegister ? 8 : undefined}
          />
        </label>
        <button type="submit" disabled={status.state === 'submitting'}>
          {status.state === 'submitting'
            ? 'Please wait…'
            : isRegister
              ? 'Sign up'
              : 'Log in'}
        </button>
        {status.state === 'error' && <p role="alert">{status.message}</p>}
        <p>
          {isRegister ? (
            <>
              Already have an account? <Link to="/login">Log in</Link>
            </>
          ) : (
            <>
              New here? <Link to="/register">Create an account</Link>
            </>
          )}
        </p>
      </form>
    </div>
  )
}
