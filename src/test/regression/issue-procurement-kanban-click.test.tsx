/**
 * Regression: a procurement person had to click Kanban View twice.
 * The first click set the pipeline URL, then the page forced the table back.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: vi.fn(async () => ({
      data: [
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
            line_items: [{ sku_text: 'HR Coil', quantity: 12, unit: 'MT' }],
          },
        },
      ],
    })),
    getOne: vi.fn(),
    getLinePricing: vi.fn(async () => ({ data: { lines: [] } })),
  },
  customersApi: { getAll: vi.fn(async () => ({ data: [] })) },
  employeesApi: { getAll: vi.fn(async () => ({ data: [] })) },
  dealsApi: { getAll: vi.fn(async () => ({ data: [] })) },
  productsApi: { getAll: vi.fn(async () => ({ data: [] })) },
}))

describe('procurement kanban view', () => {
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

  it('opens the pipeline on the first Kanban View click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })

    expect(screen.queryByRole('heading', { name: 'New Inquiry' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Kanban View' }))

    expect(await screen.findByRole('heading', { name: 'New Inquiry' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Price Quote' })).toBeInTheDocument()
  })
})
