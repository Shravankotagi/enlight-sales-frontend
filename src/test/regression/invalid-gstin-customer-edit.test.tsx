// Issue: <add GitHub issue link>
// An invalid GSTIN in the customer profile edit modal must not set the state.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import CustomerProfilePage from '../../pages/CustomerProfilePage';
import { renderWithProviders } from '../renderWithProviders';

const GSTIN_ERROR =
  'Enter a valid 15-character GSTIN. State is filled only from a valid GSTIN.';

const api = vi.hoisted(() => ({
  getOne: vi.fn(),
  update: vi.fn(),
  getAll: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  customersApi: {
    getOne: api.getOne,
    update: api.update,
  },
  employeesApi: {
    getAll: api.getAll,
  },
}));

const customer = {
  id: 'cust-1',
  customer_name: 'Acme Steels',
  contact_person: 'Ravi',
  customer_phone: '9822012345',
  customer_gst: '',
  customer_address: '',
  customer_state: '',
  assigned_salesperson_phone: '',
  avg_order_frequency_days: 30,
  segment: 'new',
  deals: [],
  visits: [],
  inquiries: [],
  complaints: [],
  health_signals: {},
};

function fieldInput(labelText: string): HTMLInputElement {
  const label = screen.getAllByText(labelText).find((el) => el.tagName === 'LABEL');
  const input = label?.parentElement?.querySelector('input');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`${labelText} input not found`);
  }
  return input;
}

function gstinInput(): HTMLInputElement {
  return fieldInput('GSTIN Number');
}

async function openEdit(profile: typeof customer = customer) {
  api.getOne.mockResolvedValue({ data: { data: profile } });
  api.getAll.mockResolvedValue({ data: [] });
  api.update.mockResolvedValue({ data: { data: profile } });
  const user = userEvent.setup();
  renderWithProviders(
    <Routes>
      <Route path="/customers/:id" element={<CustomerProfilePage />} />
    </Routes>,
    { route: '/customers/cust-1' },
  );
  await user.click(await screen.findByRole('button', { name: /Edit Profile/i }));
  return user;
}

describe('invalid GSTIN on the customer profile edit modal', () => {
  beforeEach(() => {
    api.getOne.mockReset();
    api.update.mockReset();
    api.getAll.mockReset();
  });

  it('does not detect a state from a partial or invalid GSTIN, and shows an error once the value is finished or left', async () => {
    const user = await openEdit();
    const input = gstinInput();

    await user.type(input, '27');
    expect(screen.queryByRole('button', { name: 'Maharashtra (27)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent(GSTIN_ERROR);
    expect(screen.queryByRole('button', { name: 'Maharashtra (27)' })).not.toBeInTheDocument();

    await user.clear(gstinInput());
    await user.type(gstinInput(), '27NOTVALIDGSTIN');
    expect(screen.getByRole('alert')).toHaveTextContent(GSTIN_ERROR);
    expect(screen.queryByRole('button', { name: 'Maharashtra (27)' })).not.toBeInTheDocument();

    await user.clear(gstinInput());
    await user.type(gstinInput(), '24NOTVALIDGSTIN');
    await user.type(fieldInput('Registered Address'), 'Pune');
    expect(screen.queryByRole('button', { name: 'Gujarat (24)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maharashtra (27)' })).toBeInTheDocument();
  });

  it('fills the state from a valid GSTIN and still saves a blank GSTIN', async () => {
    const user = await openEdit();

    await user.type(gstinInput(), '27AAICE5263E1ZN');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maharashtra (27)' })).toBeInTheDocument();

    await user.clear(gstinInput());
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update.mock.calls[0][1].customer_gst).toBe('');
  });

  it('blocks save for an invalid GSTIN and shows the error for an unknown state code', async () => {
    const user = await openEdit();
    await user.type(gstinInput(), '99AAAAA0000A1Z5');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(api.update).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(GSTIN_ERROR);
    expect(screen.queryByRole('button', { name: 'Maharashtra (27)' })).not.toBeInTheDocument();
  });

  it('shows the error when the profile already has an invalid GSTIN and does not use it for state', async () => {
    await openEdit({
      ...customer,
      customer_gst: '24NOTVALIDGSTIN',
      customer_address: 'Pune',
    });

    expect(gstinInput()).toHaveValue('24NOTVALIDGSTIN');
    expect(screen.getByRole('alert')).toHaveTextContent(GSTIN_ERROR);
    expect(screen.queryByRole('button', { name: 'Gujarat (24)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maharashtra (27)' })).toBeInTheDocument();
  });
});
