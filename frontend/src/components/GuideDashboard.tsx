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
        Create listings on the <Link to="/">home page</Link>, then manage their dates and
        bookings here.
      </p>
      <GuideListings userId={user.user_id} />
      <GuideBookings />
    </div>
  )
}
