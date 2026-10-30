/**
 * Regression: procurement had no place to see which Price Ready inquiry
 * changed tonnage.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

const inquiry = {
  id: 'inq-coil',
  procurement_number: 'PR-10041',
  status: 'review',
  pricing_status: 'awaiting_price',
  tonnage_review_open: true,
  tonnage_review: {
    changed_at: '2026-10-21T04:30:00.000Z',
    previous_total_mt: 12,
    next_total_mt: 18,
    lines: [{ sku_text: 'HR Coil', from_mt: 12, to_mt: 18 }],
  },
  inquiry_type: 'inquiry',
  source_channel: 'web_dashboard',
  salesperson_name: 'Akruti',
  delivery_location: 'Pune',
  created_at: '2026-10-20T04:00:00.000Z',
  ai_extraction_json: {
    line_items: [
      { sku_text: 'HR Coil', dimensions: '2.5mm', quantity: 18, unit: 'MT' },
    ],
  },
}

const review = {
  id: 'inq-coil',
  procurement_number: 'PR-10041',
  salesperson_name: 'Akruti',
  changed_at: '2026-10-21T04:30:00.000Z',
  previous_total_mt: 12,
  next_total_mt: 18,
  lines: [{ sku_text: 'HR Coil', from_mt: 12, to_mt: 18 }],
}

const { getAll, getTonnageReviews } = vi.hoisted(() => ({
  getAll: vi.fn(),
  getTonnageReviews: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: (...args: unknown[]) => getAll(...args),
    getOne: vi.fn(async () => ({ data: inquiry })),
    getLinePricing: vi.fn(async () => ({ data: { lines: [] } })),
    getTonnageReviews: (...args: unknown[]) => getTonnageReviews(...args),
    saveProcurementPricing: vi.fn(),
  },
  customersApi: { getAll: vi.fn(async () => ({ data: [] })) },
  employeesApi: { getAll: vi.fn(async () => ({ data: [] })) },
  dealsApi: { getAll: vi.fn(async () => ({ data: [] })) },
  productsApi: { getAll: vi.fn(async () => ({ data: [] })) },
}))

function signIn(role: string) {
  sessionStorage.clear()
  sessionStorage.setItem('enlight_token', 'token')
  sessionStorage.setItem(
    'enlight_employee',
    JSON.stringify({
      id: 'emp-1',
      employee_id: 'EMP010',
      name: role === 'procurement_person' ? 'Rishi Mehta' : 'Akruti',
      phone: '919800000001',
      role,
    }),
  )
}

describe('procurement tonnage updates', () => {
  beforeEach(() => {
    getAll.mockReset()
    getAll.mockResolvedValue({ data: [inquiry] })
    getTonnageReviews.mockReset()
    getTonnageReviews.mockResolvedValue({ data: [review] })
  })

  it('shows the changed inquiry beside Refresh and opens it for a new base price', async () => {
    signIn('procurement_person')
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })

    const bell = await screen.findByRole('button', { name: 'Tonnage updates' })
    const refresh = screen.getByTitle('Refresh Inquiries')
    expect(
      bell.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(await screen.findByLabelText('1 open tonnage update')).toHaveTextContent('1')

    await user.click(bell)
    const panelRow = await screen.findByRole('button', { name: /PR-10041/ })
    expect(panelRow).toHaveTextContent('Akruti')
    expect(panelRow).toHaveTextContent('12 MT → 18 MT')
    expect(panelRow).toHaveTextContent('HR Coil')

    await user.click(panelRow)
    expect(
      await screen.findByText(/Tonnage changed from 12 MT to 18 MT/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Prices' })).toBeInTheDocument()
  })

  it('keeps the bell without a badge when nothing has changed', async () => {
    signIn('procurement_person')
    getTonnageReviews.mockResolvedValue({ data: [] })
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })

    await user.click(await screen.findByRole('button', { name: 'Tonnage updates' }))
    expect(await screen.findByText('No tonnage updates')).toBeInTheDocument()
    expect(screen.queryByLabelText(/open tonnage/)).not.toBeInTheDocument()
  })

  it('does not show the bell to a salesperson', async () => {
    signIn('salesperson')
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })

    await screen.findByTitle('Refresh Inquiries')
    expect(
      screen.queryByRole('button', { name: 'Tonnage updates' }),
    ).not.toBeInTheDocument()
  })
})
