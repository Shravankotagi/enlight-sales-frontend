// Issue 238: new customer visits require every field, a locked GPS city, and a camera photo.
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AssistantAttachMenu from '../../components/AssistantAttachMenu';
import VisitBrandField from '../../components/VisitBrandField';
import VisitCameraCapture from '../../components/VisitCameraCapture';
import VisitLocationField from '../../components/VisitLocationField';
import { validateNewVisitForm, visitCityLabel, type NewVisitFormInput } from '../../utils/visitForm';

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
    expect(visitCityLabel('18.52000, 73.85000')).toBe('');
    expect(visitCityLabel('Mumbai')).toBe('Mumbai');
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

    rerender(
      <VisitLocationField
        value=""
        source="gps"
        cityLocked={false}
        latitude={18.52}
        longitude={73.85}
        notice="Type the city."
        locating={false}
        onRetry={() => undefined}
        onManualChange={() => undefined}
      />,
    );
    expect(screen.getByPlaceholderText('Enter the city')).not.toHaveAttribute('readonly');
    expect(screen.getByText('Type the city.')).toBeTruthy();
    expect(screen.getByText(/18.52000, 73.85000/)).toBeTruthy();

    rerender(
      <VisitLocationField
        value="12, MG Road, Camp, Pune, Maharashtra, 411001, India"
        source="gps"
        latitude={18.5204}
        longitude={73.8567}
        notice=""
        locating={false}
        onRetry={() => undefined}
        onManualChange={() => undefined}
      />,
    );
    expect(
      screen.getByDisplayValue('12, MG Road, Camp, Pune, Maharashtra, 411001, India'),
    ).toHaveAttribute('readonly');
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
    await user.click(screen.getByRole('button', { name: /select brands/i }));
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

  it('offers a device upload and a live camera from the assistant pin', async () => {
    const user = userEvent.setup();
    render(
      <AssistantAttachMenu
        onUpload={() => undefined}
        readGps={async () => null}
        onCapture={() => undefined}
      />,
    );
    await user.click(screen.getByRole('button', { name: /attach a file or take a photo/i }));
    expect(screen.getByRole('button', { name: 'Upload from device' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Capture an image' }));
    const dialog = screen.getByRole('dialog', { name: 'Visit camera' });
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(screen.queryByRole('button', { name: 'Upload from device' })).toBeNull();
    expect(screen.getByText(/no camera/i)).toBeTruthy();
  });

  it('attaches the camera stream without a timer and falls back when the rear camera fails', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] };
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(new Error('OverconstrainedError'))
      .mockResolvedValueOnce(stream);
    const previous = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    const realSetTimeout = window.setTimeout.bind(window);
    const timeout = vi.spyOn(window, 'setTimeout').mockImplementation(((
      handler: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (delay === 0) return 0 as unknown as ReturnType<typeof setTimeout>;
      return realSetTimeout(handler, delay, ...args);
    }) as typeof window.setTimeout);
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    try {
      render(
        <VisitCameraCapture
          readGps={async () => null}
          onCapture={() => undefined}
        />,
      );
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /take visit photo/i }));
      });
      const video = document.querySelector('video');
      expect(video?.srcObject).toBe(stream);
      expect(getUserMedia).toHaveBeenNthCalledWith(1, {
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      expect(getUserMedia).toHaveBeenNthCalledWith(2, { video: true, audio: false });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      });
      expect(stop).toHaveBeenCalled();
    } finally {
      timeout.mockRestore();
      play.mockRestore();
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: previous,
      });
    }
  });

  it('opens a large camera overlay', async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop }],
    });
    const previous = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    render(
      <VisitCameraCapture
        readGps={async () => null}
        onCapture={() => undefined}
      />,
    );
    await user.click(screen.getByRole('button', { name: /take visit photo/i }));
    const dialog = screen.getByRole('dialog', { name: 'Visit camera' });
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(document.querySelector('video')?.className).toMatch(/h-\[70vh\]/);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Visit camera' })).toBeNull();
    expect(stop).toHaveBeenCalled();
    play.mockRestore();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: previous,
    });
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
