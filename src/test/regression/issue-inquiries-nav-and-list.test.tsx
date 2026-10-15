/**
 * Regression: opening Inquiries hid every record and blocked the rest of the sidebar.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import Layout from '../../components/Layout'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

const inquiry = {
  id: 'inq-100',
  status: 'review',
  inquiry_type: 'inquiry',
  source_channel: 'web_dashboard',
  raw_text: 'Need 10 MT HR Coil for Alpha Metals',
  sender_name: 'Alpha Metals',
  customer_name: 'Alpha Metals',
  created_at: '2026-10-01T00:00:00.000Z',
  salesperson_phone: '919200000001',
  ai_extraction_json: {
    customer_name: 'Alpha Metals',
    line_items: [{ sku_text: 'HR Coil', quantity: 10, unit: 'MT' }],
  },
}

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: vi.fn(async () => ({ data: [inquiry] })),
    getLinePricing: vi.fn(async () => ({ data: { lines: [] } })),
  },
  customersApi: { getAll: vi.fn(async () => ({ data: [] })) },
  employeesApi: { getAll: vi.fn(async () => ({ data: [] })) },
  dealsApi: { getAll: vi.fn(async () => ({ data: [] })) },
  productsApi: { getAll: vi.fn(async () => ({ data: [] })) },
}))

function AppShell() {
  return (
    <Layout>
      <Routes>
        <Route path="/inquiries" element={<InquiriesPage />} />
        <Route path="/orders" element={<div>Orders page</div>} />
        <Route path="/home" element={<div>Home page</div>} />
      </Routes>
    </Layout>
  )
}

describe('inquiries list and navigation', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('enlight_token', 'token')
    sessionStorage.setItem(
      'enlight_employee',
      JSON.stringify({
        id: 'admin-1',
        employee_id: 'EMP001',
        name: 'Admin',
        phone: '919100000000',
        role: 'admin',
      }),
    )
  })

  it('shows inquiry records and still opens another tab', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppShell />, { route: '/inquiries' })

    expect(await screen.findByText('Alpha Metals')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Orders' }))
    expect(await screen.findByText('Orders page')).toBeInTheDocument()
  })
})
