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
  if (!input.currentRequirement.trim()) {
    errors.currentRequirement = 'Please enter the current requirement.';
  }
  if (!input.followup.trim()) errors.followup = 'Please enter the follow-up action.';
  if (!input.followupDate) errors.followupDate = 'Please enter the follow-up date.';
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
