/**
 * Regression: the inquiry drawer showed two quotation buttons, and the email
 * modal grew past the screen.
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
    status: 'quoted',
    pricing_status: 'sales_priced',
    inquiry_type: 'inquiry',
    source_channel: 'web_dashboard',
    salesperson_name: 'Akruti',
    customer_name: 'Alpha Metals',
    customer_email: 'buyer@alphametals.example',
    delivery_location: 'Pune',
    created_at: '2026-10-15T04:00:00.000Z',
    ai_extraction_json: {
      line_items: [
        { sku_text: 'HR Coil', dimensions: '2.5mm', quantity: 12, unit: 'MT', rate: 11100 },
      ],
    },
  },
]

const { getLinePricing, previewQuotation } = vi.hoisted(() => ({
  getLinePricing: vi.fn(),
  previewQuotation: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: vi.fn(async () => ({ data: inquiries })),
    getOne: vi.fn(async () => ({ data: inquiries[0] })),
    getLinePricing: (...args: unknown[]) => getLinePricing(...args),
    previewQuotation: (...args: unknown[]) => previewQuotation(...args),
    saveSalesPricing: vi.fn(),
    saveProcurementPricing: vi.fn(),
  },
  customersApi: { getAll: vi.fn(async () => ({ data: [] })) },
  employeesApi: { getAll: vi.fn(async () => ({ data: [] })) },
  dealsApi: { getAll: vi.fn(async () => ({ data: [] })) },
  productsApi: { getAll: vi.fn(async () => ({ data: [] })) },
  activityLogsApi: { getAll: vi.fn(async () => ({ data: [] })) },
}))

describe('send quotation button', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('enlight_token', 'token')
    sessionStorage.setItem(
      'enlight_employee',
      JSON.stringify({
        id: 'emp-1',
        employee_id: 'EMP010',
        name: 'Akruti',
        phone: '919800000001',
        role: 'salesperson',
      }),
    )
    getLinePricing.mockReset()
    previewQuotation.mockReset()
    getLinePricing.mockResolvedValue({
      data: {
        success: true,
        data: {
          pricing_status: 'sales_priced',
          lines: [
            {
              line_key: '0:HR Coil',
              sku_text: 'HR Coil',
              quantity: 12,
              unit: 'MT',
              sales_base_price_per_mt: 10000,
              transport_per_mt: 500,
              loading_per_mt: 100,
              margin_per_mt: 500,
              rate_per_mt: 11100,
              line_status: 'priced',
            },
          ],
        },
      },
    })
    previewQuotation.mockResolvedValue({
      data: {
        subject: 'Quotation for Alpha Metals',
        body: 'Please find the quotation attached.',
        cc: [],
        quotation_reference: 'QT-10041',
        sender_email: 'sales@enlightmetals.example',
      },
    })
  })

  it('keeps one quotation button and scrolls the email modal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
    await user.click(await screen.findByText('PR-10041'))

    const quotationButtons = await screen.findAllByRole('button', {
      name: /send quotation|share quotation|share again/i,
    })
    expect(quotationButtons).toHaveLength(1)

    await user.click(quotationButtons[0])
    const dialog = await screen.findByRole('dialog', { name: 'Share Quotation' })
    expect(dialog).toHaveClass('max-h-[90vh]')
    expect(dialog.querySelector('.overflow-y-auto')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Share Quotation Email/ })).toBeInTheDocument()
  })
})
