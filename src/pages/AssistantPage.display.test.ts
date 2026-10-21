import { describe, expect, it } from 'vitest';
import { formatUserDisplayMessage } from './AssistantPage';

describe('procurement button labels', () => {
  it('shows the button name instead of the row id', () => {
    expect(formatUserDisplayMessage('proc_1')).toBe('Pending prices');
    expect(formatUserDisplayMessage('proc_2')).toBe('Current inquiries');
    expect(formatUserDisplayMessage('proc_3')).toBe('Log a Base Price');
    expect(formatUserDisplayMessage('proc_4')).toBe('My team');
    expect(formatUserDisplayMessage('menu_price')).toBe('Add Price to Inquiry');
    expect(formatUserDisplayMessage('btn_price_current|PR-10001')).toBe('Price the current inquiry');
    expect(formatUserDisplayMessage('btn_price_save')).toBe('Save');
    expect(formatUserDisplayMessage('btn_confirm_cancel')).toBe('Cancel');
  });
});
