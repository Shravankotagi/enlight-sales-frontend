import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ZohoPermissionsTable } from './ZohoPermissionsTable';

describe('ZohoPermissionsTable assigned-only picker', () => {
  it('asks whose inquiries to share when that box is turned off', () => {
    const onChange = vi.fn();
    render(
      <ZohoPermissionsTable
        permissions={{ 'inquiries.scope_assigned': true }}
        onChange={onChange}
        users={[{ id: 'user-b', name: 'Asha', employee_id: 'EMP2' }]}
        visibilityScope={{}}
        onVisibilityChange={vi.fn()}
      />,
    );

    const label = screen.getByText(/handle and rate inquiries/i).closest('label');
    fireEvent.click(label!.querySelector('button')!);

    expect(
      screen.getByText('Whose else inquiries should this user see?'),
    ).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
