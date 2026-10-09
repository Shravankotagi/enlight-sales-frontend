/**
 * Regression: Admin Overview leaderboard labelled most salespersons "Unknown"
 * and counted deals (e.g. 21) instead of the rep's actual orders (e.g. 13).
 * Issue: <add GitHub issue link>
 *
 * Expected: every row shows the employee name, falling back to employee ID
 * and then phone (never "Unknown"); counts come from the same orders data as
 * the Sales Representative Performance section and use "orders" wording.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../renderWithProviders'
import { setAdminDashboardData } from '../adminDashboardMocks'
import AdminDashboard from '../../pages/AdminDashboard'

vi.mock('../../lib/api', async () => (await import('../adminDashboardMocks')).adminApi)

const leaderboard = async () => {
  renderWithProviders(<AdminDashboard />)
  const heading = await screen.findByText('Leaderboard Scores')
  return heading.closest('div.rounded-2xl') as HTMLElement
}

describe('Admin leaderboard identity and order counts', () => {
  beforeEach(() => {
    setAdminDashboardData({
      employees: [
        { name: 'Rishabh Makwana', phone: '+91 98123 45678', role: 'salesperson' },
        { name: '', phone: '9000000001', employee_id: 'EMP-7', role: 'salesperson' },
        { name: '', phone: '9000000002', role: 'sales_lead' },
        { name: 'Admin User', phone: '9999999999', role: 'admin' },
      ],
      orders: [
        { salesperson_phone: '9812345678', stage: 'won' },
        { salesperson_phone: '919812345678', stage: 'won' },
        { salesperson_phone: '+91-98123-45678', stage: 'won' },
      ],
      deals: Array.from({ length: 7 }, () => ({ salesperson_phone: '9812345678', stage: 'quoted' })),
    })
  })

  it('shows a name, employee ID or phone for every salesperson, never "Unknown"', async () => {
    const card = await leaderboard()

    expect(within(card).getByText('Rishabh Makwana')).toBeInTheDocument()
    expect(within(card).getByText('EMP-7')).toBeInTheDocument()
    expect(within(card).getByText('9000000002')).toBeInTheDocument()
    expect(within(card).queryByText('Unknown')).toBeNull()
    expect(within(card).queryByText('Admin User')).toBeNull()
  })

  it('counts orders across phone formats and uses "orders" wording, not deals', async () => {
    const card = await leaderboard()
    const row = within(card).getByText('Rishabh Makwana').closest('div.cursor-pointer') as HTMLElement

    expect(within(row).getByText(/3 orders · 0 visits/)).toBeInTheDocument()
    expect(within(card).queryByText(/deals/i)).toBeNull()
  })
})
