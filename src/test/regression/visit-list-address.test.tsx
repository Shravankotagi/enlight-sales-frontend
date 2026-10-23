// Issue: <add GitHub issue link>
// The visits list shows the full autofetched address, not only the area and city.
import { describe, expect, it, vi } from 'vitest';
import { formatCityLocality } from '../../pages/VisitsPage';

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

const fullAddress =
  'Shree Ashtavinayak Building, Sadashiv Cross Ln, Khotachiwadi, Ambewadi, Girgaon, Mumbai, Maharashtra 400004, India';

describe('visit list address', () => {
  it('keeps the entire autofetched address', () => {
    expect(formatCityLocality(fullAddress)).toBe(fullAddress);
    expect(formatCityLocality('', '')).toBe('-');
    expect(formatCityLocality(null, null)).toBe('-');
  });
});
