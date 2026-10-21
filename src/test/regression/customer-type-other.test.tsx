// Issue: <add GitHub issue link>
// Customer type Other requires the typed type.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import VisitCustomerTypeField from '../../components/VisitCustomerTypeField';
import {
  VISIT_CUSTOMER_TYPES,
  validateNewVisitForm,
  visitCalendarToday,
  type NewVisitFormInput,
} from '../../utils/visitForm';

function isoDaysFromToday(days: number): string {
  const [year, month, day] = visitCalendarToday().split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readyVisit(overrides: Partial<NewVisitFormInput> = {}): NewVisitFormInput {
  return {
    customerName: 'Acme',
    personMet: 'Ravi',
    designation: 'Buyer',
    contactPhone: '9822012345',
    email: 'ravi@acme.com',
    location: 'Pune',
    locationSource: 'gps',
    customerType: 'OEM',
    customerTypeOther: '',
    visitDate: '2026-10-15',
    visitTime: '10:00',
    visitType: 'First Visit',
    outcome: 'positive',
    probability: 'Hot',
    productDetails: 'HR Coil',
    monthlyConsumption: '50 MT',
    brands: ['TATA'],
    brandOther: '',
    paymentTerms: '30 Days',
    deliveryLocation: 'Chakan',
    nextPurchase: '2026-11-01',
    currentRequirement: '10 MT',
    followup: 'Send quote',
    followupDate: isoDaysFromToday(7),
    remarks: 'Discussed rates',
    photoUrl: 'data:image/jpeg;base64,abc',
    photoLatitude: 18.52,
    photoLongitude: 73.86,
    otpVerified: true,
    ...overrides,
  };
}

describe('customer type Other', () => {
  it('offers Other and shows a box for the typed type', async () => {
    const user = userEvent.setup();
    let value = '';
    let other = '';
    const view = () => (
      <VisitCustomerTypeField
        required
        value={value}
        other={other}
        onChange={(next) => {
          value = next;
        }}
        onOtherChange={(next) => {
          other = next;
        }}
      />
    );
    const { rerender } = render(view());
    expect(VISIT_CUSTOMER_TYPES).toContain('Other');
    expect(screen.getByRole('option', { name: 'Other' })).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Customer Type'), 'Other');
    rerender(view());
    expect(screen.getByLabelText('Other customer type')).toBeTruthy();
  });

  it('rejects Other without the typed type', () => {
    const errors = validateNewVisitForm(
      readyVisit({ customerType: 'Other', customerTypeOther: '  ' }),
    );
    expect(errors.customerTypeOther).toMatch(/other customer type/i);
  });

  it('accepts Other when the typed type is present', () => {
    const errors = validateNewVisitForm(
      readyVisit({ customerType: 'Other', customerTypeOther: 'Contractor' }),
    );
    expect(errors.customerType).toBeUndefined();
    expect(errors.customerTypeOther).toBeUndefined();
  });
});
