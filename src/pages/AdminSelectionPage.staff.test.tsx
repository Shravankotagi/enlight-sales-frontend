import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSelectionPage from './AdminSelectionPage';

const permissions = new Set<string>();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    token: 'token',
    employee: {
      id: 'e1',
      name: 'Shravan',
      role: 'salesperson',
      phone: '918262937458',
      employee_id: 'EMP013',
    },
    setViewingAs: vi.fn(),
    clearViewingAs: vi.fn(),
    isSalesManager: false,
    isAdmin: false,
    can: (key: string) => permissions.has(key),
  }),
}));

vi.mock('../lib/api', () => ({
  employeesApi: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'e1',
          name: 'Shravan',
          role: 'salesperson',
          phone: '918262937458',
          employee_id: 'EMP013',
          email: 'shravan@enlightmetals.com',
          is_active: true,
        },
      ],
    }),
  },
  customersApi: {},
  rolesApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
}));

describe('User Management staff actions', () => {
  beforeEach(() => {
    permissions.clear();
    permissions.add('staff.view');
  });

  it('keeps the directory when role setup is off and hides add and edit', async () => {
    render(
      <MemoryRouter>
        <AdminSelectionPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Team & Account Directory')).toBeTruthy();
    expect(screen.getByText('Sales Team')).toBeTruthy();
    expect(screen.queryByText('Add Member')).toBeNull();
    expect(screen.queryByTitle('Edit Account Details')).toBeNull();
  });

  it('shows add and edit only when those staff permissions are on', async () => {
    permissions.add('staff.create');
    permissions.add('staff.manage');
    render(
      <MemoryRouter>
        <AdminSelectionPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Add Member')).toBeTruthy();
    expect(screen.getByTitle('Edit Account Details')).toBeTruthy();
  });
});
