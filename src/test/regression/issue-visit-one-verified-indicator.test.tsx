/**
 * Regression: a verified visit phone showed both "Verified" and "Phone verified."
 * Issue: <add GitHub issue link>
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import VisitsPage from '../../pages/VisitsPage';
import { visitsApi } from '../../lib/api';
import {
  fillCommercialStep,
  fillCompanyAndContact,
  fillFollowUpStep,
  fillVisitDetails,
  goToNextVisitStep,
} from '../fillNewVisitWizard';
import { renderWithProviders } from '../renderWithProviders';

vi.mock('../../lib/api', () => ({
  visitsApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
    reverseGeocode: vi.fn().mockResolvedValue({ data: {} }),
    requestVisitOtp: vi.fn().mockResolvedValue({ data: { message: 'Code sent.' } }),
    verifyVisitOtp: vi.fn().mockResolvedValue({ data: { verification_token: 'token-1' } }),
  },
  employeesApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
  customersApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
  postAuthLogout: vi.fn(),
}));

vi.mock('../../components/VisitCameraCapture', () => ({
  default: ({
    onCapture,
  }: {
    onCapture: (
      photoUrl: string,
      coords: { latitude: number; longitude: number; accuracy: number },
    ) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onCapture('data:image/jpeg;base64,abc', {
          latitude: 18.52,
          longitude: 73.86,
          accuracy: 8,
        })
      }
    >
      Take visit photo
    </button>
  ),
}));

describe('visit phone verification indicator', () => {
  it('shows one verified message after the code is accepted', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VisitsPage />);
    await user.click(screen.getByRole('button', { name: 'Log Customer Visit' }));
    await fillCompanyAndContact(user);
    await goToNextVisitStep(user);
    await fillVisitDetails(user);
    await goToNextVisitStep(user);
    await fillCommercialStep(user);
    await goToNextVisitStep(user);
    await fillFollowUpStep(user);
    await goToNextVisitStep(user);
    await user.click(screen.getByRole('button', { name: 'Take visit photo' }));
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(screen.getByLabelText('Visit verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    const dialog = screen.getByRole('dialog', { name: 'Log customer field visit' });
    expect(await within(dialog).findByText('Phone verified.')).toBeInTheDocument();
    expect(within(dialog).queryByText('Verified')).not.toBeInTheDocument();
    expect(vi.mocked(visitsApi.verifyVisitOtp)).toHaveBeenCalled();
  }, 20000);
});
