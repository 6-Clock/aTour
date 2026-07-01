import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// Search state lives in the URL (?title=&location=) rather than local-only
// state, so a search is shareable/bookmarkable and the browser back/forward
// buttons move between search states correctly.
export default function SearchBar() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [title, setTitle] = useState(searchParams.get('title') ?? '')
  const [location, setLocation] = useState(searchParams.get('location') ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next = new URLSearchParams()
    if (title) next.set('title', title)
    if (location) next.set('location', location)
    setSearchParams(next)
  }

  return (
    <form className="search-bar" role="search" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Search tours..."
        aria-label="Search by title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        type="text"
        placeholder="Location..."
        aria-label="Search by location"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <button type="submit" className="secondary">
        Search
      </button>
    </form>
  )
}
