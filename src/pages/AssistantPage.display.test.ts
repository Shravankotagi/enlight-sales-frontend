import { describe, expect, it } from 'vitest';
import { formatUserDisplayMessage } from './AssistantPage';

describe('procurement button labels', () => {
  it('shows the button name instead of the row id', () => {
    expect(formatUserDisplayMessage('proc_1')).toBe('Pending prices');
    expect(formatUserDisplayMessage('proc_2')).toBe('Current inquiries');
    expect(formatUserDisplayMessage('proc_3')).toBe('Log a Base Price');
    expect(formatUserDisplayMessage('proc_4')).toBe('My team');
  });
});
