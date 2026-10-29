export const VISIT_BRANDS = [
  'TATA',
  'JSW',
  'AM/NS India',
  'SAIL',
  'NMDC',
  'Apollo',
  'Others',
] as const;

export const VISIT_CUSTOMER_TYPES = [
  'OEM',
  'Fabricator',
  'EPC',
  'Manufacturer',
  'Trader',
  'Other',
] as const;

export const VISIT_PAYMENT_TERMS = [
  'Immediate',
  'Advance',
  '30 Days',
  '45 Days',
  '60 Days',
  '90 Days',
  'LC',
  'BG',
  'PDC',
] as const;

export const MAX_VISIT_DOCUMENT_BYTES = 5 * 1024 * 1024;

export interface NewVisitFormInput {
  customerName: string;
  personMet: string;
  designation: string;
  contactPhone: string;
  email: string;
  location: string;
  locationSource: '' | 'gps' | 'manual';
  customerType: string;
  customerTypeOther: string;
  visitDate: string;
  visitTime: string;
  visitType: string;
  outcome: string;
  probability: string;
  productDetails: string;
  monthlyConsumption: string;
  brands: string[];
  brandOther: string;
  paymentTerms: string;
  deliveryLocation: string;
  nextPurchase: string;
  currentRequirement: string;
  followup: string;
  followupDate: string;
  remarks: string;
  photoUrl: string | null;
  photoLatitude: number | null;
  photoLongitude: number | null;
  otpVerified: boolean;
}

export function visitPhotoStampLabel(
  latitude: number,
  longitude: number,
  at: Date,
): string {
  const when = at.toLocaleString('en-IN', { hour12: false });
  return `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)} · ${when}`;
}

export function visitCustomerTypeLabel(type: unknown, other: unknown): string {
  const selected = String(type ?? '').trim();
  const typed = String(other ?? '').trim();
  if (selected === 'Other' && typed) return typed;
  return selected;
}

export function visitCalendarToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

