import { resolveStateFromGstin, type GstStateInfo } from './pricingEngine';

const GSTIN_FORMAT = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const GSTIN_LOCATION_ERROR =
  'Enter a valid 15-character GSTIN. State is filled only from a valid GSTIN.';

export type CustomerGstinEvaluation =
  | { status: 'empty'; normalized: '' }
  | { status: 'valid'; normalized: string; state: GstStateInfo }
  | { status: 'invalid'; normalized: string; error: string };

export function normalizeCustomerGstin(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/** Format and known state code only. Blank is optional. Does not check the GSTIN checksum. */
export function evaluateCustomerGstin(value?: string | null): CustomerGstinEvaluation {
  const normalized = normalizeCustomerGstin(value);
  if (!normalized) return { status: 'empty', normalized: '' };
  const state = GSTIN_FORMAT.test(normalized) ? resolveStateFromGstin(normalized) : null;
  if (!state) {
    return { status: 'invalid', normalized, error: GSTIN_LOCATION_ERROR };
  }
  return { status: 'valid', normalized, state };
}
