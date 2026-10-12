import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import ProcurementPricingPanel from './ProcurementPricingPanel';

describe('ProcurementPricingPanel', () => {
  beforeEach(() => sessionStorage.clear());

  it('keeps quotation sending disabled until procurement provides a base price', () => {
    render(<ProcurementPricingPanel onSendQuotation={vi.fn()} />);
    const sendButton = screen.getByRole('button', { name: /send quotation/i });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Base price per MT'), { target: { value: '58000' } });
    expect(sendButton).not.toBeDisabled();
  });

  it('passes the calculated sell rate and subtotal to the quotation flow', () => {
    const onSendQuotation = vi.fn();
    render(<ProcurementPricingPanel onSendQuotation={onSendQuotation} />);

    fireEvent.change(screen.getByLabelText('Base price per MT'), { target: { value: '50000' } });
    fireEvent.change(screen.getByLabelText('Transport per MT'), { target: { value: '2000' } });
    fireEvent.change(screen.getByLabelText('Margin percentage'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /send quotation/i }));

    expect(onSendQuotation).toHaveBeenCalledWith({
      sellRatePerMt: 57200,
      subtotal: 1029600,
    });
  });
});
