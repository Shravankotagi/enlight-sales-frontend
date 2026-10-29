// Issue: visit logging progress
// The Log Visit header counts wizard steps, not fields on the open step.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import VisitsPage from '../../pages/VisitsPage';
import { fillCompanyAndContact, goToNextVisitStep } from '../fillNewVisitWizard';
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

function expectStepProgress(current: number, total: number) {
  const dialog = screen.getByRole('dialog', { name: 'Log customer field visit' });
  expect(within(dialog).getByText(`${current}/${total}`)).toBeInTheDocument();
  expect(within(dialog).queryByText('0/7')).not.toBeInTheDocument();
  const bar = within(dialog).getByRole('progressbar', { name: 'Visit form progress' });
  expect(bar).toHaveAttribute('aria-valuenow', String(current));
  expect(bar).toHaveAttribute('aria-valuemax', String(total));
  expect(bar).toHaveStyle({ width: `${(current / total) * 100}%` });
}

describe('visit wizard step progress', () => {
  it('shows the step count on an empty form and after Next', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VisitsPage />);
    await user.click(screen.getByRole('button', { name: 'Log Customer Visit' }));

    expectStepProgress(1, 5);

    await fillCompanyAndContact(user);
    await goToNextVisitStep(user);

    expectStepProgress(2, 5);
  });
});
