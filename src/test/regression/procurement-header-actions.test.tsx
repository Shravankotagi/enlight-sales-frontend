/**
 * Regression: procurement accounts saw sales actions on the inquiries header.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: vi.fn(async () => ({ data: [] })),
    getOne: vi.fn(async () => ({ data: {} })),
    getLinePricing: vi.fn(async () => ({ data: { lines: [] } })),
  },
  customersApi: { getAll: vi.fn(async () => ({ data: [] })) },
  employeesApi: { getAll: vi.fn(async () => ({ data: [] })) },
  dealsApi: { getAll: vi.fn(async () => ({ data: [] })) },
  productsApi: { getAll: vi.fn(async () => ({ data: [] })) },
}))

function signIn(role: 'procurement_person' | 'procurement_manager') {
  sessionStorage.clear()
  sessionStorage.setItem('enlight_token', 'token')
  sessionStorage.setItem(
    'enlight_employee',
    JSON.stringify({
      id: 'proc-1',
      employee_id: 'EMP010',
      name: 'Rishi Mehta',
      phone: '919800000001',
      role,
    }),
  )
}

describe('procurement inquiries header', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it.each(['procurement_person', 'procurement_manager'] as const)(
    'hides sales actions for a %s and keeps refresh',
    async (role) => {
      signIn(role)
      renderWithProviders(<InquiriesPage />, { route: '/inquiries' })

      expect(await screen.findByTitle('Refresh Inquiries')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Sync Bigin/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /View Confirmed Orders/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Log New Inquiry/i })).not.toBeInTheDocument()
    },
  )
})
