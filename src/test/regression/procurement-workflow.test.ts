/**
 * Procurement workflow contract for person, manager, and salesperson views.
 * Issue: <add GitHub issue link>
 */
import { describe, expect, it } from 'vitest'
import {
  applyServerLines,
  inquiryPricingStatusLabel,
  inquiryStatusFromServer,
  mergeDrawerLineRates,
  pricingResult,
  requestFromInquiry,
} from '../../lib/procurementMock'
import { getGstSplit } from '../../utils/procurementPricing'

const inquiry = {
  id: 'abc123def',
  procurement_number: 'PR-10007',
  pricing_status: 'price_ready',
  salesperson_name: 'Akruti',
  delivery_location: 'Pune, Maharashtra',
  customer_name: 'Alpha Metals',
  raw_text: 'Need coil for Alpha Metals',
  ai_extraction_json: {
    customer_name: 'Alpha Metals',
    line_items: [
      { sku_text: 'HR Coil', quantity: 2, unit: 'MT' },
      { sku_text: 'GI Sheet', quantity: 500, unit: 'KG' },
    ],
  },
}

describe('procurement workflow', () => {
  it('does not put customer identity on the procurement request', () => {
    const request = requestFromInquiry(inquiry)
    expect(JSON.stringify(request)).not.toContain('Alpha Metals')
    expect(request.id).toBe('PR-10007')
    expect(request.id).not.toContain('ABC123')
    expect(request.salesperson_name).toBe('Akruti')
    expect(request.line_items).toHaveLength(2)
  })

  it('shows Price Ready for a partial save and keeps an unavailable line out of the quote fields', () => {
    expect(inquiryStatusFromServer({ pricing_status: 'price_ready' })).toBe('price_ready')
    expect(inquiryPricingStatusLabel.price_ready).toBe('Price Ready')
    expect(inquiryStatusFromServer({ pricing_status: 'unavailable' })).toBe('unavailable')
    expect(inquiryStatusFromServer({})).toBeNull()
    expect(inquiryStatusFromServer({ pricing_status: 'awaiting_price' })).toBe('awaiting_price')

    const view = applyServerLines(
      { ...inquiry, pricing_status: 'sales_priced' },
      [
        {
          line_key: '0:HR Coil',
          sku_text: 'HR Coil',
          quantity: 2,
          unit: 'MT',
          procurement_base_price_per_mt: 61000,
          sales_base_price_per_mt: 62000,
          transport_per_mt: 1000,
          loading_per_mt: 500,
          margin_per_mt: 1500,
          line_status: 'priced',
        },
        {
          line_key: '1:GI Sheet',
          sku_text: 'GI Sheet',
          quantity: 500,
          unit: 'KG',
          line_status: 'cannot_price',
          procurement_line_note: 'No stock',
        },
      ],
    )

    const wrapped = pricingResult({
      data: {
        success: true,
        data: {
          pricing_status: 'price_ready',
          lines: [
            {
              line_key: '0:HR Coil',
              sku_text: 'HR Coil',
              quantity: 2,
              unit: 'MT',
              procurement_base_price_per_mt: 61000,
              line_status: 'priced',
            },
          ],
        },
      },
    })
    const kept = applyServerLines(
      { ...inquiry, pricing_status: wrapped.pricing_status },
      wrapped.lines,
    )
    expect(kept.pricing.saved).toBe(false)
    expect(kept.pricing.lines[0].basePricePerMt).toBe(61000)

    const sales = pricingResult({
      data: {
        data: {
          pricing_status: 'sales_priced',
          lines: [
            {
              rate_per_mt: 65000,
              sales_base_price_per_mt: 62000,
              transport_per_mt: 1000,
              loading_per_mt: 500,
              margin_per_mt: 1500,
            },
          ],
        },
      },
    })
    const collapsed = applyServerLines(
      { pricing_status: sales.pricing_status },
      sales.lines,
    )
    expect(collapsed.pricing.saved).toBe(true)
    expect(sales.lines[0].rate_per_mt).toBe(65000)
    expect(
      mergeDrawerLineRates(
        [{ rate: 65000, amount: 130000 }],
        [{ sku_text: 'HR Coil', rate: 0, amount: 0 }],
      )[0],
    ).toMatchObject({ rate: 65000, amount: 130000 })

    expect(view.pricing.saved).toBe(true)
    expect(view.request.line_items[1].line_status).toBe('cannot_price')
    expect(view.pricing.lines[0]).toMatchObject({
      basePricePerMt: 62000,
      transportPerMt: 1000,
      loadingPerMt: 500,
      marginPerMt: 1500,
    })
    expect(inquiryStatusFromServer({ pricing_status: 'sales_priced' })).toBe('pricing_saved')
  })

  it('uses CGST and SGST in Maharashtra and IGST everywhere else', () => {
    const inside = getGstSplit(100000, 'Pune, Maharashtra')
    const outside = getGstSplit(100000, 'Ahmedabad, Gujarat')
    expect(inside).toMatchObject({ type: 'cgst_sgst', cgst: 9000, sgst: 9000, igst: 0 })
    expect(outside).toMatchObject({ type: 'igst', cgst: 0, sgst: 0, igst: 18000 })
  })
})
