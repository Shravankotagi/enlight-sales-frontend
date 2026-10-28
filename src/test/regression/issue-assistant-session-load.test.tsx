// Issue: <add GitHub issue link>
// A failed session request must not look like an empty conversation history.
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantPage from '../../pages/AssistantPage';
import { chatbotApi } from '../../lib/api';
import { renderWithProviders } from '../renderWithProviders';

vi.mock('../../lib/api', () => ({
  chatbotApi: {
    sendMessage: vi.fn(),
    getSessions: vi.fn(),
    getSessionMessages: vi.fn(),
  },
  visitsApi: {
    reverseGeocode: vi.fn(),
  },
  postAuthLogout: vi.fn(),
}));

describe('assistant conversation history', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Element.prototype.scrollIntoView = () => undefined;
    vi.mocked(chatbotApi.getSessions).mockReset();
  });

  it('shows a load failure instead of an empty history', async () => {
    vi.mocked(chatbotApi.getSessions).mockRejectedValue(new Error('Network Error'));
    renderWithProviders(<AssistantPage />);

    expect(
      await screen.findByText('Conversation history could not be loaded. Try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No past sessions found/)).not.toBeInTheDocument();
  });
});
