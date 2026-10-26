/**
 * Regression: a per-MT base price was multiplied by piece quantity.
 * 300 Nos at 7.359 MT and ₹200/MT showed ₹60,000 instead of ₹1,471.80.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

const inquiries = [
  {
    id: 'inq-sheet',
    procurement_number: 'PR-10234',
    status: 'review',
    pricing_status: 'awaiting_price',
    inquiry_type: 'inquiry',
    source_channel: 'web_dashboard',
    salesperson_name: 'Akruti',
    delivery_location: 'Ahmedabad, Gujarat',
    created_at: '2026-10-16T04:00:00.000Z',
    ai_extraction_json: {
      delivery_location: 'Ahmedabad, Gujarat',
      line_items: [
        {
          sku_text: 'CR Sheet',
          dimensions: '1250 x 2500 x 1',
          quantity: 300,
          unit: 'Nos',
          weight_mt: 7.359,
        },
      ],
    },
  },
]

const { getAll, getLinePricing } = vi.hoisted(() => ({
  getAll: vi.fn(),
  getLinePricing: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: (...args: unknown[]) => getAll(...args),
    getOne: vi.fn(async () => ({ data: inquiries[0] })),
    getLinePricing: (...args: unknown[]) => getLinePricing(...args),
    saveSalesPricing: vi.fn(),
    saveProcurementPricing: vi.fn(),
  },
  customersApi: { getAll: vi.fn(async () => ({ data: [] })) },
  employeesApi: { getAll: vi.fn(async () => ({ data: [] })) },
  dealsApi: { getAll: vi.fn(async () => ({ data: [] })) },
  productsApi: { getAll: vi.fn(async () => ({ data: [] })) },
}))

function signIn() {
  sessionStorage.clear()
  sessionStorage.setItem('enlight_token', 'token')
  sessionStorage.setItem(
    'enlight_employee',
    JSON.stringify({
      id: 'emp-1',
      employee_id: 'EMP010',
      name: 'Rishi Mehta',
      phone: '919800000001',
      role: 'procurement_person',
    }),
  )
}

describe('procurement per-MT line amount', () => {
  beforeEach(() => {
    getAll.mockReset()
    getAll.mockImplementation(async () => ({
      data: inquiries.map((item) => ({
        ...item,
        ai_extraction_json: {
          ...item.ai_extraction_json,
          line_items: item.ai_extraction_json.line_items.map((line) => ({
            ...line,
            rate: 0,
          })),
        },
      })),
    }))
    getLinePricing.mockReset()
    getLinePricing.mockResolvedValue({ data: { lines: [] } })
  })

  it('prices 300 Nos from the 7.359 MT weight, not from the piece count', async () => {
    signIn()
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
    await user.click(await screen.findByText('PR-10234'))

    expect(await screen.findByDisplayValue('300')).toBeInTheDocument()
    expect(screen.getByDisplayValue('7.359')).toBeInTheDocument()
    expect(screen.getByText(/300 Nos/)).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Enter base price'), '200')

    await screen.findAllByText('1,471.80')
    expect(screen.getAllByText('1,471.80').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('60,000.00')).not.toBeInTheDocument()
    expect(screen.getByText('264.92')).toBeInTheDocument()
    expect(screen.getByText('1,736.72')).toBeInTheDocument()
    expect(screen.getByDisplayValue('300')).toBeInTheDocument()
    expect(screen.getByDisplayValue('7.359')).toBeInTheDocument()
  })
})
