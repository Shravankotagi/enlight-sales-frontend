// Issue: procurement line items
// A procurement person or manager prices existing lines and cannot add, remove, or edit them.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

const lines = [
  { sku_text: 'HR PLATE', dimensions: '05X1500X6300MM', quantity: 40, unit: 'MT' },
  { sku_text: 'MS BEAM', dimensions: '5x1250x87', quantity: 10, unit: 'MT' },
]

const inquiry = {
  id: 'inq-priced',
  procurement_number: 'PR-10278',
  status: 'review',
  pricing_status: 'sales_priced',
  inquiry_type: 'inquiry',
  source_channel: 'web_dashboard',
  salesperson_name: 'Akruti',
  delivery_location: 'Pune, Maharashtra',
  created_at: '2026-10-28T04:00:00.000Z',
  ai_extraction_json: {
    delivery_location: 'Pune, Maharashtra',
    line_items: lines,
  },
}

const { getAll, getLinePricing, getOne } = vi.hoisted(() => ({
  getAll: vi.fn(),
  getLinePricing: vi.fn(),
  getOne: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: (...args: unknown[]) => getAll(...args),
    getOne: (...args: unknown[]) => getOne(...args),
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
      name: role === 'salesperson' ? 'Akruti' : 'Rishi Mehta',
      phone: '919800000001',
      role,
    }),
  )
}

async function openPricedInquiry(role: 'salesperson' | 'procurement_person' | 'procurement_manager') {
  signIn(role)
  getAll.mockResolvedValue({ data: [inquiry] })
  getOne.mockResolvedValue({ data: inquiry })
  const user = userEvent.setup()
  renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
  await user.click(await screen.findByText('PR-10278'))
  expect(await screen.findByRole('columnheader', { name: /GST \(18%\)/ })).toBeInTheDocument()
}

describe('procurement line item controls', () => {
  beforeEach(() => {
    getAll.mockReset()
    getOne.mockReset()
    getLinePricing.mockReset()
    getLinePricing.mockResolvedValue({
      data: {
        success: true,
        data: {
          pricing_status: 'sales_priced',
          lines: lines.map((line) => ({
            line_key: `0:${line.sku_text}`,
            ...line,
            sales_base_price_per_mt: 4001000,
            rate_per_mt: 4001000,
            line_status: 'priced',
          })),
        },
      },
    })
  })

  it.each(['procurement_person', 'procurement_manager'] as const)(
    'does not let %s add, remove, or edit product lines',
    async (role) => {
      await openPricedInquiry(role)

      expect(screen.queryByRole('button', { name: 'Add line item' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remove line item' })).not.toBeInTheDocument()
      for (const brand of screen.getAllByRole('button', { name: 'Select make' })) {
        expect(brand).toBeDisabled()
      }
      const units = screen.getAllByRole('combobox').filter((element) =>
        Array.from(element.querySelectorAll('option')).some((option) => option.value === 'MT'),
      )
      expect(units).toHaveLength(2)
      for (const unit of units) expect(unit).toBeDisabled()
    },
  )

  it('still lets a salesperson add a line item', async () => {
    await openPricedInquiry('salesperson')

    expect(screen.getByRole('button', { name: 'Add line item' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: 'Remove line item' }).length).toBeGreaterThan(0)
    for (const brand of screen.getAllByRole('button', { name: 'Select make' })) {
      expect(brand).toBeEnabled()
    }
  })
})
