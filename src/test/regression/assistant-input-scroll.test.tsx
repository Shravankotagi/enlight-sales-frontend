// Issue: <add GitHub issue link>
// A long assistant prompt scrolls inside the composer, and Enter still sends.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantPage from '../../pages/AssistantPage';
import { chatbotApi } from '../../lib/api';
import { renderWithProviders } from '../renderWithProviders';

vi.mock('../../lib/api', () => ({
  chatbotApi: {
    sendMessage: vi.fn().mockResolvedValue({ data: { reply: 'Noted.', sessionId: 'session-1' } }),
    getSessions: vi.fn().mockResolvedValue({ data: { sessions: [] } }),
    getSessionMessages: vi.fn().mockResolvedValue({ data: [] }),
  },
  visitsApi: {
    reverseGeocode: vi.fn().mockResolvedValue({ data: { address: '' } }),
  },
  postAuthLogout: vi.fn(),
}));

describe('assistant composer scroll', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Element.prototype.scrollIntoView = () => undefined;
    vi.mocked(chatbotApi.sendMessage).mockClear();
  });

  it('keeps a long prompt in a scrolling textarea', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AssistantPage />);
    const box = await screen.findByRole('textbox', { name: 'Message' });

    expect(box.tagName).toBe('TEXTAREA');
    expect(box.className).toContain('overflow-y-auto');
    expect(box.className).toContain('max-h-40');

    const longPrompt = 'Check the open pipeline for coated coils. '.repeat(40);
    await user.click(box);
    await user.paste(longPrompt);
    expect(box).toHaveValue(longPrompt);
  });

  it('sends on Enter and adds a line on Shift+Enter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AssistantPage />);
    const box = await screen.findByRole('textbox', { name: 'Message' });

    await user.click(box);
    await user.type(box, 'hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(box, 'world');

    expect(box).toHaveValue('hello\nworld');
    expect(chatbotApi.sendMessage).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(chatbotApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'hello\nworld' }),
      );
    });
    expect(box).toHaveValue('');
  });
});
