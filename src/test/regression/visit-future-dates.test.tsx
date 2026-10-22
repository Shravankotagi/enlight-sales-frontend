// Issue: <add GitHub issue link>
// A new visit cannot use a past next purchase date or follow-up date.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import VisitsPage from '../../pages/VisitsPage';
import { fillCommercialStep, fillCompanyAndContact, fillVisitDetails, goToNextVisitStep } from '../fillNewVisitWizard';
import { renderWithProviders } from '../renderWithProviders';
import {
  validateNewVisitForm,
  visitCalendarToday,
  type NewVisitFormInput,
} from '../../utils/visitForm';

vi.mock('../../lib/api', () => ({
  visitsApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
    reverseGeocode: vi.fn().mockResolvedValue({ data: {} }),
  },
  employeesApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
  customersApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
  postAuthLogout: vi.fn(),
}));

function isoDaysFromToday(days: number): string {
  const [year, month, day] = visitCalendarToday().split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readyVisit(overrides: Partial<NewVisitFormInput> = {}): NewVisitFormInput {
  const today = visitCalendarToday();
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
    nextPurchase: today,
    currentRequirement: '10 MT',
    followup: 'Send quote',
    followupDate: today,
    remarks: 'Discussed rates',
    photoUrl: 'data:image/jpeg;base64,abc',
    photoLatitude: 18.52,
    photoLongitude: 73.86,
    otpVerified: true,
    ...overrides,
  };
}

describe('new visit future dates', () => {
  it('rejects a next purchase or follow-up before today and accepts today', () => {
    const yesterday = isoDaysFromToday(-1);
    const today = visitCalendarToday();
    const pastPurchase = validateNewVisitForm(
      readyVisit({ nextPurchase: yesterday, followupDate: today }),
    );
    expect(pastPurchase.nextPurchase).toBe('Choose a next purchase date that is today or later.');
    expect(pastPurchase.followupDate).toBeUndefined();

    const pastFollowUp = validateNewVisitForm(
      readyVisit({ nextPurchase: today, followupDate: yesterday }),
    );
    expect(pastFollowUp.followupDate).toBe('Choose a follow-up date that is today or later.');
    expect(pastFollowUp.nextPurchase).toBeUndefined();

    const accepted = validateNewVisitForm(readyVisit());
    expect(accepted.nextPurchase).toBeUndefined();
    expect(accepted.followupDate).toBeUndefined();
  });

  it('stops the new visit date pickers before today', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VisitsPage />);
    await user.click(screen.getByRole('button', { name: 'Log Customer Visit' }));
    const today = visitCalendarToday();
    await fillCompanyAndContact(user);
    await goToNextVisitStep(user);
    await fillVisitDetails(user);
    await goToNextVisitStep(user);
    expect((screen.getByLabelText('Next Purchase Expected') as HTMLInputElement).min).toBe(today);
    await fillCommercialStep(user);
    await goToNextVisitStep(user);
    expect((screen.getByLabelText('Follow-up Date') as HTMLInputElement).min).toBe(today);
  });
});
