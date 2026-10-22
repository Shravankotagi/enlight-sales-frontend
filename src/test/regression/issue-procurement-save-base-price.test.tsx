/**
 * Regression: procurement Save Prices failed silently, and a list refresh
 * put a saved inquiry back to Awaiting Price.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

const line = {
  sku_text: 'CR Sheet',
  dimensions: '1250 x 2500 x 1',
  quantity: 300,
  unit: 'Nos',
  weight_mt: 7.359,
}

const inquiry = {
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
    line_items: [line],
  },
}

const { getAll, getLinePricing, saveProcurementPricing, toastError, toastSuccess } =
  vi.hoisted(() => ({
    getAll: vi.fn(),
    getLinePricing: vi.fn(),
    saveProcurementPricing: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  }))

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}))

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: (...args: unknown[]) => getAll(...args),
    getOne: vi.fn(async () => ({ data: inquiry })),
    getLinePricing: (...args: unknown[]) => getLinePricing(...args),
    saveSalesPricing: vi.fn(),
    saveProcurementPricing: (...args: unknown[]) => saveProcurementPricing(...args),
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

function listPayload(
  pricingStatus = 'awaiting_price',
  deliveryLocation = 'Ahmedabad, Gujarat',
) {
  return {
    data: [
      {
        ...inquiry,
        delivery_location: deliveryLocation,
        pricing_status: pricingStatus,
        ai_extraction_json: {
          ...inquiry.ai_extraction_json,
          delivery_location: deliveryLocation,
          line_items: [{ ...line, rate: 0 }],
        },
      },
    ],
  }
}

describe('procurement save base price', () => {
  beforeEach(() => {
    getAll.mockReset()
    getAll.mockImplementation(async () => listPayload())
    getLinePricing.mockReset()
    getLinePricing.mockResolvedValue({ data: { lines: [] } })
    saveProcurementPricing.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
  })

  it('sends the base price and keeps Price Ready when the list is still stale', async () => {
    signIn()
    saveProcurementPricing.mockResolvedValue({
      data: {
        success: true,
        data: {
          pricing_status: 'price_ready',
          lines: [
            {
              line_key: '0:CR Sheet',
              sku_text: 'CR Sheet',
              quantity: 300,
              unit: 'Nos',
              procurement_base_price_per_mt: 200,
              line_status: 'priced',
            },
          ],
        },
      },
    })
    const user = userEvent.setup()
    const { queryClient } = renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
    await user.click(await screen.findByText('PR-10234'))
    await user.type(await screen.findByPlaceholderText('Enter base price'), '200')
    await user.click(screen.getByRole('button', { name: 'Save Prices' }))

    await waitFor(() => {
      expect(saveProcurementPricing).toHaveBeenCalledWith(
        'inq-sheet',
        expect.objectContaining({
          lines: [expect.objectContaining({ base_price_per_mt: 200 })],
        }),
      )
    })
    expect(toastSuccess).toHaveBeenCalled()
    const readyBadge = () =>
      screen.getAllByText('Price Ready').find((element) => element.tagName === 'SPAN')
    await waitFor(() => {
      expect(readyBadge()).toBeTruthy()
    })

    getAll.mockImplementation(async () =>
      listPayload('awaiting_price', 'Surat, Gujarat'),
    )
    await queryClient.refetchQueries({ queryKey: ['inquiries-list'] })

    expect(await screen.findByDisplayValue('Surat, Gujarat')).toBeInTheDocument()
    expect(readyBadge()?.textContent).toBe('Price Ready')
    expect(screen.getByDisplayValue('200')).toBeInTheDocument()
  })

  it('shows the server error when the save is rejected', async () => {
    signIn()
    saveProcurementPricing.mockRejectedValue({
      response: { data: { message: 'Could not save base prices' } },
    })
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })
    await user.click(await screen.findByText('PR-10234'))
    await user.type(await screen.findByPlaceholderText('Enter base price'), '200')
    await user.click(screen.getByRole('button', { name: 'Save Prices' }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Could not save base prices')
    })
    expect(
      screen.queryAllByText('Price Ready').find((element) => element.tagName === 'SPAN'),
    ).toBeUndefined()
  })
})
