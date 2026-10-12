import { describe, expect, it } from 'vitest';
import { getVisitsSalespersonFilterValue } from '../../utils/visitFilters';

describe('Visits salesperson filter regression', () => {
  it('shows the selected rep while viewing as that salesperson', () => {
    expect(getVisitsSalespersonFilterValue({ name: 'Akruti' })).toBe('Akruti');
  });

  it('keeps the all-salespersons value for normal admin view', () => {
    expect(getVisitsSalespersonFilterValue(null)).toBe('all');
    expect(getVisitsSalespersonFilterValue()).toBe('all');
  });
});

