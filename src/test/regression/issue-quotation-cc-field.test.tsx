import { describe, expect, it } from 'vitest';
import { addQuotationCcEmail } from '../../utils/quotationCc';

describe('quotation CC field regression', () => {
  it('supports adding and removing normalized CC recipients without adding the customer', () => {
    const initial = ['sender@example.com'];
    const added = addQuotationCcEmail(initial, ' New.Person@Example.com ');

    expect(added).toEqual({
      emails: ['sender@example.com', 'new.person@example.com'],
      error: '',
    });
    expect(
      addQuotationCcEmail(added.emails, 'customer@example.com', 'CUSTOMER@example.com'),
    ).toEqual({
      emails: added.emails,
      error: 'The customer email is already in To.',
    });
    expect(added.emails.filter((email) => email !== 'sender@example.com')).toEqual([
      'new.person@example.com',
    ]);
  });

  it('rejects invalid and duplicate CC recipients', () => {
    expect(addQuotationCcEmail([], 'not-an-email').error).toBe(
      'Enter a valid email address.',
    );
    expect(addQuotationCcEmail(['team@example.com'], 'TEAM@example.com').error).toBe(
      'This email is already in CC.',
    );
  });
});

