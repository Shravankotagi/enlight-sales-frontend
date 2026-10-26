import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import Layout from './Layout';
import { render } from '@testing-library/react';

const employee = {
  id: 'demo-1',
  employee_id: 'EMP-DEMO',
  name: 'Demo User',
  phone: '9000000000',
  role: 'procurement_person',
};

describe('procurement role navigation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('enlight_token', 'demo-token');
    sessionStorage.setItem('enlight_employee', JSON.stringify(employee));
  });

  it('shows Procurement and hides salesperson navigation', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/inquiries']}>
          <Layout><div>Prototype content</div></Layout>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByRole('link', { name: 'Inquiries' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI Assistant' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Orders' })).not.toBeInTheDocument();
    expect(screen.getByText(/EMP-DEMO · Procurement Person/i)).toBeInTheDocument();
  });

  it('renders Procurement Manager role label and navigation correctly', () => {
    sessionStorage.setItem(
      'enlight_employee',
      JSON.stringify({ ...employee, role: 'procurement_manager' }),
    );

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/inquiries']}>
          <Layout><div>Prototype content</div></Layout>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByRole('link', { name: 'Inquiries' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI Assistant' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Orders' })).not.toBeInTheDocument();
    expect(screen.getByText(/EMP-DEMO · Procurement Manager/i)).toBeInTheDocument();
  });
});
