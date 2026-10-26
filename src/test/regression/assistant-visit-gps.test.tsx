// Issue: <add GitHub issue link>
// Choosing log visit in the assistant starts the same device location watch as the visit form.
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantPage from '../../pages/AssistantPage';
import { chatbotApi } from '../../lib/api';
import { renderWithProviders } from '../renderWithProviders';

const SESSION_ID = 'session-visit';

vi.mock('../../lib/api', () => ({
  chatbotApi: {
    sendMessage: vi.fn().mockResolvedValue({ data: { reply: 'Noted.', sessionId: 'session-visit' } }),
    getSessions: vi.fn().mockResolvedValue({ data: { sessions: [] } }),
    getSessionMessages: vi.fn().mockResolvedValue({ data: { messages: [] } }),
  },
  visitsApi: {
    reverseGeocode: vi.fn().mockResolvedValue({ data: { address: '' } }),
  },
  postAuthLogout: vi.fn(),
}));

function sessionReply(content: string) {
  vi.mocked(chatbotApi.getSessions).mockResolvedValue({
    data: { sessions: [{ id: SESSION_ID, channel: 'web', started_at: '', last_active_at: '' }] },
  } as never);
  vi.mocked(chatbotApi.getSessionMessages).mockResolvedValue({
    data: {
      messages: [{ id: 'm1', role: 'assistant', content }],
    },
  } as never);
}

describe('assistant visit location watch', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('enlight_active_chat_session_id', SESSION_ID);
    Element.prototype.scrollIntoView = () => undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: () => 1,
        clearWatch: () => undefined,
      },
    });
  });

  it('starts reading the device location when log visit opens', async () => {
    sessionReply('**Log Customer Field Visit**\n\n- **Location is auto-fetched.**');
    renderWithProviders(<AssistantPage />);

    expect(await screen.findByText('Reading the visit location…')).toBeTruthy();
  });

  it('does not read the device location for an ordinary reply', async () => {
    sessionReply('Ask about pipeline deals.');
    renderWithProviders(<AssistantPage />);

    await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => {
      expect(screen.queryByText('Reading the visit location…')).toBeNull();
    });
  });
});
