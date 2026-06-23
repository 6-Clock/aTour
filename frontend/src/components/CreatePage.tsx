import { Link, useNavigate } from 'react-router-dom'
import CreatePostForm from './CreatePostForm'
import { useAuth } from '../auth/useAuth'

// Dedicated /create page: hosts CreatePostForm and, on successful publish,
// sends the guide straight to their new listing so they can add dates/images.
export default function CreatePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    return (
      <div className="empty-state">
        <p>
          <Link to="/login">Log in</Link> to create a listing.
        </p>
      </div>
    )
  }

  // Render the form as a direct child of .container so it keeps the shared
  // `.container > form` card chrome + 640px width (a wrapper div would break
  // that selector and stretch the form full-width with no card).
  return <CreatePostForm onPublished={(post) => navigate(`/posts/${post.post_id}`)} />
}
