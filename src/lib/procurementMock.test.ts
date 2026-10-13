import { beforeEach, describe, expect, it } from "vitest";
import {
  getProcurementStatus,
  inquiryPricingStatus,
  procurementMock,
  type ProcurementRequest,
} from "./procurementMock";

describe("procurement prototype store", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps requests with products needing a price at the top", () => {
    const requests = procurementMock.list();
    expect(requests[0].id).toBe("PR-1041");
    expect(requests[1].id).toBe("PR-1042");
  });

  it("derives a partly priced status for mixed priced and unavailable products", () => {
    const request = procurementMock.getOne("PR-1038") as ProcurementRequest;
    expect(getProcurementStatus(request)).toBe("partly_priced");
  });

  it("creates a linked procurement request and persists sales pricing by inquiry", () => {
    const request = procurementMock.ensureRequestForInquiry({
      id: "inquiry-9999",
      salesperson_name: "Akruti",
      delivery_location: "Pune, Maharashtra",
      ai_extraction_json: {
        line_items: [{ sku_text: "HR Coil", quantity: 2, unit: "MT" }],
      },
    });
    expect(request.inquiry_id).toBe("inquiry-9999");
    expect(inquiryPricingStatus(request, null)).toBe("awaiting_price");

    procurementMock.saveLinePricing(request.id, [
      {
        ...request.line_items[0],
        base_price_per_mt: 50000,
        line_status: "priced",
      },
    ]);
    const pricedRequest = procurementMock.getOne(
      request.id,
    ) as ProcurementRequest;
    expect(inquiryPricingStatus(pricedRequest, null)).toBe("price_ready");

    procurementMock.saveInquiryPricing("inquiry-9999", {
      saved: true,
      lines: [
        {
          basePricePerMt: 50000,
          transportPerMt: 1000,
          loadingPerMt: 500,
          marginPerMt: 1500,
        },
      ],
    });
    expect(
      inquiryPricingStatus(
        pricedRequest,
        procurementMock.getInquiryPricing("inquiry-9999"),
      ),
    ).toBe("pricing_saved");
  });

  it("marks a partially priced request Price Ready and an all-unavailable request Unavailable", () => {
    const partial: ProcurementRequest = {
      id: "PR-partial",
      salesperson_name: "Sales",
      delivery_region: "West India",
      requested_at: "2026-10-13T00:00:00Z",
      line_items: [
        { sku_text: "Available", quantity: 1, unit: "MT", base_price_per_mt: 50000, line_status: "priced" },
        { sku_text: "Unavailable", quantity: 1, unit: "MT", line_status: "cannot_price" },
      ],
    };
    const unavailable: ProcurementRequest = {
      ...partial,
      id: "PR-unavailable",
      line_items: partial.line_items.map((line) => ({ ...line, base_price_per_mt: undefined, line_status: "cannot_price" })),
    };

    expect(inquiryPricingStatus(partial, null)).toBe("price_ready");
    expect(inquiryPricingStatus(unavailable, null)).toBe("unavailable");
  });
});
