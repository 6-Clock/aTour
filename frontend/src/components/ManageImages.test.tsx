import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ManageImages from './ManageImages'
import * as api from '../api'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return {
    ...actual,
    listPostImages: vi.fn(),
    uploadPostImage: vi.fn(),
    deletePostImage: vi.fn(),
    reorderPostImages: vi.fn(),
  }
})

const mockedApi = vi.mocked(api)

const exampleImage = (n: number): api.PostImage => ({
  image_id: `img-${n}`,
  post_id: 'p1',
  image_url: `https://test/img${n}.jpg`,
  display_order: n - 1,
})

function renderManageImages() {
  return render(<ManageImages postId="p1" />)
}

describe('ManageImages', () => {
  beforeEach(() => {
    vi.resetAllMocks()
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
    expect(mockedApi.uploadPostImage).not.toHaveBeenCalled()
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
    expect(mockedApi.uploadPostImage).not.toHaveBeenCalled()
  })

  it('sends file to backend and shows the returned image', async () => {
    mockedApi.listPostImages.mockResolvedValue([])
    mockedApi.uploadPostImage.mockResolvedValue([exampleImage(1)])

    renderManageImages()
    await screen.findByText(/no photos yet/i)

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(mockedApi.uploadPostImage).toHaveBeenCalledWith('p1', file)
    await screen.findByText('Cover')
    expect(document.querySelectorAll('.image-thumb')).toHaveLength(1)
  })

  it('shows error when backend upload fails', async () => {
    mockedApi.listPostImages.mockResolvedValue([])
    mockedApi.uploadPostImage.mockRejectedValue(new api.ApiError(500, 'storage error'))

    renderManageImages()
    await screen.findByText(/no photos yet/i)

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(await screen.findByRole('alert')).toHaveTextContent(/storage error/i)
  })

  it('calls deletePostImage and removes image from UI', async () => {
    const img = exampleImage(1)
    mockedApi.listPostImages.mockResolvedValue([img])
    mockedApi.deletePostImage.mockResolvedValue(undefined)

    renderManageImages()
    await screen.findByText('Cover')

    await userEvent.click(screen.getByRole('button', { name: /delete image/i }))

    expect(mockedApi.deletePostImage).toHaveBeenCalledWith('p1', 'img-1')
    expect(document.querySelectorAll('.image-thumb')).toHaveLength(0)
  })

  it('calls reorderPostImages with swapped IDs when move-up is clicked', async () => {
    mockedApi.listPostImages.mockResolvedValue([exampleImage(1), exampleImage(2)])
    mockedApi.reorderPostImages.mockResolvedValue([exampleImage(2), exampleImage(1)])

    renderManageImages()
    await screen.findByText('Cover')

    const moveUpButtons = screen.getAllByRole('button', { name: /move image up/i })
    await userEvent.click(moveUpButtons[1])

    expect(mockedApi.reorderPostImages).toHaveBeenCalledWith('p1', ['img-2', 'img-1'])
  })
})
