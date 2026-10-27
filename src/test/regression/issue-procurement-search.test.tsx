/**
 * Regression: a procurement person could not find an inquiry from the search box.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

const inquiries = [
  {
    id: 'inq-coil',
    procurement_number: 'PR-10041',
    status: 'review',
    pricing_status: 'awaiting_price',
    inquiry_type: 'inquiry',
    source_channel: 'web_dashboard',
    salesperson_name: 'Akruti',
    delivery_location: 'Pune',
    created_at: '2026-10-15T04:00:00.000Z',
    ai_extraction_json: {
      line_items: [
        { sku_text: 'HR Coil', dimensions: '2.5mm', quantity: 12, unit: 'MT' },
      ],
    },
  },
  {
    id: 'inq-sheet',
    procurement_number: 'PR-10099',
    status: 'review',
    pricing_status: 'awaiting_price',
    inquiry_type: 'inquiry',
    source_channel: 'web_dashboard',
    salesperson_name: 'Shravan',
    delivery_location: 'Ahmedabad',
    created_at: '2026-10-14T04:00:00.000Z',
    ai_extraction_json: {
      line_items: [
        { sku_text: 'GI Sheet', dimensions: '1.2mm', quantity: 4, unit: 'MT' },
      ],
    },
  },
]

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: vi.fn(async () => ({ data: inquiries })),
    getOne: vi.fn(async () => ({ data: inquiries[0] })),
    getLinePricing: vi.fn(async () => ({ data: { lines: [] } })),
  },
  customersApi: { getAll: vi.fn(async () => ({ data: [] })) },
  employeesApi: { getAll: vi.fn(async () => ({ data: [] })) },
  dealsApi: { getAll: vi.fn(async () => ({ data: [] })) },
  productsApi: { getAll: vi.fn(async () => ({ data: [] })) },
}))

describe('procurement inquiry search', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('enlight_token', 'token')
    sessionStorage.setItem(
      'enlight_employee',
      JSON.stringify({
        id: 'proc-1',
        employee_id: 'EMP010',
        name: 'Rishi Mehta',
        phone: '919800000001',
        role: 'procurement_person',
      }),
    )
  })

  it('filters by procurement id and product without a customer name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })

    const search = await screen.findByPlaceholderText(
      'Search procurement id, salesperson, product...',
    )
    expect(await screen.findByText('PR-10041')).toBeInTheDocument()
    expect(screen.getByText('PR-10099')).toBeInTheDocument()

    await user.type(search, 'PR-10041')
    expect(screen.getByText('PR-10041')).toBeInTheDocument()
    expect(screen.queryByText('PR-10099')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'HR Coil')
    expect(screen.getByText('PR-10041')).toBeInTheDocument()
    expect(screen.queryByText('PR-10099')).not.toBeInTheDocument()
  })
})
