/**
 * Regression: a Price Quote inquiry could not move to Lost, Negotiation,
 * or On Hold because the click still treated the deal as New Inquiry.
 * Issue: <add GitHub issue link>
 */
import { describe, expect, it } from 'vitest'
import { statusMoveBlock } from '../../pages/InquiriesPage'

describe('Price Quote status moves', () => {
  it('allows Lost, Negotiation, and On Hold when the badge is Price Quote', () => {
    for (const target of ['lost', 'negotiation', 'on_hold']) {
      expect(statusMoveBlock('quoted', 'new_inquiry', target)).toBeNull()
    }
  })

  it('still blocks those moves from a New Inquiry badge', () => {
    expect(statusMoveBlock('new_inquiry', 'new_inquiry', 'lost')).toBe(
      'new_inquiry',
    )
    expect(statusMoveBlock('new_inquiry', 'new_inquiry', 'negotiation')).toBe(
      'new_inquiry',
    )
    expect(statusMoveBlock('new_inquiry', 'new_inquiry', 'on_hold')).toBe(
      'new_inquiry',
    )
  })
})
