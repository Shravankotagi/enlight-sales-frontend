import { describe, expect, it } from 'vitest';
import { selectMenuPlacement } from './select';

describe('select menu placement', () => {
  it('opens down when the list fits below', () => {
    expect(selectMenuPlacement(300, 100).dropUp).toBe(false);
  });

  it('opens up when the field is at the bottom of a popup', () => {
    expect(selectMenuPlacement(40, 320)).toEqual({ dropUp: true, maxHeight: 240 });
  });
});
