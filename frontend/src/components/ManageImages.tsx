import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../auth/useAuth'
import {
  ApiError,
  addPostImages,
  deletePostImage,
  listPostImages,
  reorderPostImages,
  type PostImage,
} from '../api'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export default function ManageImages({ postId }: { postId: string }) {
  const { user } = useAuth()
  const [images, setImages] = useState<PostImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    listPostImages(postId)
      .then((imgs) => {
        if (!cancelled) {
          setImages(imgs)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load images.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [postId])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (files.length === 0) return

    // Validate all files before starting any upload
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`"${file.name}" is not a supported format. Use JPEG, PNG, or WebP.`)
        return
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`"${file.name}" exceeds the 5 MB limit.`)
        return
      }
    }

    setError(null)
    setUploading(true)

    // Sequential upload (D5): upload one → register with backend → repeat
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : 'Uploading…')

      const userId = user?.user_id ?? 'unknown'
      const path = `${userId}/${postId}/${crypto.randomUUID()}-${file.name}`

      const { error: uploadError } = await supabase.storage.from('tour-images').upload(path, file)

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        setUploading(false)
        setUploadProgress(null)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('tour-images').getPublicUrl(path)

      try {
        const updated = await addPostImages(postId, [publicUrl])
        setImages(updated)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to save image.')
        setUploading(false)
        setUploadProgress(null)
        return
      }
    }

    setUploading(false)
    setUploadProgress(null)
  }

  async function handleDelete(image: PostImage) {
    setError(null)
    try {
      // D6: delete DB record first so the image stops displaying immediately
      await deletePostImage(postId, image.image_id)
      setImages((prev) => prev.filter((img) => img.image_id !== image.image_id))

      // Best-effort Supabase cleanup — a failure here leaves an orphaned file
      // but does not affect the UI (image is already removed from the list)
      const bucketUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/tour-images/`
      const storagePath = image.image_url.replace(bucketUrl, '')
      try {
        await supabase.storage.from('tour-images').remove([storagePath])
      } catch {
        // orphan cleanup failure is acceptable
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed.')
    }
  }

  async function handleReorder(fromIndex: number, direction: 'up' | 'down') {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
    const next = [...images]
    ;[next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]]
    setImages(next)

    try {
      const updated = await reorderPostImages(
        postId,
        next.map((img) => img.image_id),
      )
      setImages(updated)
    } catch (err) {
      setImages(images) // revert on failure
      setError(err instanceof ApiError ? err.message : 'Reorder failed — please refresh.')
    }
  }

  if (loading) return <p className="muted">Loading images…</p>

  return (
    <div className="manage-images">
      <h4>Photos</h4>

      {error && <p role="alert" className="manage-images-error">{error}</p>}

      {images.length === 0 ? (
        <p className="muted">No photos yet. Add some to show tourists what your tour looks like.</p>
      ) : (
        <ul className="image-grid">
          {images.map((img, i) => (
            <li key={img.image_id}>
              {i === 0 && <span className="cover-label">Cover</span>}
              <img src={img.image_url} alt="" className="image-thumb" loading="lazy" />
              <div className="image-controls">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleReorder(i, 'up')}
                  disabled={i === 0 || uploading}
                  aria-label="Move image up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleReorder(i, 'down')}
                  disabled={i === images.length - 1 || uploading}
                  aria-label="Move image down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDelete(img)}
                  disabled={uploading}
                  aria-label="Delete image"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {uploading ? (
        <p className="muted">{uploadProgress}</p>
      ) : (
        <label className="upload-label">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileChange}
          />
          + Add photos
        </label>
      )}
    </div>
  )
}
