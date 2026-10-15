// Issue 238: new customer visits require every field, a locked GPS city, and a camera photo.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import VisitBrandField from '../../components/VisitBrandField';
import VisitCameraCapture from '../../components/VisitCameraCapture';
import VisitLocationField from '../../components/VisitLocationField';
import { validateNewVisitForm, type NewVisitFormInput } from '../../utils/visitForm';

const emptyVisit = (): NewVisitFormInput => ({
  customerName: '',
  personMet: '',
  designation: '',
  contactPhone: '',
  email: '',
  location: '',
  locationSource: '',
  customerType: '',
  visitDate: '',
  visitTime: '',
  visitType: '',
  outcome: '',
  probability: '',
  productDetails: '',
  monthlyConsumption: '',
  brands: [],
  brandOther: '',
  paymentTerms: '',
  deliveryLocation: '',
  nextPurchase: '',
  currentRequirement: '',
  followup: '',
  followupDate: '',
  remarks: '',
  photoUrl: null,
  photoLatitude: null,
  photoLongitude: null,
  otpVerified: false,
});

describe('issue 238 customer visit form', () => {
  it('shows an error for each missing field and blocks an unverified phone', () => {
    const errors = validateNewVisitForm(emptyVisit());
    expect(errors.customerName).toMatch(/customer name/i);
    expect(errors.contactPhone).toMatch(/contact phone/i);
    expect(errors.email).toMatch(/email/i);
    expect(errors.brands).toMatch(/brand/i);
    expect(errors.paymentTerms).toMatch(/payment/i);
    expect(errors.photo).toMatch(/photo/i);
    expect(errors.otp).toMatch(/verify the customer phone/i);
  });

  it('keeps a fetched city read-only and allows a typed city when GPS is unavailable', () => {
    const { rerender } = render(
      <VisitLocationField
        value="Pune"
        source="gps"
        latitude={18.52}
        longitude={73.85}
        notice=""
        locating={false}
        onRetry={() => undefined}
        onManualChange={() => undefined}
      />,
    );
    expect(screen.getByDisplayValue('Pune')).toHaveAttribute('readonly');
    expect(screen.getByText(/18.52000, 73.85000/)).toBeTruthy();

    const manual = viManual();
    rerender(
      <VisitLocationField
        value=""
        source="manual"
        latitude={null}
        longitude={null}
        notice="Location permission was denied or GPS is unavailable. Enter the city, or retry."
        locating={false}
        onRetry={() => undefined}
        onManualChange={manual.change}
      />,
    );
    expect(screen.getByText(/permission was denied/i)).toBeTruthy();
    const input = screen.getByPlaceholderText('Enter the city');
    expect(input).not.toHaveAttribute('readonly');
    fireEvent.change(input, { target: { value: 'Chakan' } });
    expect(manual.value).toBe('Chakan');
  });

  it('lets several brands be selected and asks for a name when Others is chosen', async () => {
    const user = userEvent.setup();
    const selected: string[] = [];
    const { rerender } = render(
      <VisitBrandField
        selected={selected}
        other=""
        onToggle={(brand) => selected.push(brand)}
        onOtherChange={() => undefined}
      />,
    );
    await user.click(screen.getByLabelText('TATA'));
    await user.click(screen.getByLabelText('Others'));
    expect(selected).toEqual(['TATA', 'Others']);
    rerender(
      <VisitBrandField
        selected={['TATA', 'Others']}
        other=""
        otherError="Enter the other brand."
        onToggle={() => undefined}
        onOtherChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText('Other brand')).toBeTruthy();
    expect(screen.getByText('Enter the other brand.')).toBeTruthy();
  });

  it('tells the user when this device has no camera', async () => {
    const user = userEvent.setup();
    render(
      <VisitCameraCapture
        readGps={async () => null}
        onCapture={() => undefined}
      />,
    );
    await user.click(screen.getByRole('button', { name: /take visit photo/i }));
    expect(screen.getByText(/no camera/i)).toBeTruthy();
  });
});

function viManual() {
  const holder = { value: '', change: (value: string) => { holder.value = value; } };
  return holder;
}
