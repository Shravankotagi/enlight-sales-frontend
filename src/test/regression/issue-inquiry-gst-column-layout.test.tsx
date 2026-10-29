/**
 * Regression: a large GST amount on Inquiry & Audit wrapped the tax label
 * ("IGST" on one line, "18%" under it) and could overlap the Amount column.
 * The same priced line table is what a salesperson, procurement person, and
 * procurement manager open from Inquiries.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

type InquiryRole = 'salesperson' | 'procurement_person' | 'procurement_manager'

const beam = {
  sku_text: 'HR PLATE',
  dimensions: '05X1500X6300MM',
  quantity: 40,
  unit: 'MT',
}

function inquiry(deliveryLocation: string) {
  return {
    id: 'inq-12bdf2',
    procurement_number: 'PR-10270',
    status: 'review',
    pricing_status: 'sales_priced',
    inquiry_type: 'inquiry',
    source_channel: 'web_dashboard',
    salesperson_name: 'Akruti',
    delivery_location: deliveryLocation,
    created_at: '2026-10-28T04:00:00.000Z',
    ai_extraction_json: {
      delivery_location: deliveryLocation,
      line_items: [{ ...beam }],
    },
  }
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

function signIn(role: InquiryRole = 'salesperson') {
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

function savedPricing() {
  return {
    data: {
      success: true,
      data: {
        pricing_status: 'sales_priced',
        lines: [
          {
            line_key: '0:HR PLATE',
            ...beam,
            sales_base_price_per_mt: 4001000,
            rate_per_mt: 4001000,
            line_status: 'priced',
          },
        ],
      },
    },
  }
}

function expectTaxLine(label: string, amount: string) {
  const labelEl = screen.getByText(label)
  expect(labelEl).toHaveClass('whitespace-nowrap')
  expect(labelEl.parentElement).toHaveClass('flex-nowrap')
  const amountEl = labelEl.nextElementSibling
  expect(amountEl).toHaveTextContent(amount)
  expect(amountEl).toHaveClass('whitespace-nowrap')
  const cell = labelEl.closest('td')
  expect(cell).toHaveClass('min-w-[14rem]')
  expect(cell).toHaveClass('w-[18%]')
}

function expectGstColumn() {
  const header = screen.getByRole('columnheader', { name: /GST \(18%\)/ })
  expect(header).toHaveClass('min-w-[14rem]')
  expect(header).toHaveClass('w-[18%]')
  expect(header.closest('table')).toHaveClass('min-w-[1280px]')
}

async function openPricedInquiry(role: InquiryRole, deliveryLocation: string) {
  signIn(role)
  const row = inquiry(deliveryLocation)
  getAll.mockResolvedValue({ data: [row] })
  getOne.mockResolvedValue({ data: row })
  const user = userEvent.setup()
  renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
  await user.click(await screen.findByText('PR-10270'))
}

describe('inquiry GST column layout', () => {
  beforeEach(() => {
    getAll.mockReset()
    getOne.mockReset()
    getLinePricing.mockReset()
    getLinePricing.mockResolvedValue(savedPricing())
  })

  it('keeps a large interstate GST amount on one line with its label', async () => {
    await openPricedInquiry('salesperson', 'Ahmedabad, Gujarat')

    expect(await screen.findByText('IGST 18%')).toBeInTheDocument()
    expectTaxLine('IGST 18%', '2,88,07,200.00')
    expectGstColumn()
  })

  it('keeps large CGST and SGST amounts on one line with their labels', async () => {
    await openPricedInquiry('salesperson', 'Pune, Maharashtra')

    expect(await screen.findByText('CGST 9%')).toBeInTheDocument()
    expectTaxLine('CGST 9%', '1,44,03,600.00')
    expectTaxLine('SGST 9%', '1,44,03,600.00')
    expect(screen.queryByText('IGST 18%')).not.toBeInTheDocument()
    expectGstColumn()
  })

  it.each(['procurement_person', 'procurement_manager'] as const)(
    'keeps a large interstate GST amount inside the column for %s',
    async (role) => {
      await openPricedInquiry(role, 'Ahmedabad, Gujarat')

      expect(await screen.findByText('IGST 18%')).toBeInTheDocument()
      expectTaxLine('IGST 18%', '2,88,07,200.00')
      expectGstColumn()
    },
  )

  it.each(['procurement_person', 'procurement_manager'] as const)(
    'keeps large CGST and SGST amounts inside the column for %s',
    async (role) => {
      await openPricedInquiry(role, 'Pune, Maharashtra')

      expect(await screen.findByText('CGST 9%')).toBeInTheDocument()
      expectTaxLine('CGST 9%', '1,44,03,600.00')
      expectTaxLine('SGST 9%', '1,44,03,600.00')
      expect(screen.queryByText('IGST 18%')).not.toBeInTheDocument()
      expectGstColumn()
    },
  )
})
