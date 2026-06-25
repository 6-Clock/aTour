import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ManageImages from './ManageImages'
import * as api from '../api'
import * as useAuthModule from '../auth/useAuth'

// Hoist mock functions so vi.mock factory can reference them
const { mockUpload, mockRemove, mockGetPublicUrl } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockRemove: vi.fn(),
  mockGetPublicUrl: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: mockUpload,
        remove: mockRemove,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  },
}))

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return {
    ...actual,
    listPostImages: vi.fn(),
    addPostImages: vi.fn(),
    deletePostImage: vi.fn(),
    reorderPostImages: vi.fn(),
  }
})

vi.mock('../auth/useAuth')

const mockedApi = vi.mocked(api)
const mockedUseAuth = vi.mocked(useAuthModule)

const exampleImage = (n: number): api.PostImage => ({
  image_id: `img-${n}`,
  post_id: 'p1',
  image_url: `https://project.supabase.co/storage/v1/object/public/tour-images/user1/p1/uuid${n}.jpg`,
  display_order: n - 1,
})

function setupAuth() {
  mockedUseAuth.useAuth.mockReturnValue({
    user: {
      user_id: 'user1',
      email: 'guide@example.com',
      name: 'Guide',
      bio: null,
      city: null,
      languages: null,
      profile_photo: null,
      avg_rating: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  })
}

function renderManageImages() {
  return render(<ManageImages postId="p1" />)
}

describe('ManageImages', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupAuth()
  })

  it('shows existing images on mount', async () => {
    mockedApi.listPostImages.mockResolvedValue([exampleImage(1), exampleImage(2)])
    renderManageImages()

    // alt="" makes images decorative (role="presentation") — query by class
    await screen.findByText('Cover')
    expect(document.querySelectorAll('.image-thumb')).toHaveLength(2)
  })

  it('shows empty state when post has no images', async () => {
    mockedApi.listPostImages.mockResolvedValue([])
    renderManageImages()

    expect(await screen.findByText(/no photos yet/i)).toBeInTheDocument()
  })

  it('shows error and skips upload for unsupported file type', async () => {
    mockedApi.listPostImages.mockResolvedValue([])
    renderManageImages()
    await screen.findByText(/no photos yet/i)

    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    // applyAccept: false bypasses input[accept] filtering so we can test our own validation
    await userEvent.upload(input, file, { applyAccept: false })

    expect(await screen.findByRole('alert')).toHaveTextContent(/supported format/i)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('shows error and skips upload when file exceeds 5 MB', async () => {
    mockedApi.listPostImages.mockResolvedValue([])
    renderManageImages()
    await screen.findByText(/no photos yet/i)

    const file = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(screen.getByRole('alert')).toHaveTextContent(/5 MB/i)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('uploads file and registers it with the backend', async () => {
    mockedApi.listPostImages.mockResolvedValue([])
    mockUpload.mockResolvedValue({ data: { path: 'user1/p1/uuid.jpg' }, error: null })
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/tour-images/user1/p1/uuid.jpg' },
    })
    mockedApi.addPostImages.mockResolvedValue([exampleImage(1)])

    renderManageImages()
    await screen.findByText(/no photos yet/i)

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('photo.jpg'),
      file,
    )
    expect(mockedApi.addPostImages).toHaveBeenCalledWith(
      'p1',
      [expect.stringContaining('supabase.co')],
    )
    // alt="" images are decorative — query by class
    await screen.findByText('Cover')
    expect(document.querySelectorAll('.image-thumb')).toHaveLength(1)
  })

  it('shows error when Supabase upload fails and does not call backend', async () => {
    mockedApi.listPostImages.mockResolvedValue([])
    mockUpload.mockResolvedValue({ data: null, error: { message: 'network error' } })

    renderManageImages()
    await screen.findByText(/no photos yet/i)

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(await screen.findByRole('alert')).toHaveTextContent(/network error/i)
    expect(mockedApi.addPostImages).not.toHaveBeenCalled()
  })

  it('deletes DB record first then removes from Supabase storage', async () => {
    const img = exampleImage(1)
    mockedApi.listPostImages.mockResolvedValue([img])
    mockedApi.deletePostImage.mockResolvedValue(undefined)
    mockRemove.mockResolvedValue({ data: null, error: null })

    renderManageImages()
    await screen.findByText('Cover') // wait for images to load

    await userEvent.click(screen.getByRole('button', { name: /delete image/i }))

    expect(mockedApi.deletePostImage).toHaveBeenCalledWith('p1', 'img-1')
    expect(mockRemove).toHaveBeenCalled()
    expect(document.querySelectorAll('.image-thumb')).toHaveLength(0)
  })

  it('calls reorderPostImages with swapped IDs when move-up is clicked', async () => {
    mockedApi.listPostImages.mockResolvedValue([exampleImage(1), exampleImage(2)])
    mockedApi.reorderPostImages.mockResolvedValue([exampleImage(2), exampleImage(1)])

    renderManageImages()
    await screen.findByText('Cover') // wait for images to load

    // Move-up on the second image (index 1)
    const moveUpButtons = screen.getAllByRole('button', { name: /move image up/i })
    await userEvent.click(moveUpButtons[1])

    expect(mockedApi.reorderPostImages).toHaveBeenCalledWith('p1', ['img-2', 'img-1'])
  })
})
