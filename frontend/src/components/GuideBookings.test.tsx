import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GuideBookings from './GuideBookings'
import * as api from '../api'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>()
  return {
    ...actual,
    listMyBookings: vi.fn(),
    confirmBooking: vi.fn(),
    completeBooking: vi.fn(),
    cancelBooking: vi.fn(),
  }
})

const mockedApi = vi.mocked(api)

function booking(status: api.BookingStatus): api.Booking {
  return {
    booking_id: 'b1',
    slot_id: 's1',
    guide_id: 'guide-1',
    tourist_id: 'tourist-1',
    status,
    created_at: '2026-06-22T00:00:00Z',
    post_id: 'p1',
    post_title: 'Test Tour',
    slot_date: '2026-07-01',
  }
}

describe('GuideBookings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('confirms a pending booking, then offers to complete it', async () => {
    const user = userEvent.setup()
    // mount → pending; after confirm, refresh → confirmed
    mockedApi.listMyBookings
      .mockResolvedValueOnce([booking('pending')])
      .mockResolvedValueOnce([booking('confirmed')])
    mockedApi.confirmBooking.mockResolvedValue(booking('confirmed'))

    render(<GuideBookings />)

    await user.click(await screen.findByRole('button', { name: /confirm/i }))

    expect(await screen.findByRole('button', { name: /mark completed/i })).toBeInTheDocument()
    expect(mockedApi.confirmBooking).toHaveBeenCalledWith('b1')
  })

  it('surfaces a backend error from an action', async () => {
    const user = userEvent.setup()
    mockedApi.listMyBookings.mockResolvedValue([booking('pending')])
    mockedApi.confirmBooking.mockRejectedValue(
      new api.ApiError(422, 'only a pending booking can be confirmed'),
    )

    render(<GuideBookings />)
    await user.click(await screen.findByRole('button', { name: /confirm/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'only a pending booking can be confirmed',
    )
  })
})
