/**
 * Regression: entering Inquiries from Admin Overview did not preserve the
 * selected salesperson's personal context.
 * Issue: <add GitHub issue link>
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import SalespersonContextBanner from '../../components/SalespersonContextBanner';
import { buildInquiryScopeParams } from '../../utils/inquiryScope';

describe('Inquiries salesperson context', () => {
  it('builds scoped params for inquiries, customers and deals', () => {
    expect(buildInquiryScopeParams('9200000001', 'personal')).toEqual({
      salesperson_phone: '9200000001',
      mode: 'personal',
    });
    expect(buildInquiryScopeParams(null, undefined)).toEqual({});
  });

  it('shows the salesperson and safely returns to Admin Overview', () => {
    const onBack = vi.fn();
    render(<SalespersonContextBanner name="Akruti" onBack={onBack} />);

    expect(screen.getByText('Viewing as: Akruti')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Admin Overview' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
