// A session saved for another account must not be reopened or sent with the next message.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantPage from '../../pages/AssistantPage';
import { chatbotApi } from '../../lib/api';
import { renderWithProviders } from '../renderWithProviders';

const FOREIGN = 'foreign-session';
const OWN = 'own-session';

vi.mock('../../lib/api', () => ({
  chatbotApi: {
    sendMessage: vi.fn().mockResolvedValue({ data: { reply: 'Menu', sessionId: 'own-session' } }),
    getSessions: vi.fn(),
    getSessionMessages: vi.fn(),
  },
  visitsApi: {
    reverseGeocode: vi.fn(),
  },
  postAuthLogout: vi.fn(),
}));

describe('assistant saved session ownership', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Element.prototype.scrollIntoView = () => undefined;
    localStorage.setItem('enlight_active_chat_session_id', FOREIGN);
    sessionStorage.setItem(
      `enlight_active_chat_messages_${FOREIGN}`,
      JSON.stringify([{ id: 'hidden', role: 'assistant', content: 'Secret other chat' }]),
    );
    vi.mocked(chatbotApi.getSessions).mockResolvedValue({
      data: {
        sessions: [{ id: OWN, channel: 'web', started_at: '', last_active_at: '', title: 'Hi' }],
      },
    } as never);
    vi.mocked(chatbotApi.getSessionMessages).mockResolvedValue({
      data: { messages: [] },
    } as never);
    vi.mocked(chatbotApi.sendMessage).mockClear();
  });

  it('ignores a saved session from another account and sends Hi on this user session', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AssistantPage />);

    await waitFor(() => {
      expect(chatbotApi.getSessionMessages).toHaveBeenCalledWith(OWN);
    });
    expect(chatbotApi.getSessionMessages).not.toHaveBeenCalledWith(FOREIGN);
    expect(screen.queryByText('Secret other chat')).not.toBeInTheDocument();

    const box = await screen.findByRole('textbox', { name: 'Message' });
    await user.type(box, 'Hi{Enter}');

    await waitFor(() => {
      expect(chatbotApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Hi', sessionId: OWN }),
      );
    });
  });
});
