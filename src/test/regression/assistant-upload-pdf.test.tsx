// Upload from device accepts a PDF and refuses an image.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantPage from '../../pages/AssistantPage';
import { renderWithProviders } from '../renderWithProviders';

vi.mock('../../lib/api', () => ({
  chatbotApi: {
    sendMessage: vi.fn().mockResolvedValue({ data: { reply: 'Noted.', sessionId: 'session-upload' } }),
    getSessions: vi.fn().mockResolvedValue({ data: { sessions: [] } }),
    getSessionMessages: vi.fn().mockResolvedValue({ data: { messages: [] } }),
  },
  visitsApi: {
    reverseGeocode: vi.fn().mockResolvedValue({ data: { address: '' } }),
  },
  postAuthLogout: vi.fn(),
}));

function fileInput() {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('Missing upload input');
  return input;
}

function chooseFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  fireEvent.change(input);
}

describe('assistant upload from device', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Element.prototype.scrollIntoView = () => undefined;
  });

  it('accepts a PDF and refuses an image', async () => {
    renderWithProviders(<AssistantPage />);
    await screen.findByRole('textbox', { name: 'Message' });

    const input = fileInput();
    expect(input.accept).toBe('.pdf,application/pdf');
    expect(input.accept.includes('image')).toBe(false);

    chooseFile(input, new File(['photo'], 'site.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByText('Upload a PDF. Use Capture an image for photos.')).toBeTruthy();
    expect(screen.queryByText('site.jpg')).toBeNull();

    chooseFile(input, new File(['photo'], 'site.png', { type: '' }));
    expect(screen.queryByText('site.png')).toBeNull();

    chooseFile(input, new File(['%PDF-1.4'], 'quote.pdf', { type: 'application/pdf' }));
    await waitFor(() => {
      expect(screen.getByText('quote.pdf')).toBeTruthy();
    });
    expect(screen.getByText('PDF document ready to send')).toBeTruthy();
    expect(screen.queryByText('Upload a PDF. Use Capture an image for photos.')).toBeNull();
  });
});
