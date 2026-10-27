import { describe, expect, it } from 'vitest'
import { nosMtMissing } from './InquiriesPage'

const sheet = { sku_text: 'HR Sheet', rate: 0, amount: 0, quantity: 45, unit: 'Nos' }

describe('nosMtMissing', () => {
  it('flags Nos when the spec has only two dimensions', () => {
    expect(nosMtMissing({ ...sheet, dimensions: '15*2500' })).toBe(true)
  })

  it('accepts length*width*thickness', () => {
    expect(nosMtMissing({ ...sheet, dimensions: '15*2500*34' })).toBe(false)
  })

  it('accepts a typed MT', () => {
    expect(
      nosMtMissing({
        ...sheet,
        dimensions: '15*2500',
        is_manual_mt: true,
        converted_mt: 0.45,
      }),
    ).toBe(false)
  })

  it('leaves other units, empty quantity, and products that already convert', () => {
    expect(nosMtMissing({ ...sheet, unit: 'KG', dimensions: '15*2500' })).toBe(false)
    expect(nosMtMissing({ ...sheet, quantity: 0, dimensions: '15*2500' })).toBe(false)
    expect(nosMtMissing({ ...sheet, sku_text: 'Solar Purlin', dimensions: '3.2m' })).toBe(false)
  })
})
