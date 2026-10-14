import { describe, expect, it } from 'vitest';
import { addQuotationCcEmail } from './quotationCc';

describe('quotation CC recipients', () => {
  it('adds normalized addresses and rejects duplicates', () => {
    const initial = ['sender@example.com'];
    const added = addQuotationCcEmail(initial, '  Buyer@Example.com ');

    expect(added).toEqual({
      emails: ['sender@example.com', 'buyer@example.com'],
      error: '',
    });
    expect(addQuotationCcEmail(added.emails, 'BUYER@example.com')).toEqual({
      emails: added.emails,
      error: 'This email is already in CC.',
    });
  });

  it('rejects invalid addresses and the primary customer recipient', () => {
    expect(addQuotationCcEmail([], 'not-an-email')).toEqual({
      emails: [],
      error: 'Enter a valid email address.',
    });
    expect(addQuotationCcEmail([], 'customer@example.com', 'CUSTOMER@example.com')).toEqual({
      emails: [],
      error: 'The customer email is already in To.',
    });
  });
});

