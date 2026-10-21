import { describe, expect, it } from 'vitest';
import { inquiryEmailFrom, parseInquiryText } from './InquiriesPage';

describe('inquiry customer email', () => {
  it('reads a stored address before an address in the text', () => {
    const details = parseInquiryText('Reach us at other@buyer.com', {
      ai_extraction_json: { customer_email: 'Buyer@Plant.com' },
    });
    expect(details.customerEmail).toBe('buyer@plant.com');
  });

  it('reads the first address in the inquiry text', () => {
    const details = parseInquiryText('Please quote. Mail purchase@frussh.com', {});
    expect(details.customerEmail).toBe('purchase@frussh.com');
    expect(inquiryEmailFrom('not an email', 'Sales@Co.in')).toBe('sales@co.in');
    expect(inquiryEmailFrom('')).toBe('');
  });
});
