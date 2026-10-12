import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import ProcurementPage from './ProcurementPage';

describe('ProcurementPage prototype', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('shows an anonymised procurement queue without customer identity', async () => {
    renderWithProviders(<ProcurementPage />);

    expect(await screen.findByText('Procurement')).toBeInTheDocument();
    expect(screen.getAllByText('PR-1042')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Hot Rolled Coil')[0]).toBeInTheDocument();
    expect(screen.queryByText(/Alpha Metals|Beta Steel|9200000001/)).not.toBeInTheDocument();
  });

  it('saves a base price and moves the request to priced status', async () => {
    renderWithProviders(<ProcurementPage />);
    const requestRow = (await screen.findAllByText('PR-1042'))[0].closest('tr') as HTMLElement;
    fireEvent.click(within(requestRow).getByRole('button'));

    const input = screen.getByLabelText('Base price (₹ / MT)');
    fireEvent.change(input, { target: { value: '58000' } });
    fireEvent.click(screen.getByRole('button', { name: /save base price/i }));

    expect((await screen.findAllByText('Priced by procurement')).length).toBeGreaterThan(1);
  });
});
