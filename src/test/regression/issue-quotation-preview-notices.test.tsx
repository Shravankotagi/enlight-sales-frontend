// Issue: quotation preview notices
// The exclusion warning and the priced-item count are separate strips.
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InquiryPdfModal from '../../components/InquiryPdfModal'
import { renderWithProviders } from '../renderWithProviders'

vi.mock('../../lib/api', () => ({
  customersApi: { getAll: vi.fn(async () => ({ data: [] })) },
  inquiriesApi: { generatePdf: vi.fn() },
}))

const details = {
  companyName: 'CUSTOMER',
  customerPhone: '',
  productType: '',
  thickness: '',
  width: '',
  length: '',
  productForm: 'Plate' as const,
  quantityTons: 40,
  quantityUnits: 0,
  unitPrice: 4001000,
  totalAmount: 160040000,
  paymentTerms: 'Advance',
  deliveryLocation: 'Pune, Maharashtra',
  lineItems: [
    { sku_text: 'HR PLATE', quantity: 40, unit: 'MT', rate: 4001000, amount: 160040000 },
    { sku_text: 'MS BEAM', quantity: 10, unit: 'MT', rate: 0, amount: 0 },
  ],
}

describe('quotation preview notices', () => {
  it('keeps the exclusion notice and the priced-item count in different strips', async () => {
    renderWithProviders(
      <InquiryPdfModal
        inquiry={{ id: 'inq-1', created_at: '2026-10-27T00:00:00.000Z' }}
        details={details}
        onClose={() => undefined}
      />,
    )

    const exclusion = await screen.findByTestId('quotation-exclusion-notice')
    const included = screen.getByTestId('quotation-included-count')

    expect(exclusion).toHaveTextContent('MS BEAM')
    expect(exclusion).toHaveTextContent('automatically excluded from this quotation PDF')
    expect(exclusion).not.toHaveTextContent('priced item(s) included')
    expect(included).toHaveTextContent('1 priced item(s) included')
    expect(included).not.toHaveTextContent('excluded')
    expect(exclusion.compareDocumentPosition(included) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.getElementById('printable-inquiry-pdf')).not.toContainElement(included)
  })
})
