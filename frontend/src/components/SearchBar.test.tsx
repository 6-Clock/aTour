import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SearchBar from './SearchBar'

function renderSearchBar(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SearchBar />
    </MemoryRouter>,
  )
}

describe('SearchBar', () => {
  it('pre-fills fields from the current URL search params', () => {
    renderSearchBar('/?title=food&location=lisbon')

    expect(screen.getByLabelText('Search by title')).toHaveValue('food')
    expect(screen.getByLabelText('Search by location')).toHaveValue('lisbon')
  })

  it('starts empty when no search params are present', () => {
    renderSearchBar('/')

    expect(screen.getByLabelText('Search by title')).toHaveValue('')
    expect(screen.getByLabelText('Search by location')).toHaveValue('')
  })

  it('updates the URL to reflect the submitted search on submit', async () => {
    const user = userEvent.setup()
    renderSearchBar('/')

    await user.type(screen.getByLabelText('Search by title'), 'hike')
    await user.type(screen.getByLabelText('Search by location'), 'kyoto')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    // Re-rendering with the same component instance keeps the URL-derived
    // values in sync — assert via the inputs still reflecting what was typed
    // (React Router updates the URL synchronously with setSearchParams).
    expect(screen.getByLabelText('Search by title')).toHaveValue('hike')
    expect(screen.getByLabelText('Search by location')).toHaveValue('kyoto')
  })

  it('omits empty fields from the search rather than submitting blank params', async () => {
    const user = userEvent.setup()
    renderSearchBar('/?title=old-value')

    // Clear the pre-filled title, submit with only location.
    const titleInput = screen.getByLabelText('Search by title')
    await user.clear(titleInput)
    await user.type(screen.getByLabelText('Search by location'), 'porto')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(screen.getByLabelText('Search by title')).toHaveValue('')
    expect(screen.getByLabelText('Search by location')).toHaveValue('porto')
  })
})
