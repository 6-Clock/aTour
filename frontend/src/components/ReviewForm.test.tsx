import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReviewForm from './ReviewForm'
import * as api from '../api'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return { ...actual, createReview: vi.fn() }
})

const mockedApi = vi.mocked(api)

const exampleReview: api.Review = {
  review_id: 'r1',
  booking_id: 'b1',
  rating: 5,
  comment: null,
  created_at: '2026-06-22T00:00:00Z',
  reviewer_name: null,
}

describe('ReviewForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('submits a review and thanks the user', async () => {
    const user = userEvent.setup()
    mockedApi.createReview.mockResolvedValue(exampleReview)

    render(<ReviewForm bookingId="b1" />)
    await user.click(screen.getByRole('button', { name: /submit review/i }))

    expect(await screen.findByRole('status')).toHaveTextContent('Thanks for your review!')
    expect(mockedApi.createReview).toHaveBeenCalledWith('b1', 5, undefined)
  })

  it('labels which tour is being reviewed when given a title', () => {
    render(<ReviewForm bookingId="b1" postTitle="Sunset Food Walk" />)
    expect(screen.getByText(/Reviewing/i)).toHaveTextContent('Sunset Food Walk')
  })

  it('explains when a booking is already reviewed (409)', async () => {
    const user = userEvent.setup()
    mockedApi.createReview.mockRejectedValue(new api.ApiError(409, 'duplicate'))

    render(<ReviewForm bookingId="b1" />)
    await user.click(screen.getByRole('button', { name: /submit review/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('already reviewed')
  })
})
