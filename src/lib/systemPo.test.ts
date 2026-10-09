import { describe, expect, it } from 'vitest'
import { createSystemPoReservationToken, getPoErrorMessage, normalizeSystemPoAllocation } from './systemPo'

describe('systemPo helpers', () => {
  it('creates unique, prefixed reservation tokens', () => {
    const a = createSystemPoReservationToken('order-modal')
    const b = createSystemPoReservationToken('order-modal')
    expect(a).toMatch(/^order-modal:\d+:[a-z0-9]+$/)
    expect(a).not.toBe(b)
  })

  it('normalizes a wrapped or bare allocation response', () => {
    const allocation = { po_number: ' EM/PO/7 ', po_reservation_token: 'tok' }
    expect(normalizeSystemPoAllocation({ data: allocation })).toEqual({
      po_number: 'EM/PO/7',
      generated_po_number: 'EM/PO/7',
      po_reservation_token: 'tok',
    })
    expect(normalizeSystemPoAllocation({ ...allocation, generated_po_number: 'EM/PO/6' })?.generated_po_number).toBe(
      'EM/PO/6',
    )
  })

  it('rejects allocations without a PO number or reservation token', () => {
    expect(normalizeSystemPoAllocation({ po_number: 'EM/PO/7' })).toBeNull()
    expect(normalizeSystemPoAllocation({ po_reservation_token: 'tok' })).toBeNull()
    expect(normalizeSystemPoAllocation(null)).toBeNull()
  })

  it('prefers the server message, then the error message, then the fallback', () => {
    expect(getPoErrorMessage({ response: { data: { message: 'Taken' } } })).toBe('Taken')
    expect(getPoErrorMessage({ response: { data: { error: 'Conflict' } } })).toBe('Conflict')
    expect(getPoErrorMessage(new Error('Network'))).toBe('Network')
    expect(getPoErrorMessage(undefined)).toBe('This PO number is already allocated.')
  })
})
