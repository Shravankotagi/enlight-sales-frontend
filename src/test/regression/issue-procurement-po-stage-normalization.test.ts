/**
 * Regression: the procurement tab consumes the canonical backend stage for
 * mixed-case PO metadata instead of duplicating PO classification.
 * Issue: <add GitHub issue link>
 */
import { describe, expect, it } from 'vitest';
import { resolveInquiryDealStageKey } from '../../pages/InquiriesPage';

describe('procurement PO stage normalization', () => {
  it.each([
    { inquiry_type: 'Purchase_Order' },
    { source_channel: 'WhatsApp_PO' },
  ])('uses the backend-owned Won stage with mixed-case metadata', (metadata) => {
    expect(
      resolveInquiryDealStageKey(
        {
          id: 'inq-po-1',
          status: 'confirmed',
          created_at: '2026-10-26T00:00:00.000Z',
          display_stage: 'won',
          ...metadata,
        } as any,
      ),
    ).toBe('won');
  });
});
