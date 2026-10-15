/**
 * Regression: inquiry details showed the wrong quantity, and procurement
 * lost the product lines along with the customer identity.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

const inquiry = {
  id: 'inq-100',
  procurement_number: 'PR-10041',
  status: 'review',
  inquiry_type: 'inquiry',
  source_channel: 'web_dashboard',
  raw_text: 'Need coil for Alpha Metals',
  sender_name: 'Alpha Metals',
  customer_name: 'Alpha Metals',
  delivery_location: 'Pune, Maharashtra',
  created_at: '2026-10-01T00:00:00.000Z',
  salesperson_phone: '919200000001',
  salesperson_name: 'Akruti',
  ai_extraction_json: {
    customer_name: 'Alpha Metals',
    line_items: [
      {
        sku_text: 'HR Coil',
        original_quantity: 12,
        quantity: 1,
        original_unit: 'MT',
        unit: 'KG',
      },
    ],
  },
}

vi.mock('../../lib/api', () => ({
  inquiriesApi: {
    getAll: vi.fn(async () => ({ data: [inquiry] })),
    getOne: vi.fn(async () => ({ data: inquiry })),
    getLinePricing: vi.fn(async () => ({ data: { lines: [] } })),
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
      employee_id: 'EMP001',
      name: role === 'salesperson' ? 'Akruti' : 'Priya',
      phone: '919200000001',
      role,
    }),
  )
}

describe('inquiry details for sales and procurement', () => {
  beforeEach(() => {
    inquiry.customer_name = 'Alpha Metals'
    inquiry.sender_name = 'Alpha Metals'
    inquiry.raw_text = 'Need coil for Alpha Metals'
    inquiry.ai_extraction_json = {
      customer_name: 'Alpha Metals',
      line_items: [
        {
          sku_text: 'HR Coil',
          original_quantity: 12,
          quantity: 1,
          original_unit: 'MT',
          unit: 'KG',
        },
      ],
    }
  })

  it('shows the stored product quantity and procurement number to sales', async () => {
    signIn('salesperson')
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })

    expect(await screen.findByText('Alpha Metals')).toBeInTheDocument()
    expect(screen.getByText('PR-10041')).toBeInTheDocument()
    expect(screen.getByText(/12\.00 MT/)).toBeInTheDocument()
    expect(screen.queryByText(/1\.00 MT/)).not.toBeInTheDocument()

    await user.click(screen.getByText('Alpha Metals'))
    expect(await screen.findByDisplayValue('HR Coil')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('12').length).toBeGreaterThan(0)
    expect(screen.queryByDisplayValue('1')).not.toBeInTheDocument()
    expect(screen.getByText(/Procurement ID: PR-10041/)).toBeInTheDocument()
  })

  it('shows the product to procurement without the customer name', async () => {
    inquiry.customer_name = undefined as unknown as string
    inquiry.sender_name = undefined as unknown as string
    inquiry.raw_text = undefined as unknown as string
    inquiry.ai_extraction_json = {
      line_items: inquiry.ai_extraction_json.line_items,
    }
    signIn('procurement_person')
    const user = userEvent.setup()
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })

    expect(await screen.findByText('PR-10041')).toBeInTheDocument()
    expect(screen.getByText(/12\.00 MT/)).toBeInTheDocument()
    expect(screen.queryByText('Alpha Metals')).not.toBeInTheDocument()

    await user.click(screen.getByText('PR-10041'))
    expect(await screen.findByDisplayValue('HR Coil')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('12').length).toBeGreaterThan(0)
    expect(screen.queryByDisplayValue('1')).not.toBeInTheDocument()
    expect(screen.queryByText('Alpha Metals')).not.toBeInTheDocument()
  })
})
