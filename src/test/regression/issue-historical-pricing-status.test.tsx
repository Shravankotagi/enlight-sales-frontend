/**
 * Regression: every existing inquiry was labeled Awaiting Price.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import InquiriesPage from '../../pages/InquiriesPage'
import { renderWithProviders } from '../renderWithProviders'

const inquiries = [
  {
    id: 'old-1',
    status: 'won',
    stage: 'won',
    display_stage: 'won',
    customer_name: 'Old Metals',
    created_at: '2026-08-01T00:00:00.000Z',
    inquiry_type: 'inquiry',
    source_channel: 'web_dashboard',
    raw_text: 'Old coil order',
    salesperson_name: 'Akruti',
  },
  {
    id: 'new-1',
    status: 'review',
    display_stage: 'new_inquiry',
    pricing_status: 'awaiting_price',
    customer_name: 'New Metals',
    created_at: '2026-10-15T04:00:00.000Z',
    inquiry_type: 'inquiry',
    source_channel: 'web_dashboard',
    raw_text: 'New coil inquiry',
    salesperson_name: 'Akruti',
    ai_extraction_json: {
      customer_name: 'New Metals',
      line_items: [{ sku_text: 'HR Coil', quantity: 4, unit: 'MT' }],
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

describe('historical inquiry status', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('enlight_token', 'token')
    sessionStorage.setItem(
      'enlight_employee',
      JSON.stringify({
        id: 'sp-1',
        employee_id: 'EMP001',
        name: 'Akruti',
        phone: '919200000001',
        role: 'salesperson',
      }),
    )
  })

  it('keeps the old deal status and marks only a new inquiry as awaiting price', async () => {
    renderWithProviders(<InquiriesPage />, { route: '/inquiries' })

    expect(await screen.findByText('Old Metals')).toBeInTheDocument()
    expect(screen.getByText('Won')).toBeInTheDocument()
    expect(screen.getByText('New Metals')).toBeInTheDocument()
    expect(screen.getAllByText('Awaiting Price')).toHaveLength(2)
  })
})
