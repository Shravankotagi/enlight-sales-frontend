import { describe, expect, it } from "vitest";
import {
  calculateLineAmount,
  calculateLineRate,
  calculateProcurementPricing,
  getGstSplit,
  quantityToMt,
} from "./procurementPricing";

describe("procurement pricing", () => {
  it("converts KG to MT and adds every per-MT price field", () => {
    expect(quantityToMt(7500, "KG")).toBe(7.5);

    const result = calculateProcurementPricing({
      basePricePerMt: 50000,
      transportPerMt: 2000,
      loadingPerMt: 500,
      marginPerMt: 1200,
      quantity: 7500,
      unit: "KG",
    });

    expect(result.quantityMt).toBe(7.5);
    expect(result.sellRatePerMt).toBe(53700);
    expect(result.subtotal).toBe(402750);
    expect(result.gst.grandTotal).toBe(475245);
  });

  it("never produces a negative price from invalid inputs", () => {
    const result = calculateProcurementPricing({
      basePricePerMt: -1,
      transportPerMt: -1,
      loadingPerMt: -1,
      marginPerMt: -5,
      quantity: -10,
      unit: "MT",
    });

    expect(result.quantityMt).toBe(0);
    expect(result.sellRatePerMt).toBe(0);
    expect(result.gst.grandTotal).toBe(0);
  });

  it("calculates each line independently and splits GST by delivery state", () => {
    expect(
      calculateLineRate({
        basePricePerMt: 50000,
        transportPerMt: 1000,
        loadingPerMt: 300,
        marginPerMt: 700,
      }),
    ).toBe(52000);
    expect(calculateLineAmount(52000, 2, "MT")).toBe(104000);
    expect(getGstSplit(1000, "Pune, Maharashtra")).toMatchObject({
      type: "cgst_sgst",
      cgst: 90,
      sgst: 90,
      igst: 0,
    });
    expect(getGstSplit(1000, "Bengaluru, Karnataka")).toMatchObject({
      type: "igst",
      cgst: 0,
      sgst: 0,
      igst: 180,
    });
  });
});
