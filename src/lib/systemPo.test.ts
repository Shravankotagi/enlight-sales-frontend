import { describe, expect, it } from "vitest";
import {
  createSystemPoReservationToken,
  getPoErrorMessage,
  normalizeSystemPoAllocation,
} from "./systemPo";

describe("systemPo helpers", () => {
  it("creates unique, prefixed reservation tokens", () => {
    const a = createSystemPoReservationToken("order-modal");
    const b = createSystemPoReservationToken("order-modal");
    expect(a).toMatch(/^order-modal:\d+:[a-z0-9]+$/);
    expect(a).not.toBe(b);
  });

  it("normalizes a wrapped or bare allocation response", () => {
    const allocation = { po_number: " EM/PO/7 ", po_reservation_token: "tok" };
    expect(normalizeSystemPoAllocation({ data: allocation })).toEqual({
      po_number: "EM/PO/7",
      generated_po_number: "EM/PO/7",
      po_reservation_token: "tok",
    });
    expect(
      normalizeSystemPoAllocation({
        ...allocation,
        generated_po_number: "EM/PO/6",
      })?.generated_po_number,
    ).toBe("EM/PO/6");
  });

  it("rejects allocations without a PO number or reservation token", () => {
    expect(normalizeSystemPoAllocation({ po_number: "EM/PO/7" })).toBeNull();
    expect(
      normalizeSystemPoAllocation({ po_reservation_token: "tok" }),
    ).toBeNull();
    expect(normalizeSystemPoAllocation(null)).toBeNull();
  });

  it("prefers the server message, then the error message, then the fallback", () => {
    expect(
      getPoErrorMessage({ response: { data: { message: "Taken" } } }),
    ).toBe("Taken");
    expect(
      getPoErrorMessage({ response: { data: { error: "Conflict" } } }),
    ).toBe("Conflict");
    expect(getPoErrorMessage(new Error("Network"))).toBe("Network");
    expect(getPoErrorMessage(undefined)).toBe(
      "This PO number is already allocated.",
    );
  });

  it("formats structured View PO source details instead of Original PO Document placeholder", async () => {
    const { formatOrderSourceText } = await import("../pages/OrdersPage");
    const formatted = formatOrderSourceText({
      id: "deal-49",
      po_number: "EM/PO/49",
      customer_name: "Zenith Metal Works Pvt Ltd",
      delivery_location:
        "Suraj SIM Techno Works Pvt Ltd, Gut. No. 61/62/63, Shendurwada Road , Village Murmi, Dahegaon (B), Tq. Gangapur, Dist. CH. SAMBHAJINAGAR, Maharashtra - 431133, India",
      payment_terms: "Pmt immediate after delivery.",
      raw_text:
        "[PO Document Attached: EM/PO/45] Zenith Metal Works Pvt Ltd - Original PO Document",
      deal_items: [
        {
          sku_text: "HR PLATE",
          dimensions: "05X1500X6300MM",
          quantity: 50,
          unit: "MT",
          rate: 64200,
        },
        {
          sku_text: "HR PLATE",
          dimensions: "08X1500X6300MM",
          quantity: 50,
          unit: "MT",
          rate: 64200,
        },
      ],
      inquiries: {
        ai_extraction_json: {
          additional_notes:
            "TC Must Be Supplied Along With Invoice. Invoice, TC and E -way Bill along with Vechile to be provided.",
        },
      },
    } as any);

    expect(formatted).toBe(
      [
        "Original Source Message:",
        "Material:",
        "1. HR PLATE (05X1500X6300MM) - 50 MT @ ₹64200",
        "2. HR PLATE (08X1500X6300MM) - 50 MT @ ₹64200",
        "Delivery: Gut. No. 61/62/63, Shendurwada Road , Village Murmi, Dahegaon (B), Tq. Gangapur, Dist. CH. SAMBHAJINAGAR, Maharashtra - 431133, India",
        "Payment Terms: Pmt immediate after delivery.",
        "Notes: TC Must Be Supplied Along With Invoice. Invoice, TC and E -way Bill along with Vechile to be provided.",
        "PO Number: EM/PO/49",
      ].join("\n"),
    );
  });

  it("detects stale inquiry raw_text and falls back to structured line items", async () => {
    const { formatOrderSourceText } = await import("../pages/OrdersPage");
    const formatted = formatOrderSourceText({
      id: "deal-53",
      po_number: "EM/PO/53",
      customer_name: "Shree Balaji Pre-Engineered Buildings",
      delivery_location: "Bengaluru, Karnataka",
      raw_text:
        "Material:\n1. HR Coil (5x1250): 10 MT @ ₹1/MT\nSubtotal: ₹881\nPO Number: EM/PO/53",
      deal_items: [
        {
          sku_text: "GI Sheet (Galvanized Plain Coil)",
          quantity: 35,
          unit: "MT",
          rate: 66500,
        },
        { sku_text: "Chequered Plate", quantity: 15, unit: "MT", rate: 58000 },
        {
          sku_text: "MS Angle (Equal Angle)",
          quantity: 12,
          unit: "MT",
          rate: 52500,
        },
      ],
    } as any);

    expect(formatted).toContain(
      "GI Sheet (Galvanized Plain Coil) - 35 MT @ ₹66500",
    );
    expect(formatted).toContain("Chequered Plate - 15 MT @ ₹58000");
    expect(formatted).toContain("MS Angle (Equal Angle) - 12 MT @ ₹52500");
    expect(formatted).not.toContain("HR Coil (5x1250)");
  });

  it("correctly maps getOrderSourceChannel for dashboard uploads even with stale inquiry channel", async () => {
    const { getOrderSourceChannel } = await import("../pages/OrdersPage");
    expect(
      getOrderSourceChannel({
        id: "deal-1",
        po_source: "upload",
        source_channel: "web_dashboard",
        inquiries: { source_channel: "ai_assistant" },
      } as any),
    ).toBe("Dashboard");

    expect(
      getOrderSourceChannel({
        id: "deal-2",
        inquiry_type: "purchase_order",
        inquiries: { source_channel: "ai_assistant" },
      } as any),
    ).toBe("Dashboard");

    expect(
      getOrderSourceChannel({
        id: "deal-3",
        source_channel: "whatsapp",
        inquiries: { source_channel: "whatsapp" },
      } as any),
    ).toBe("WhatsApp");
  });

  it("aggregates document preview URLs from deal and inquiry", async () => {
    const { getOrderSourceDocuments } = await import("../pages/OrdersPage");
    const docs = getOrderSourceDocuments({
      id: "deal-1",
      media_urls: ["attached_document"],
      inquiries: {
        media_urls: ["data:application/pdf;base64,JVBERi0xLjQK..."],
      },
    } as any);
    expect(docs).toEqual(["data:application/pdf;base64,JVBERi0xLjQK..."]);
  });
});
