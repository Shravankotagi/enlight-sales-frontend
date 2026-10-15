/**
 * Regression: saved prices vanished, procurement could edit every price column,
 * and a salesperson save left the four price columns open.
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
]

const { getAll, getLinePricing, saveSalesPricing, saveProcurementPricing } = vi.hoisted(() => ({
  getAll: vi.fn(),
  getLinePricing: vi.fn(),
  saveSalesPricing: vi.fn(),
  saveProcurementPricing: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: (...args: unknown[]) => getAll(...args),
    getOne: vi.fn(async () => ({ data: inquiries[0] })),
    getLinePricing: (...args: unknown[]) => getLinePricing(...args),
    saveSalesPricing: (...args: unknown[]) => saveSalesPricing(...args),
    saveProcurementPricing: (...args: unknown[]) => saveProcurementPricing(...args),
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

describe('saved price columns', () => {
  beforeEach(() => {
    getAll.mockReset()
    getAll.mockImplementation(async () => ({
      data: inquiries.map((item) => ({
        ...item,
        ai_extraction_json: {
          line_items: item.ai_extraction_json.line_items.map((line) => ({
            ...line,
            rate: 0,
          })),
        },
      })),
    }))
    getLinePricing.mockReset()
    saveSalesPricing.mockReset()
    saveProcurementPricing.mockReset()
  })

  it('keeps a wrapped base price and gives procurement one editable price column', async () => {
    signIn('procurement_person')
    getLinePricing.mockResolvedValue({
      data: {
        success: true,
        data: {
          pricing_status: 'price_ready',
          lines: [
            {
              line_key: '0:HR Coil',
              sku_text: 'HR Coil',
              quantity: 12,
              unit: 'MT',
              procurement_base_price_per_mt: 61000,
              line_status: 'priced',
            },
          ],
        },
      },
    })
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
    await user.click(await screen.findByText('PR-10041'))

    expect(await screen.findByDisplayValue('61000')).toBeInTheDocument()
    expect(screen.queryByText('Transport *')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Prices' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Save$/ })).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('HR Coil')).toHaveAttribute('readonly')
  })

  it('collapses salesperson price columns into Rate after a wrapped save', async () => {
    signIn('salesperson')
    getLinePricing.mockResolvedValue({ data: { lines: [] } })
    saveSalesPricing.mockResolvedValue({
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
              sales_base_price_per_mt: 62000,
              transport_per_mt: 1000,
              loading_per_mt: 500,
              margin_per_mt: 1500,
              rate_per_mt: 65000,
              line_status: 'priced',
            },
          ],
        },
      },
    })
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
    await user.click(await screen.findByText('PR-10041'))

    const base = await screen.findByPlaceholderText('Enter base price')
    const extras = screen.getAllByPlaceholderText('₹ / MT')
    await user.type(base, '62000')
    await user.type(extras[0], '1000')
    await user.type(extras[1], '500')
    await user.type(extras[2], '1500')
    await user.click(screen.getByRole('button', { name: 'Save Prices' }))

    expect(await screen.findByRole('columnheader', { name: /Rate/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '65,000.00' })).toBeInTheDocument()
    expect(screen.queryByText('Transport *')).not.toBeInTheDocument()
  })

  it('keeps the saved rate when a refresh sends an extraction rate of 0', async () => {
    signIn('salesperson')
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
    const user = userEvent.setup()
    const { queryClient } = renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
    await user.click(await screen.findByText('PR-10041'))
    expect(await screen.findByRole('button', { name: '11,100.00' })).toBeInTheDocument()

    await queryClient.refetchQueries({ queryKey: ['inquiries-list'] })

    expect(screen.getByRole('button', { name: '11,100.00' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '11,100.00' }))
    const base = screen.getByRole('spinbutton', { name: 'Base price' })
    expect(base.closest('div')).toHaveClass('w-72')
  })

  it('lets procurement add a note when the base price is blank', async () => {
    signIn('procurement_person')
    getLinePricing.mockResolvedValue({ data: { lines: [] } })
    saveProcurementPricing.mockResolvedValue({
      data: {
        success: true,
        data: {
          pricing_status: 'unavailable',
          lines: [
            {
              line_key: '0:HR Coil',
              sku_text: 'HR Coil',
              quantity: 12,
              unit: 'MT',
              procurement_base_price_per_mt: null,
              procurement_line_note: 'No stock',
              line_status: 'cannot_price',
            },
          ],
        },
      },
    })
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
    await user.click(await screen.findByText('PR-10041'))

    const note = await screen.findByPlaceholderText('Optional note if unavailable')
    await user.type(note, 'No stock')
    await user.click(screen.getByRole('button', { name: 'Save Prices' }))

    expect(saveProcurementPricing).toHaveBeenCalledWith(
      'inq-coil',
      expect.objectContaining({
        lines: [expect.objectContaining({ line_note: 'No stock', base_price_per_mt: null })],
      }),
    )
  })

  it('shows 18% GST on a saved row that has no stored tax amount', async () => {
    signIn('salesperson')
    getAll.mockImplementation(async () => ({
      data: [
        {
          ...inquiries[0],
          delivery_location: 'Ahmedabad',
          ai_extraction_json: {
            line_items: [
              {
                sku_text: 'HR Coil',
                dimensions: '2.5mm',
                quantity: 12,
                unit: 'MT',
                rate: 10000,
              },
            ],
          },
        },
      ],
    }))
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
              rate_per_mt: 10000,
              line_status: 'priced',
            },
          ],
        },
      },
    })
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
    await user.click(await screen.findByText('PR-10041'))

    expect(await screen.findAllByText('21,600.00')).not.toHaveLength(0)
    expect(screen.getAllByText('1,20,000.00').length).toBeGreaterThan(0)
    expect(screen.getByText('1,41,600.00')).toBeInTheDocument()
  })
})
