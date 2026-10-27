import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import ProcurementPricingPanel from './ProcurementPricingPanel';

describe('ProcurementPricingPanel', () => {
  beforeEach(() => sessionStorage.clear());

  it('keeps quotation sending disabled while Procurement has not priced every item', () => {
    render(<ProcurementPricingPanel onSendQuotation={vi.fn()} />);
    const sendButton = screen.getByRole('button', { name: /send quotation/i });
    expect(sendButton).toBeDisabled();
  });

  it('shows Procurement line status without exposing an editable base-price field to Sales', () => {
    render(<ProcurementPricingPanel onSendQuotation={vi.fn()} />);
    expect(screen.getByText('Procurement update')).toBeInTheDocument();
    expect(screen.queryByLabelText('Base price per MT')).not.toBeInTheDocument();
  });
});
