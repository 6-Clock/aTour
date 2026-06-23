import { Link, Navigate, Route, Routes } from 'react-router-dom'
import CreatePage from './components/CreatePage'
import Discover from './components/Discover'
import PostList from './components/PostList'
import PostDetail from './components/PostDetail'
import MyBookings from './components/MyBookings'
import GuideDashboard from './components/GuideDashboard'
import Profile from './components/Profile'
import AuthForm from './components/AuthForm'
import { useAuth } from './auth/useAuth'
import './App.css'

function CompassMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}

function NavBar() {
  const { user, logout } = useAuth()
  return (
    <header className="app-header">
      <Link to="/" className="brand">
        <CompassMark />
        <span className="wordmark">
          a<span>Tour</span>
        </span>
      </Link>
      <nav className="nav">
        <Link to="/discover">Discover</Link>
        {user ? (
          <>
            <Link to="/me/posts">Dashboard</Link>
            <Link to="/bookings">My bookings</Link>
            <Link to="/me" className="who">
              Hi, {user.name}
            </Link>
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

function Hero({ showSignup }: { showSignup: boolean }) {
  return (
    <section className="hero">
      <div className="hero-content">
        <span className="eyebrow">Local guides · real experiences</span>
        <h1>See the world through local eyes</h1>
        <p className="hero-sub">
          Book street-food walks, hikes, and market tours led by people who actually
          live there — vetted, reviewed, and booked in seconds.
        </p>
        <div className="hero-actions">
          <a className="btn btn-accent" href="#browse">
            Explore tours
          </a>
          {showSignup && (
            <Link className="btn btn-ghost" to="/register">
              Become a guide
            </Link>
          )}
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <svg viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="92" fill="rgba(255,255,255,0.06)" />
          <circle cx="100" cy="100" r="70" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
          <circle cx="100" cy="100" r="70" fill="rgba(255,255,255,0.08)" />
          <path d="M124 64L112 112 64 124 76 76z" fill="#fff" />
          <path d="M124 64L100 100 64 124 100 100z" fill="#fb923c" />
          <circle cx="100" cy="100" r="6" fill="#1e3a8a" stroke="#fff" strokeWidth="2" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="100"
              y1="100"
              x2={100 + 70 * Math.cos((deg * Math.PI) / 180)}
              y2={100 + 70 * Math.sin((deg * Math.PI) / 180)}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>
    </section>
  )
}

const FEATURES = [
  {
    title: 'Vetted local guides',
    body: 'Every guide builds a public profile and rating, so you know who you’re booking.',
    icon: (
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    ),
  },
  {
    title: 'Instant booking',
    body: 'Pick an open date and reserve your spot in one tap — no back-and-forth.',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    title: 'Reviews you can trust',
    body: 'Only travelers who completed a tour can leave a review. No fakes.',
    icon: (
      <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z" />
    ),
  },
]

function Features() {
  return (
    <div className="features">
      {FEATURES.map((f) => (
        <div className="feature" key={f.title}>
          <span className="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {f.icon}
            </svg>
          </span>
          <h3>{f.title}</h3>
          <p>{f.body}</p>
        </div>
      ))}
    </div>
  )
}

function Home() {
  const { user } = useAuth()

  return (
    <div className="home">
      <Hero showSignup={!user} />
      <Features />
      <section id="browse">
        <div className="section-head">
          <h2>Browse tours</h2>
          {user ? (
            <Link className="btn btn-accent" to="/create">
              Create a listing
            </Link>
          ) : (
            <span className="muted">
              <Link to="/login">Log in</Link> to host your own.
            </span>
          )}
        </div>
        <PostList />
      </section>
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
            <Route path="/create" element={<CreatePage />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/bookings" element={<MyBookings />} />
            <Route path="/me" element={<Profile />} />
            <Route path="/me/posts" element={<GuideDashboard />} />
            <Route path="/login" element={<AuthForm mode="login" />} />
            <Route path="/register" element={<AuthForm mode="register" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthGate>
      </main>
      <footer className="app-footer">
        <div className="container footer-inner">
          <Link to="/" className="brand">
            <CompassMark />
            <span className="wordmark">
              a<span>Tour</span>
            </span>
          </Link>
          <p>© {new Date().getFullYear()} aTour — discover the world through local eyes.</p>
        </div>
      </footer>
    </>
  )
}
