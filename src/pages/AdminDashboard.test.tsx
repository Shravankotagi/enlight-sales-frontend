import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../test/renderWithProviders'
import { adminApi, setAdminDashboardData } from '../test/adminDashboardMocks'
import AdminDashboard from './AdminDashboard'

vi.mock('../lib/api', async () => (await import('../test/adminDashboardMocks')).adminApi)

const ASHA = '9200000001'
const BHAVIN = '9200000002'

const leaderboardCard = async () => {
  renderWithProviders(<AdminDashboard />)
  const heading = await screen.findByText('Leaderboard Scores')
  return heading.closest('div.rounded-2xl') as HTMLElement
}

const rowFor = (card: HTMLElement, name: string) =>
  within(card).getByText(name).closest('div.cursor-pointer') as HTMLElement

describe('AdminDashboard leaderboard', () => {
  beforeEach(() => {
    setAdminDashboardData({
      employees: [
        { name: 'Asha', phone: ASHA, role: 'salesperson' },
        { name: 'Bhavin', phone: BHAVIN, role: 'salesperson' },
      ],
      orders: [
        ...Array.from({ length: 5 }, () => ({ salesperson_phone: ASHA, stage: 'won' })),
        { salesperson_phone: BHAVIN, stage: 'won' },
      ],
      visits: Array.from({ length: 8 }, () => ({ salesperson_phone: ASHA })),
      complaints: [
        { reported_by: ASHA, status: 'open' },
        { reported_by: ASHA, status: 'resolved' },
      ],
    })
  })

  it('scores orders (4 pts each, max 40), visits (out of 40, max 30) and open complaints (-10 each)', async () => {
    const card = await leaderboardCard()

    // Asha: 5 orders = 20, 8 visits = 6, 1 open complaint = -10, no tonnage -> 16.
    const asha = rowFor(card, 'Asha')
    expect(within(asha).getByText('5 orders · 8 visits')).toBeInTheDocument()
    expect(within(asha).getByText('16')).toBeInTheDocument()

    // Bhavin: 1 order = 4.
    expect(within(rowFor(card, 'Bhavin')).getByText('4')).toBeInTheDocument()
  })

  it('sorts rows by score, highest first', async () => {
    const card = await leaderboardCard()
    const names = within(card)
      .getAllByText(/^(Asha|Bhavin)$/)
      .map((el) => el.textContent)
    expect(names).toEqual(['Asha', 'Bhavin'])
  })

  it('explains the score in an info popover that closes with Escape', async () => {
    await leaderboardCard()
    const infoButton = screen.getByRole('button', { name: 'How leaderboard scores are calculated' })
    expect(infoButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(infoButton)

    const dialog = screen.getByRole('dialog', { name: 'Leaderboard score calculation' })
    expect(dialog).toHaveTextContent('Won orders: up to 40 points.')
    expect(dialog).toHaveTextContent('Visits: up to 30 points against a 40-visit target.')
    expect(dialog).toHaveTextContent('Pending complaints deduct up to 20 points.')
    expect(infoButton).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Leaderboard score calculation' })).toBeNull()
  })

  it('clicking a row focuses the dashboard on that salesperson', async () => {
    const card = await leaderboardCard()

    fireEvent.click(rowFor(card, 'Bhavin'))

    await waitFor(() => {
      expect(adminApi.ordersApi.getAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ salesperson_phone: BHAVIN }),
      )
    })
    expect(adminApi.reportsApi.getMonthly).toHaveBeenLastCalledWith(
      expect.objectContaining({ salesperson_phone: BHAVIN }),
    )
    await waitFor(() => expect(screen.queryByText('Leaderboard Scores')).toBeNull())
  })
})
