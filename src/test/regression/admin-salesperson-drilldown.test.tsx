/**
 * Regression: Admin Overview ignored the selected salesperson when opening
 * Detailed Analytics and showed company-wide Inquiries data.
 * Issue: <add GitHub issue link>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../renderWithProviders';
import { setAdminDashboardData } from '../adminDashboardMocks';
import AdminDashboard from '../../pages/AdminDashboard';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});
vi.mock('../../lib/api', async () => (await import('../adminDashboardMocks')).adminApi);

describe('Admin Overview salesperson drill-down', () => {
  beforeEach(() => {
    sessionStorage.clear();
    navigate.mockReset();
    setAdminDashboardData({
      employees: [
        { name: 'Akruti', phone: '9200000001', role: 'salesperson', employee_id: 'EMP-1' },
      ],
    });
  });

  it('opens selected salesperson analytics in personal Inquiries context', async () => {
    renderWithProviders(<AdminDashboard />);
    await screen.findByText('Leaderboard Scores');

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '9200000001' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Detailed Analytics' }));

    expect(navigate).toHaveBeenCalledWith('/inquiries?returnTo=/admin-dashboard');
    expect(JSON.parse(sessionStorage.getItem('enlight_viewing_as') || '{}')).toMatchObject({
      name: 'Akruti',
      phone: '9200000001',
      role: 'salesperson',
      mode: 'personal',
    });
  });

  it('keeps the company-wide pipeline behavior when no salesperson is selected', async () => {
    renderWithProviders(<AdminDashboard />);
    await screen.findByText('Leaderboard Scores');

    fireEvent.click(screen.getByRole('button', { name: 'Detailed Analytics' }));

    expect(navigate).toHaveBeenCalledWith('/pipeline');
    expect(sessionStorage.getItem('enlight_viewing_as')).toBeNull();
  });
});
