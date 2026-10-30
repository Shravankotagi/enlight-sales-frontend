// Issue: procurement drawer totals
// A procurement person or manager sees Sub Total only. Sales still sees GST and the grand total.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

const inquiry = {
  id: 'inq-plate',
  procurement_number: 'PR-10275',
  status: 'review',
  pricing_status: 'awaiting_price',
  inquiry_type: 'inquiry',
  source_channel: 'web_dashboard',
  salesperson_name: 'Shravan',
  delivery_location: 'Pune, Maharashtra',
  created_at: '2026-10-29T07:07:00.000Z',
  ai_extraction_json: {
    delivery_location: 'Pune, Maharashtra',
    line_items: [
      { sku_text: 'HR PLATE', dimensions: '05X1500X6300MM', quantity: 40, unit: 'MT' },
    ],
  },
}

const { getAll, getLinePricing } = vi.hoisted(() => ({
  getAll: vi.fn(),
  getLinePricing: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: (...args: unknown[]) => getAll(...args),
    getOne: vi.fn(async () => ({ data: inquiry })),
    getLinePricing: (...args: unknown[]) => getLinePricing(...args),
    getTonnageReviews: vi.fn(async () => ({ data: [] })),
    saveSalesPricing: vi.fn(),
    saveProcurementPricing: vi.fn(),
  },
  customersApi: { getAll: vi.fn(async () => ({ data: [] })) },
  employeesApi: { getAll: vi.fn(async () => ({ data: [] })) },
  dealsApi: { getAll: vi.fn(async () => ({ data: [] })) },
  productsApi: { getAll: vi.fn(async () => ({ data: [] })) },
  activityLogsApi: { getAll: vi.fn(async () => ({ data: [] })) },
}))

function signIn(role: 'salesperson' | 'procurement_person' | 'procurement_manager') {
  sessionStorage.clear()
  sessionStorage.setItem('enlight_token', 'token')
  sessionStorage.setItem(
    'enlight_employee',
    JSON.stringify({
      id: 'emp-1',
      employee_id: 'EMP010',
      name: role === 'salesperson' ? 'Shravan' : 'Rishi Mehta',
      phone: '919800000001',
      role,
    }),
  )
}

async function openInquiry(role: 'salesperson' | 'procurement_person' | 'procurement_manager') {
  signIn(role)
  const user = userEvent.setup()
  renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
  await user.click(await screen.findByText('PR-10275'))
  expect(await screen.findByText('Sub Total')).toBeInTheDocument()
}

describe('procurement drawer subtotal', () => {
  beforeEach(() => {
    getAll.mockReset()
    getLinePricing.mockReset()
    getAll.mockResolvedValue({ data: [inquiry] })
    getLinePricing.mockResolvedValue({
      data: { success: true, data: { pricing_status: 'awaiting_price', lines: [] } },
    })
  })

  it.each(['procurement_person', 'procurement_manager'] as const)(
    'shows %s the subtotal without GST or a grand total',
    async (role) => {
      await openInquiry(role)

      expect(screen.getByText('Sub Total')).toBeInTheDocument()
      expect(screen.queryByText('CGST (9%)')).not.toBeInTheDocument()
      expect(screen.queryByText('SGST (9%)')).not.toBeInTheDocument()
      expect(screen.queryByText('IGST (18%)')).not.toBeInTheDocument()
      expect(screen.queryByText('Total', { exact: true })).not.toBeInTheDocument()
    },
  )

  it('uses the saved base price for a Price Ready subtotal', async () => {
    signIn('procurement_person')
    const priced = {
      ...inquiry,
      id: 'inq-coil',
      procurement_number: 'PR-10254',
      pricing_status: 'price_ready',
      ai_extraction_json: {
        delivery_location: 'Pune, Maharashtra',
        line_items: [
          { sku_text: 'HR Coil', dimensions: '3mm', quantity: 30, unit: 'MT', rate: null, amount: null },
        ],
      },
    }
    getAll.mockResolvedValue({ data: [priced] })
    getLinePricing.mockResolvedValue({
      data: {
        success: true,
        data: {
          pricing_status: 'price_ready',
          lines: [
            {
              line_key: '0:HR Coil',
              sku_text: 'HR Coil',
              quantity: 30,
              unit: 'MT',
              procurement_base_price_per_mt: 20000,
              line_status: 'priced',
            },
          ],
        },
      },
    })
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
    await user.click(await screen.findByText('PR-10254'))

    const subtotal = await screen.findByText('Sub Total')
    expect(subtotal.parentElement).toHaveTextContent('6,00,000.00')
    expect(screen.getAllByText('6,00,000.00').length).toBeGreaterThan(1)
  })

  it('still shows a salesperson the GST rows and the total', async () => {
    await openInquiry('salesperson')

    expect(screen.getByText('Sub Total')).toBeInTheDocument()
    expect(screen.getByText('CGST (9%)')).toBeInTheDocument()
    expect(screen.getByText('SGST (9%)')).toBeInTheDocument()
    expect(screen.getByText('Total', { exact: true })).toBeInTheDocument()
  })
})
