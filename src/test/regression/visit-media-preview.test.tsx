// Issue: <add GitHub issue link>
// A new visit shows the captured photo and each added document before save.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import VisitsPage from '../../pages/VisitsPage';
import { renderWithProviders } from '../renderWithProviders';

vi.mock('../../lib/api', () => ({
  visitsApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
    reverseGeocode: vi.fn().mockResolvedValue({ data: {} }),
  },
  employeesApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
  customersApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
  postAuthLogout: vi.fn(),
}));

vi.mock('../../components/VisitCameraCapture', () => ({
  default: ({
    onCapture,
  }: {
    onCapture: (
      photoUrl: string,
      coords: { latitude: number; longitude: number; accuracy: number },
    ) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onCapture('data:image/jpeg;base64,abc', {
          latitude: 18.52,
          longitude: 73.86,
          accuracy: 8,
        })
      }
    >
      Take visit photo
    </button>
  ),
}));

class TestDataTransfer {
  private stored: File[] = [];
  items = {
    add: (file: File) => {
      this.stored.push(file);
    },
  };
  get files(): FileList {
    const stored = this.stored;
    const list: FileList = {
      length: stored.length,
      item: (index: number) => stored[index] ?? null,
      *[Symbol.iterator]() {
        yield* stored;
      },
    } as FileList;
    stored.forEach((file, index) => {
      Object.defineProperty(list, index, { value: file });
    });
    return list;
  }
}

describe('new visit media preview', () => {
  it('previews the captured photo and each added document', async () => {
    vi.stubGlobal('DataTransfer', TestDataTransfer);
    const user = userEvent.setup();
    renderWithProviders(<VisitsPage />);
    await user.click(screen.getByRole('button', { name: 'Log Customer Visit' }));
    await user.click(screen.getByRole('button', { name: 'Take visit photo' }));

    await user.click(screen.getByRole('button', { name: 'Preview visit photo' }));
    expect(screen.getByRole('dialog', { name: 'Customer Visit Photo' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Customer Visit Photo' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close image preview' }));

    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing document input');
    const png = new File(['png'], 'site.png', { type: 'image/png' });
    const pdf = new File(['%PDF-1.4'], 'quote.pdf', { type: 'application/pdf' });
    await user.upload(input, [png, pdf]);

    await user.click(await screen.findByRole('button', { name: 'Preview site.png' }));
    expect(screen.getByRole('dialog', { name: 'site.png' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'site.png' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close image preview' }));

    await user.click(screen.getByRole('button', { name: 'Preview quote.pdf' }));
    expect(screen.getByRole('dialog', { name: 'quote.pdf' })).toBeTruthy();
    expect(screen.getByTitle('quote.pdf').tagName).toBe('IFRAME');
    vi.unstubAllGlobals();
  });
});
