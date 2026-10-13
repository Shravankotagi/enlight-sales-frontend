import { calculateQuotationBreakdown } from "./pricingEngine";

export interface ProcurementPricingInput {
  basePricePerMt: number;
  transportPerMt: number;
  loadingPerMt: number;
  marginPerMt: number;
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
  const normalized = String(unit || "").toLowerCase();
  if (normalized === "kg" || normalized === "kgs")
    return Math.max(0, Number(quantity) || 0) / 1000;
  return Math.max(0, Number(quantity) || 0);
}

const money = (value: number) => Math.round(value * 100) / 100;

export function calculateLineRate(
  input: Pick<
    ProcurementPricingInput,
    "basePricePerMt" | "transportPerMt" | "loadingPerMt" | "marginPerMt"
  >,
): number {
  return money(
    Math.max(0, Number(input.basePricePerMt) || 0) +
      Math.max(0, Number(input.transportPerMt) || 0) +
      Math.max(0, Number(input.loadingPerMt) || 0) +
      Math.max(0, Number(input.marginPerMt) || 0),
  );
}

export function calculateLineAmount(
  ratePerMt: number,
  quantity: number,
  unit: string,
): number {
  return money(
    Math.max(0, Number(ratePerMt) || 0) * quantityToMt(quantity, unit),
  );
}

export function getGstSplit(amount: number, deliveryAddress = "") {
  const taxableAmount = Math.max(0, Number(amount) || 0);
  const isMaharashtra = /\bmaharashtra\b|\bmh\b/i.test(deliveryAddress);
  if (isMaharashtra) {
    const cgst = money(taxableAmount * 0.09);
    const sgst = money(taxableAmount * 0.09);
    return {
      type: "cgst_sgst" as const,
      cgst,
      sgst,
      igst: 0,
      total: money(cgst + sgst),
    };
  }
  const igst = money(taxableAmount * 0.18);
  return { type: "igst" as const, cgst: 0, sgst: 0, igst, total: igst };
}

export function calculateProcurementPricing(
  input: ProcurementPricingInput,
): ProcurementPricingResult {
  const quantityMt = quantityToMt(input.quantity, input.unit);
  const sellRatePerMt = calculateLineRate(input);
  const subtotal = calculateLineAmount(
    sellRatePerMt,
    input.quantity,
    input.unit,
  );

  return {
    quantityMt,
    sellRatePerMt,
    subtotal,
    gst: calculateQuotationBreakdown(subtotal),
  };
}
