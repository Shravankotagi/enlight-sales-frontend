import { describe, expect, it } from 'vitest';
import { calculateProcurementPricing, quantityToMt } from './procurementPricing';

describe('procurement pricing', () => {
  it('converts KG to MT and calculates transport, margin and GST', () => {
    expect(quantityToMt(7500, 'KG')).toBe(7.5);

    const result = calculateProcurementPricing({
      basePricePerMt: 50000,
      transportPerMt: 2000,
      marginPercent: 10,
      quantity: 7500,
      unit: 'KG',
    });

    expect(result.quantityMt).toBe(7.5);
    expect(result.sellRatePerMt).toBeCloseTo(57200);
    expect(result.subtotal).toBeCloseTo(429000);
    expect(result.gst.grandTotal).toBe(506220);
  });

  it('never produces a negative price from invalid inputs', () => {
    const result = calculateProcurementPricing({
      basePricePerMt: -1,
      transportPerMt: -1,
      marginPercent: -5,
      quantity: -10,
      unit: 'MT',
    });

    expect(result.quantityMt).toBe(0);
    expect(result.sellRatePerMt).toBe(0);
    expect(result.gst.grandTotal).toBe(0);
  });
});
