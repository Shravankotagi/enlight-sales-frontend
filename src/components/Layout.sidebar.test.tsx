import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';

// Mock useAuth
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    employee: { id: 'emp-1', employee_id: 'EMP013', name: 'Shravan', role: 'salesperson', phone: '9876543210' },
    logout: vi.fn(),
    isAdmin: false,
    isSalesManager: false,
    clearViewingAs: vi.fn(),
    viewingAs: null,
  }),
}));

describe('Layout Sidebar Animation and State Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to open and persists sidebar open state in localStorage', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Layout>
          <div>Page Content</div>
        </Layout>
      </MemoryRouter>
    );

    // Sidebar should be open by default
    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(collapseBtn).toBeDefined();

    // Clicking collapse should switch state and store false in localStorage
    fireEvent.click(collapseBtn);
    expect(localStorage.getItem('em_sidebar_open')).toBe('false');

    // Expand button should now be available
    const expandBtn = screen.getByRole('button', { name: /expand sidebar/i });
    expect(expandBtn).toBeDefined();

    // Clicking expand should switch state back and store true in localStorage
    fireEvent.click(expandBtn);
    expect(localStorage.getItem('em_sidebar_open')).toBe('true');
  });

  it('restores collapsed state from localStorage on initial render', () => {
    localStorage.setItem('em_sidebar_open', 'false');

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Layout>
          <div>Page Content</div>
        </Layout>
      </MemoryRouter>
    );

    // Should render with expand button visible
    const expandBtn = screen.getByRole('button', { name: /expand sidebar/i });
    expect(expandBtn).toBeDefined();
  });

  it('applies fast 200ms transition with reduced-motion safety', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/home']}>
        <Layout>
          <div>Page Content</div>
        </Layout>
      </MemoryRouter>
    );

    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    // Verify 200ms duration and motion-reduce safety class
    expect(aside?.className).toContain('duration-200');
    expect(aside?.className).toContain('motion-reduce:transition-none');
    expect(aside?.className).toContain('will-change-[width,transform]');
  });

  it('smoothly enlarges on mouse enter and contracts on mouse leave', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/home']}>
        <Layout>
          <div>Page Content</div>
        </Layout>
      </MemoryRouter>
    );

    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain('lg:w-72');

    // Hover over sidebar -> should enlarge
    fireEvent.mouseEnter(aside!);
    expect(aside?.className).toContain('lg:w-[22rem]');

    // Mouse leave -> should smoothly return to lg:w-72
    fireEvent.mouseLeave(aside!);
    expect(aside?.className).toContain('lg:w-72');
  });
});
