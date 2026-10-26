/**
 * Regression: the procurement dropdown must consume the backend's canonical
 * display stage rather than recreating deal and status logic.
 * Issue: <add GitHub issue link>
 */
import { describe, expect, it } from 'vitest';
import { resolveInquiryDealStageKey } from '../../pages/InquiriesPage';

const quoted = {
  id: 'inq-1',
  status: 'quoted',
  stage: 'quoted',
  created_at: '2026-10-20T00:00:00.000Z',
  display_stage: 'won',
};

describe('procurement display stage', () => {
  it('counts the backend-owned won stage before raw inquiry fields', () => {
    expect(resolveInquiryDealStageKey(quoted as any)).toBe('won');
  });

  it('uses the backend-normalized Price Quote stage', () => {
    expect(
      resolveInquiryDealStageKey(
        { ...quoted, display_stage: 'quoted' } as any,
      ),
    ).toBe('quoted');
  });

  it('does not recalculate stage from a raw linked deal', () => {
    expect(
      resolveInquiryDealStageKey({
        ...quoted,
        display_stage: 'quoted',
        stage: 'won',
      } as any),
    ).toBe('quoted');
  });
});
