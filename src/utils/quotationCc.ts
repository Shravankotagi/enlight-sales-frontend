export const isValidQuotationEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const normalizeQuotationEmail = (email: string): string =>
  email.trim().toLowerCase();

export const FIXED_QUOTATION_CC = [
  'dj@enlightmetals.com',
  'vedant@enlightmetals.com',
];

export const isFixedQuotationCc = (email: string): boolean =>
  FIXED_QUOTATION_CC.includes(normalizeQuotationEmail(email));

export function withFixedQuotationCc(emails: string[]): string[] {
  const extras = emails.filter((email) => !isFixedQuotationCc(email));
  return [...FIXED_QUOTATION_CC, ...extras];
}

export function addQuotationCcEmail(
  current: string[],
  draft: string,
  customerEmail = '',
): { emails: string[]; error: string } {
  const normalized = normalizeQuotationEmail(draft);
  if (!normalized) return { emails: current, error: '' };
  if (!isValidQuotationEmail(normalized)) {
    return { emails: current, error: 'Enter a valid email address.' };
  }
  if (
    customerEmail &&
    normalized === normalizeQuotationEmail(customerEmail)
  ) {
    return { emails: current, error: 'The customer email is already in To.' };
  }
  if (current.some((email) => normalizeQuotationEmail(email) === normalized)) {
    return { emails: current, error: 'This email is already in CC.' };
  }
  return { emails: [...current, normalized], error: '' };
}

