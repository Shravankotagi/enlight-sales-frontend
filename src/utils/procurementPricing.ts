import { calculateQuotationBreakdown } from './pricingEngine';

export interface ProcurementPricingInput {
  basePricePerMt: number;
  transportPerMt: number;
  marginPercent: number;
  quantity: number;
  unit: string;
}

export interface ProcurementPricingResult {
  quantityMt: number;
  sellRatePerMt: number;
  subtotal: number;
  gst: ReturnType<typeof calculateQuotationBreakdown>;
}

export function quantityToMt(quantity: number, unit: string): number {
  const normalized = String(unit || '').toLowerCase();
  if (normalized === 'kg' || normalized === 'kgs') return Math.max(0, Number(quantity) || 0) / 1000;
  return Math.max(0, Number(quantity) || 0);
}

export function calculateProcurementPricing(input: ProcurementPricingInput): ProcurementPricingResult {
  const quantityMt = quantityToMt(input.quantity, input.unit);
  const base = Math.max(0, Number(input.basePricePerMt) || 0);
  const transport = Math.max(0, Number(input.transportPerMt) || 0);
  const margin = Math.max(0, Number(input.marginPercent) || 0) / 100;
  const sellRatePerMt = Math.round((base + transport) * (1 + margin) * 100) / 100;
  const subtotal = Math.round(sellRatePerMt * quantityMt * 100) / 100;

  return {
    quantityMt,
    sellRatePerMt,
    subtotal,
    gst: calculateQuotationBreakdown(subtotal),
  };
}
