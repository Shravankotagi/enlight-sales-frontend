// Issue: <add GitHub issue link>
// The visits list shows area and city, and View still shows an uploaded document.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import VisitsPage, { formatCityLocality } from '../../pages/VisitsPage';
import { visitsApi } from '../../lib/api';
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

const fullAddress =
  'Shree Ashtavinayak Building, Sadashiv Cross Ln, Khotachiwadi, Ambewadi, Girgaon, Mumbai, Maharashtra 400004, India';
const repeatedCity = 'Gaibi Nagar, Bhiwandi, Bhiwandi, Maharashtra 421302, India';

const visit = {
  id: 'visit-1',
  customer_name: 'Gaibi Steel',
  visited_at: '2026-10-26T04:15:00.000Z',
  person_met: 'Ravi',
  contact_phone: '9811111111',
  location: repeatedCity,
  location_source: 'gps',
  phone_verified: true,
  outcome: 'positive',
  visit_latitude: 19.29,
  visit_longitude: 73.06,
  attachments: [
    {
      name: 'site-note.pdf',
      url: 'data:application/pdf;base64,abc',
      type: 'application/pdf',
    },
  ],
};

describe('visit list address', () => {
  it('keeps area and city and drops the state, pin, country, and repeats', () => {
    expect(formatCityLocality(fullAddress)).toBe('Girgaon, Mumbai');
    expect(formatCityLocality(repeatedCity)).toBe('Gaibi Nagar, Bhiwandi');
    expect(formatCityLocality('', '')).toBe('-');
    expect(formatCityLocality(null, null)).toBe('-');
  });

  it('shows a short location, opens the saved document, and drops the log-visit prompt', async () => {
    vi.mocked(visitsApi.getAll).mockResolvedValue({ data: [visit] } as never);
    const user = userEvent.setup();
    renderWithProviders(<VisitsPage />);

    expect(await screen.findAllByTitle(repeatedCity)).not.toHaveLength(0);
    expect(screen.getAllByText('Gaibi Nagar, Bhiwandi').length).toBeGreaterThan(0);
    expect(screen.queryByText('GPS location')).not.toBeInTheDocument();
    expect(screen.queryByText('Phone verified')).not.toBeInTheDocument();
    const table = document.querySelector('table');
    if (!(table instanceof HTMLTableElement)) throw new Error('Missing visits table');
    const verified = within(table).getByLabelText('Phone verified');
    expect(verified.parentElement?.className).toContain('items-center');
    expect(table.querySelector('colgroup col:nth-child(4)')?.className).toContain('w-[22%]');
    expect(screen.getAllByLabelText('Open in Google Maps').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Log Customer Visit' }));
    const dialog = screen.getByRole('dialog', { name: 'Log customer field visit' });
    expect(within(dialog).queryByText(/Required on this step/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Capture the meeting while you are still on site/)).not.toBeInTheDocument();
    expect(dialog.querySelector('[class~="h-1.5"][class~="w-full"]')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    const cardView = screen.queryAllByRole('button', { name: 'View' });
    if (cardView.length) {
      await user.click(cardView[0]);
    } else {
      await user.click(screen.getAllByTitle('Actions')[0]);
      await user.click(screen.getByRole('button', { name: 'View' }));
    }
    expect(await screen.findByText('site-note.pdf')).toBeInTheDocument();
  });
});
