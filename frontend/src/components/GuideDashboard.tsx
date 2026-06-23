import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import GuideListings from './GuideListings'
import GuideBookings from './GuideBookings'

export default function GuideDashboard() {
  const { user } = useAuth()

  if (!user) {
    return (
      <p>
        <Link to="/login">Log in</Link> to manage your tours.
      </p>
    )
  }

  return (
    <div>
      <h2>Guide dashboard</h2>
      <p>
        <Link to="/create">Create a listing</Link>, then manage its dates and bookings here.
      </p>
      <GuideListings userId={user.user_id} />
      <GuideBookings />
    </div>
  )
}
