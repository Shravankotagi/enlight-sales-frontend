/**
 * Regression: Admin Overview showed inquiries under "Recent Company-wide Deals"
 * and exposed an obsolete "Needs Review" queue.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../renderWithProviders'
import { adminApi, setAdminDashboardData } from '../adminDashboardMocks'
import AdminDashboard from '../../pages/AdminDashboard'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})
vi.mock('../../lib/api', async () => (await import('../adminDashboardMocks')).adminApi)

describe('Admin Overview recent orders', () => {
  beforeEach(() => {
    navigate.mockReset()
    setAdminDashboardData({
      employees: [
        { name: 'Asha Sharma', phone: '9200000001', role: 'salesperson' },
      ],
      orders: [
        {
          id: 'order-35',
          customer_name: 'Alpha Metals',
          po_number: 'EM/PO/35',
          total_amount: 125000,
          salesperson_phone: '9200000001',
          po_status: 'confirmed',
          created_at: '2026-10-09T10:00:00Z',
          deal_items: [{ sku_text: 'Coil', quantity: 1000, unit: 'kg', rate: 125 }],
        },
        {
          id: 'order-33',
          customer_name: 'Beta Steel',
          po_number: 'EM/PO/33',
          total_amount: 90000,
          salesperson_phone: '9200000001',
          status: 'processing',
          created_at: '2026-10-08T10:00:00Z',
          deal_items: [{ sku_text: 'Sheet', quantity: 500, unit: 'kg', rate: 180 }],
        },
      ],
      deals: [{ customer_name: 'This must not render as a recent deal' }],
    })
  })

  it('removes the review queue and renders recent orders with their key fields', async () => {
    renderWithProviders(<AdminDashboard />)

    await screen.findByText('Recent Company-wide Orders')
    expect(screen.queryByText('Needs Review')).toBeNull()
    expect(screen.queryByText('Review Queue')).toBeNull()

    const card = screen.getByText('Recent Company-wide Orders').closest('div.rounded-2xl') as HTMLElement
    const rows = within(card).getAllByText(/EM\/PO\/(35|33)/)
    expect(rows[0]).toHaveTextContent('EM/PO/35')
    expect(card).toHaveTextContent('Alpha Metals')
    expect(card).toHaveTextContent('1 items')
    expect(card).toHaveTextContent('1.00 MT')
    expect(card).toHaveTextContent('Asha Sharma')
    expect(card).toHaveTextContent('₹1,25,000')
    expect(card).toHaveTextContent('confirmed')
    expect(card).not.toHaveTextContent('This must not render as a recent deal')
  })

  it('opens an order on row click and offers a View all link', async () => {
    renderWithProviders(<AdminDashboard />)
    const card = (await screen.findByText('Recent Company-wide Orders')).closest('div.rounded-2xl') as HTMLElement

    fireEvent.click(within(card).getByText('EM/PO/35'))
    expect(navigate).toHaveBeenCalledWith('/orders?orderId=order-35')

    fireEvent.click(within(card).getByRole('button', { name: /view all/i }))
    expect(navigate).toHaveBeenCalledWith('/orders')
  })

  it('requests recent orders with the active dashboard date and salesperson filters', async () => {
    renderWithProviders(<AdminDashboard />)
    await screen.findByText('Recent Company-wide Orders')
    await waitFor(() => {
      expect(adminApi.ordersApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2000-01-01', to: expect.any(String) }),
      )
    })
  })
})