export function visitCalendarPlusDays(days: number, now: Date = new Date()): string {
  const [year, month, day] = visitCalendarToday(now).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export const VISIT_WIZARD_STEPS = [
  { title: 'Company & contact', subtitle: 'Who you met' },
  { title: 'Visit details', subtitle: 'When and how it went' },
  { title: 'Commercial intelligence', subtitle: 'What they need and buy' },
  { title: 'Follow-up', subtitle: 'What happens next' },
  { title: 'Proof & verify', subtitle: 'Photo from site and customer confirmation' },
] as const;

export function visitWizardFieldKeys(
  step: number,
  input: NewVisitFormInput,
): string[] {
  if (step === 0) {
    return [
      'customerName',
      'personMet',
      'designation',
      'contactPhone',
      'email',
      'location',
      'customerType',
      ...(input.customerType === 'Other' ? ['customerTypeOther'] : []),
    ];
  }
  if (step === 1) {
    return ['visitDate', 'visitTime', 'visitType', 'outcome', 'probability'];
  }
  if (step === 2) {
    return [
      'productDetails',
      'monthlyConsumption',
      'brands',
      'paymentTerms',
      'deliveryLocation',
      'nextPurchase',
      'currentRequirement',
      ...(input.brands.includes('Others') ? ['brandOther'] : []),
    ];
  }
  if (step === 3) return ['followup', 'followupDate', 'remarks'];
  if (step === 4) return ['photo', 'otp'];
  return [];
}

export function visitWizardStepErrors(
  input: NewVisitFormInput,
  step: number,
): Record<string, string> {
  const errors = validateNewVisitForm(input);
  const stepErrors: Record<string, string> = {};
  visitWizardFieldKeys(step, input).forEach((field) => {
    if (errors[field]) stepErrors[field] = errors[field];
  });
  return stepErrors;
}

export function visitWizardProgress(step: number) {
  const total = VISIT_WIZARD_STEPS.length;
  const index = Number.isFinite(step) ? Math.trunc(step) : 0;
  const current = Math.min(total, Math.max(1, index + 1));
  return { current, total };
}

export function visitCalendarDay(value: string): string {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return '';
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function visitCityLabel(city: unknown): string {
  const text = String(city ?? '').trim();
  if (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(text)) return '';
  return text;
}

export function visitDocumentError(file: {
  name?: string;
  type?: string;
  size?: number;
}): string {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const allowedType =
    type === 'application/pdf' ||
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/png' ||
    /\.(pdf|jpe?g|png)$/.test(name);
  const tooLarge = (file.size || 0) > MAX_VISIT_DOCUMENT_BYTES;
  if (!allowedType || tooLarge) {
    return 'Supporting documents must be PDF, JPG, or PNG and no larger than 5 MB.';
  }
  return '';
}

export function validateNewVisitForm(
  input: NewVisitFormInput,
  options: { requireOtp?: boolean } = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  const requireOtp = options.requireOtp !== false;

  if (!input.customerName.trim()) {
    errors.customerName = 'Please select or enter customer name.';
  }
  if (!input.personMet.trim()) errors.personMet = 'Please enter person met.';
  if (!input.designation.trim()) errors.designation = 'Please enter designation.';

  const phone = input.contactPhone.replace(/\D/g, '');
  if (!phone) errors.contactPhone = 'Please enter contact phone.';
  else if (phone.length !== 10) {
    errors.contactPhone = 'Please enter a valid 10-digit mobile number.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = 'Please enter a valid email.';
  }
  if (!input.location.trim()) {
    errors.location = 'Enter the city.';
  }
  if (!VISIT_CUSTOMER_TYPES.includes(input.customerType as (typeof VISIT_CUSTOMER_TYPES)[number])) {
    errors.customerType = 'Select a customer type.';
  }
  if (input.customerType === 'Other' && !input.customerTypeOther.trim()) {
    errors.customerTypeOther = 'Enter the other customer type.';
  }
  if (!input.visitDate) errors.visitDate = 'Please enter the visit date.';
  if (!input.visitTime) errors.visitTime = 'Please enter the visit time.';
  if (!input.visitType) errors.visitType = 'Select a visit type.';
  if (!input.outcome) errors.outcome = 'Select an outcome.';
  if (!input.probability) errors.probability = 'Select the customer probability.';
  if (!input.productDetails.trim()) {
    errors.productDetails = 'Please enter product details.';
  }
  if (!input.monthlyConsumption.trim()) {
    errors.monthlyConsumption = 'Please enter monthly consumption.';
  }
  if (input.brands.length === 0) errors.brands = 'Select a preferred brand.';
  if (
    input.brands.some((brand) => !VISIT_BRANDS.includes(brand as (typeof VISIT_BRANDS)[number]))
  ) {
    errors.brands = 'Select a preferred brand from the list.';
  }
  if (input.brands.includes('Others') && !input.brandOther.trim()) {
    errors.brandOther = 'Enter the other brand.';
  }
  if (!VISIT_PAYMENT_TERMS.includes(input.paymentTerms as (typeof VISIT_PAYMENT_TERMS)[number])) {
    errors.paymentTerms = 'Select a payment term.';
  }
  if (!input.deliveryLocation.trim()) {
    errors.deliveryLocation = 'Please enter the delivery location.';
  }
  if (!input.nextPurchase) errors.nextPurchase = 'Please enter the next purchase date.';
  else if (visitCalendarDay(input.nextPurchase) < visitCalendarToday()) {
    errors.nextPurchase = 'Choose a next purchase date that is today or later.';
  }
  if (!input.currentRequirement.trim()) {
    errors.currentRequirement = 'Please enter the current requirement.';
  }
  if (!input.followup.trim()) errors.followup = 'Please enter the follow-up action.';
  if (!input.followupDate) errors.followupDate = 'Please enter the follow-up date.';
  else if (visitCalendarDay(input.followupDate) < visitCalendarToday()) {
    errors.followupDate = 'Choose a follow-up date that is today or later.';
  }
  if (!input.remarks.trim()) errors.remarks = 'Please enter meeting remarks.';
  if (!input.photoUrl) errors.photo = 'Take a visit photo with the camera.';
  else if (input.photoLatitude == null || input.photoLongitude == null) {
    errors.photo = 'The visit photo must include GPS coordinates.';
  }
  if (requireOtp && !input.otpVerified) {
    errors.otp = 'Verify the customer phone before saving the visit.';
  }
  return errors;
}
