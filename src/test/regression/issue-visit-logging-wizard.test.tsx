// Issue: visit logging wizard
// The new-visit dialog shows one step at a time and does not leave a step with a missing required field.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import VisitsPage from '../../pages/VisitsPage';
import { renderWithProviders } from '../renderWithProviders';

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

describe('visit logging wizard', () => {
  it('stays on company and contact when Next is pressed with an empty company', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VisitsPage />);
    await user.click(screen.getByRole('button', { name: 'Log Customer Visit' }));

    const dialog = screen.getByRole('dialog', { name: 'Log customer field visit' });
    expect(within(dialog).getByRole('button', { name: /Company & contact/i })).toBeTruthy();
    expect(within(dialog).getByPlaceholderText('Search or enter company name...')).toBeTruthy();
    expect(within(dialog).queryByPlaceholderText('e.g. SS 304 Sheets 2mm, Pipe 4 inch')).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Next' }));

    expect(within(dialog).getByText('Please select or enter customer name.')).toBeTruthy();
    expect(within(dialog).getByPlaceholderText('Search or enter company name...')).toBeTruthy();
    expect(within(dialog).queryByPlaceholderText('e.g. SS 304 Sheets 2mm, Pipe 4 inch')).toBeNull();
  });
});
