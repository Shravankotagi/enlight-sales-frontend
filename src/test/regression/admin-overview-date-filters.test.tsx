/**
 * Regression: Admin Overview had a standalone Month filter and lacked
 * calendar presets (this/previous week, month, year).
 * Issue: <add GitHub issue link>
 *
 * Expected: no standalone Month filter; the date control offers the rolling
 * ranges plus This/Previous Week, Month and Year; every preset re-queries the
 * dashboard with the matching from/to range.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../renderWithProviders'
import { adminApi, setAdminDashboardData } from '../adminDashboardMocks'
import AdminDashboard from '../../pages/AdminDashboard'

vi.mock('../../lib/api', async () => (await import('../adminDashboardMocks')).adminApi)

const EXPECTED_PRESETS = [
  'All Time',
  'Today',
  'Last 7 Days',
  'Last 30 Days',
  'Last 90 Days',
  'This Week',
  'Previous Week',
  'This Month',
  'Previous Month',
  'This Year',
  'Previous Year',
  'Custom Range',
]

describe('Admin Overview date filters', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0)) // Friday 9 Oct 2026
    setAdminDashboardData({
      employees: [{ name: 'Asha', phone: '9200000001', role: 'salesperson' }],
    })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('has no standalone Month filter and offers every calendar and rolling preset', async () => {
    renderWithProviders(<AdminDashboard />)
    await screen.findByText('Leaderboard Scores')

    const rangeSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'previous_week'),
    ) as HTMLSelectElement
    expect(Array.from(rangeSelect.options).map((o) => o.textContent)).toEqual(EXPECTED_PRESETS)

    const allOptions = screen.getAllByRole('combobox').flatMap((el) =>
      Array.from((el as HTMLSelectElement).options).map((o) => o.value),
    )
    expect(allOptions).not.toContain('monthly')
    expect(screen.queryByRole('combobox', { name: /month/i })).toBeNull()
  })

  it.each([
    ['this_week', '2026-10-05', '2026-10-09'],
    ['previous_week', '2026-09-28', '2026-10-04'],
    ['this_month', '2026-10-01', '2026-10-09'],
    ['previous_month', '2026-09-01', '2026-09-30'],
    ['this_year', '2026-01-01', '2026-10-09'],
    ['previous_year', '2025-01-01', '2025-12-31'],
    ['30_days', '2026-09-09', '2026-10-09'],
  ])('preset %s re-queries orders, deals and reports for %s to %s', async (preset, from, to) => {
    renderWithProviders(<AdminDashboard />)
    await screen.findByText('Leaderboard Scores')

    const rangeSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'previous_week'),
    ) as HTMLSelectElement
    fireEvent.change(rangeSelect, { target: { value: preset } })

    await waitFor(() => {
      expect(adminApi.ordersApi.getAll).toHaveBeenLastCalledWith({ from, to })
    })
    expect(adminApi.dealsApi.getAll).toHaveBeenLastCalledWith({ from, to })
    expect(adminApi.reportsApi.getMonthly).toHaveBeenLastCalledWith({ from, to })
    expect(adminApi.visitsApi.getAll).toHaveBeenLastCalledWith({ from, to })
  })
})
