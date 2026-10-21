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
    expect(screen.getAllByText('2 Items').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Alpha Metals|Beta Steel|9200000001/)).not.toBeInTheDocument();
  });

  it('renders every product row and saves per-line base prices', async () => {
    renderWithProviders(<ProcurementPage />);
    const requestRow = (await screen.findAllByText('PR-1042'))[0].closest('tr') as HTMLElement;
    fireEvent.click(within(requestRow).getByRole('button'));

    fireEvent.change(screen.getByLabelText('Base price for Hot Rolled Coil'), { target: { value: '58000' } });
    fireEvent.change(screen.getByLabelText('Base price for GI Sheet'), { target: { value: '61000' } });
    fireEvent.click(screen.getByRole('button', { name: /save pricing/i }));

    expect((await screen.findAllByText('Price Added')).length).toBeGreaterThan(0);
  });

  it('automatically marks blank-price products unavailable when Procurement saves', async () => {
    renderWithProviders(<ProcurementPage />);
    const requestRow = (await screen.findAllByText('PR-1042'))[0].closest('tr') as HTMLElement;
    fireEvent.click(within(requestRow).getByRole('button'));
    fireEvent.change(screen.getByLabelText('Base price for GI Sheet'), { target: { value: '61000' } });

    expect(screen.getByRole('button', { name: /save pricing/i })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /save pricing/i }));

    expect((await screen.findAllByText('Partly Priced')).length).toBeGreaterThan(0);
  });
});
