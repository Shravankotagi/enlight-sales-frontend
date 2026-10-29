// An empty salesperson chat shows the welcome line and no prompt cards.
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantPage from '../../pages/AssistantPage';
import { chatbotApi } from '../../lib/api';
import { renderWithProviders } from '../renderWithProviders';

vi.mock('../../lib/api', () => ({
  chatbotApi: {
    sendMessage: vi.fn(),
    getSessions: vi.fn().mockResolvedValue({ data: { sessions: [] } }),
    getSessionMessages: vi.fn().mockResolvedValue({ data: [] }),
  },
  visitsApi: {
    reverseGeocode: vi.fn(),
  },
  postAuthLogout: vi.fn(),
}));

describe('salesperson assistant welcome', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Element.prototype.scrollIntoView = () => undefined;
    vi.mocked(chatbotApi.getSessions).mockResolvedValue({ data: { sessions: [] } } as never);
  });

  it('shows the Hi line and hides the salesperson prompt cards', async () => {
    renderWithProviders(<AssistantPage />);

    const heading = await screen.findByRole('heading', { name: 'Welcome to Enlight Sales OS Assistant' });
    const line = screen.getByText("I'm the Enlight Sigma AI assistant. Type Hi to see the actions you can take.");
    expect(heading.className).toContain('text-3xl');
    expect(line.className).toContain('text-2xl');
    expect(screen.queryByText('My Active Open Deals')).not.toBeInTheDocument();
    expect(screen.queryByText('Customer 360 Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Sales SOP Guidelines')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ask questions about your pipeline/)).not.toBeInTheDocument();
  });
});
