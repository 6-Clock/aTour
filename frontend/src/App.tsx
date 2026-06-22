import { useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import CreatePostForm from './components/CreatePostForm'
import PostList from './components/PostList'
import PostDetail from './components/PostDetail'
import MyBookings from './components/MyBookings'
import GuideDashboard from './components/GuideDashboard'
import AuthForm from './components/AuthForm'
import { useAuth } from './auth/useAuth'
import './App.css'

function NavBar() {
  const { user, logout } = useAuth()
  return (
    <header className="app-header">
      <Link to="/" className="brand">
        a<span>Tour</span>
      </Link>
      <nav className="nav">
        {user ? (
          <>
            <Link to="/me/posts">Dashboard</Link>
            <Link to="/bookings">My bookings</Link>
            <span className="who">Hi, {user.name}</span>
            <button type="button" className="secondary" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  )
}

function Home() {
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div>
      {user ? (
        <CreatePostForm onPublished={() => setRefreshKey((key) => key + 1)} />
      ) : (
        <p>
          <Link to="/login">Log in</Link> to create a listing.
        </p>
      )}
      <h2>Browse tours</h2>
      <PostList refreshKey={refreshKey} />
    </div>
  )
}

// While the initial stored-token check runs, don't flash logged-out UI.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()
  if (loading) return <p>Loading…</p>
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <NavBar />
      <main className="container">
        <AuthGate>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/posts/:postId" element={<PostDetail />} />
            <Route path="/bookings" element={<MyBookings />} />
            <Route path="/me/posts" element={<GuideDashboard />} />
            <Route path="/login" element={<AuthForm mode="login" />} />
            <Route path="/register" element={<AuthForm mode="register" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthGate>
      </main>
    </>
  )
}
