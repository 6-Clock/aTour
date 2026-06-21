import { useState } from 'react'
import CreatePostForm from './components/CreatePostForm'
import PostList from './components/PostList'
import './App.css'

function App() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div>
      <h1>aTour</h1>
      <CreatePostForm onPublished={() => setRefreshKey((key) => key + 1)} />
      <PostList refreshKey={refreshKey} />
    </div>
  )
}

export default App
