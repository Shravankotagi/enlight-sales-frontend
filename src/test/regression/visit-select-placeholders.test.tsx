// Issue: <add GitHub issue link>
// Customer Type and Payment Terms prompts are not selectable options.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import VisitCustomerTypeField from '../../components/VisitCustomerTypeField';
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

function placeholderOption(select: HTMLElement) {
  const option = select.querySelector('option[value=""]');
  if (!(option instanceof HTMLOptionElement)) {
    throw new Error('Missing placeholder option');
  }
  return option;
}

describe('visit select placeholders', () => {
  it('does not let the customer type prompt be chosen', () => {
    render(
      <VisitCustomerTypeField
        value=""
        other=""
        onChange={() => undefined}
        onOtherChange={() => undefined}
      />,
    );
    const option = placeholderOption(screen.getByLabelText('Customer Type'));
    expect(option.textContent).toBe('Select Customer Type');
    expect(option.disabled).toBe(true);
    expect(option.hidden).toBe(true);
    expect(screen.getByRole('option', { name: 'OEM' })).toBeEnabled();
  });

  it('does not let the payment terms prompt be chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VisitsPage />);
    await user.click(screen.getByRole('button', { name: 'Log Customer Visit' }));
    const select = screen.getByLabelText('Payment Terms');
    const option = placeholderOption(select);
    expect(option.textContent).toBe('Select Payment Terms');
    expect(option.disabled).toBe(true);
    expect(option.hidden).toBe(true);
    expect(screen.getByRole('option', { name: '30 Days' })).toBeEnabled();
  });
});
