import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

vi.mock('../lib/api', () => ({
  rolesApi: {
    me: vi.fn(),
  },
}));

import { rolesApi } from '../lib/api';

function Probe() {
  const { can } = useAuth();
  return <div>{can('staff.manage_acl') ? 'acl-yes' : 'acl-no'}</div>;
}

describe('AuthContext permissions', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(rolesApi.me).mockReset();
  });

  it('uses the signed-in admin permissions while viewing a salesperson', async () => {
    sessionStorage.setItem('enlight_token', 'token');
    sessionStorage.setItem(
      'enlight_employee',
      JSON.stringify({
        id: 'admin-1',
        employee_id: 'E1',
        name: 'Admin',
        phone: '9000000000',
        role: 'admin',
      }),
    );
    sessionStorage.setItem(
      'enlight_viewing_as',
      JSON.stringify({
        id: 'sp-1',
        employee_id: 'E2',
        name: 'Rep',
        phone: '9200000001',
        role: 'salesperson',
      }),
    );
    vi.mocked(rolesApi.me).mockResolvedValue({
      data: {
        permissions: { 'staff.manage_acl': true },
        dataScope: 'all',
        roleName: 'Admin',
      },
    } as any);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('acl-yes')).toBeTruthy();
  });

  it('falls back to the role template when /auth/me fails', async () => {
    sessionStorage.setItem('enlight_token', 'token');
    sessionStorage.setItem(
      'enlight_employee',
      JSON.stringify({
        id: 'sp-1',
        employee_id: 'E2',
        name: 'Rep',
        phone: '9200000001',
        role: 'salesperson',
      }),
    );
    vi.mocked(rolesApi.me).mockRejectedValue(new Error('offline'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('acl-no')).toBeTruthy();
  });

  it('allows an admin to can() any permission regardless of server permissions payload', async () => {
    sessionStorage.setItem('enlight_token', 'token');
    sessionStorage.setItem(
      'enlight_employee',
      JSON.stringify({
        id: 'admin-1',
        employee_id: 'E1',
        name: 'Admin',
        phone: '9000000000',
        role: 'admin',
      }),
    );
    vi.mocked(rolesApi.me).mockResolvedValue({
      data: {
        permissions: {},
        dataScope: 'all',
        roleName: 'Admin',
      },
    } as any);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('acl-yes')).toBeTruthy();
  });
});
