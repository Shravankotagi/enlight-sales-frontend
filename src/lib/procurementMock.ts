export type ProcurementLineStatus = "needs_price" | "priced" | "cannot_price";
export type ProcurementStatus =
  | "needs_pricing"
  | "price_added"
  | "partly_priced"
  | "cannot_price"
  | "quote_sent";

export interface ProcurementLineItem {
  sku_text: string;
  grade?: string;
  dimensions?: string;
  quantity: number;
  unit: string;
  line_key?: string;
  base_price_per_mt?: number;
  line_status: ProcurementLineStatus;
  line_note?: string;
}

export interface ProcurementRequest {
  id: string;
  inquiry_id?: string;
  salesperson_name: string;
  delivery_region: string;
  requested_at: string;
  line_items: ProcurementLineItem[];
  quote_sent?: boolean;
  request_note?: string;
}

export interface InquirySalesPricingLine {
  basePricePerMt: number | "";
  transportPerMt: number | "";
  loadingPerMt: number | "";
  marginPerMt: number | "";
}

export interface InquirySalesPricing {
  lines: InquirySalesPricingLine[];
  saved: boolean;
}

export type InquiryPricingStatus =
  "awaiting_price" | "price_ready" | "unavailable" | "pricing_saved";

const SEED_REQUESTS: ProcurementRequest[] = [
  {
    id: "PR-1042",
    salesperson_name: "Akruti",
    delivery_region: "West India",
    requested_at: "2026-10-12T08:30:00Z",
    line_items: [
      {
        sku_text: "Hot Rolled Coil",
        grade: "IS 2062 E250",
        dimensions: "2.5mm x 1250mm",
        quantity: 18,
        unit: "MT",
        line_status: "needs_price",
      },
      {
        sku_text: "GI Sheet",
        grade: "DX51D",
        dimensions: "1.2mm x 1220mm",
        quantity: 7500,
        unit: "KG",
        line_status: "needs_price",
      },
    ],
  },
  {
    id: "PR-1041",
    salesperson_name: "Shravan",
    delivery_region: "North India",
    requested_at: "2026-10-11T13:10:00Z",
    line_items: [
      {
        sku_text: "MS Plate",
        grade: "IS 2062 E250",
        dimensions: "8mm x 1500mm x 6000mm",
        quantity: 12,
        unit: "MT",
        line_status: "needs_price",
      },
    ],
  },
  {
    id: "PR-1040",
    salesperson_name: "Rishabh",
    delivery_region: "Central India",
    requested_at: "2026-10-10T09:00:00Z",
    line_items: [
      {
        sku_text: "MS Plate",
        grade: "IS 2062 E250",
        dimensions: "8mm x 1500mm x 6000mm",
        quantity: 12,
        unit: "MT",
        base_price_per_mt: 58400,
        line_status: "priced",
      },
    ],
  },
  {
    id: "PR-1039",
    salesperson_name: "Akruti",
    delivery_region: "South India",
    requested_at: "2026-10-09T11:20:00Z",
    quote_sent: true,
    line_items: [
      {
        sku_text: "CR Coil",
        grade: "IS 513 CR2",
        dimensions: "0.8mm x 1000mm",
        quantity: 9,
        unit: "MT",
        base_price_per_mt: 67200,
        line_status: "priced",
      },
    ],
  },
  {
    id: "PR-1038",
    salesperson_name: "Shravan",
    delivery_region: "West India",
    requested_at: "2026-10-08T10:45:00Z",
    request_note: "Please check alternate thickness with the customer.",
    line_items: [
      {
        sku_text: "Aluminium Sheet",
        grade: "AA 5052",
        dimensions: "2mm x 1250mm",
        quantity: 4200,
        unit: "KG",
        base_price_per_mt: 248000,
        line_status: "priced",
      },
      {
        sku_text: "Stainless Steel Sheet",
        grade: "SS 304 2B",
        dimensions: "1.5mm x 1500mm",
        quantity: 6,
        unit: "MT",
        line_status: "cannot_price",
        line_note: "Out of stock at approved suppliers.",
      },
    ],
  },
];

const STORAGE_KEY = "enlight_procurement_prototype_requests";
const SALES_PRICING_STORAGE_KEY = "enlight_procurement_prototype_sales_pricing";

const readRequests = (): ProcurementRequest[] => {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return SEED_REQUESTS;
  try {
    return JSON.parse(saved) as ProcurementRequest[];
  } catch {
    return SEED_REQUESTS;
  }
};

const writeRequests = (requests: ProcurementRequest[]) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  return requests;
};

const readSalesPricing = (): Record<string, InquirySalesPricing> => {
  try {
    return JSON.parse(
      sessionStorage.getItem(SALES_PRICING_STORAGE_KEY) || "{}",
    );
  } catch {
    return {};
  }
};

const writeSalesPricing = (pricing: Record<string, InquirySalesPricing>) => {
  sessionStorage.setItem(SALES_PRICING_STORAGE_KEY, JSON.stringify(pricing));
};

const requestIdForInquiry = (inquiryId: string) => {
  const numericPart = Number(String(inquiryId).replace(/\D/g, "").slice(-4));
  return `PR-${Number.isFinite(numericPart) && numericPart > 0 ? numericPart : 2000 + readRequests().length}`;
};

export const procurementMock = {
  list: () =>
    readRequests()
      .slice()
      .sort((a, b) => {
        const aNeedsPricing = a.line_items.some(
          (item) => item.line_status === "needs_price",
        );
        const bNeedsPricing = b.line_items.some(
          (item) => item.line_status === "needs_price",
        );
        if (aNeedsPricing !== bNeedsPricing) return aNeedsPricing ? -1 : 1;
        return aNeedsPricing
          ? new Date(a.requested_at).getTime() -
              new Date(b.requested_at).getTime()
          : new Date(b.requested_at).getTime() -
              new Date(a.requested_at).getTime();
      }),
  getOne: (id: string) =>
    readRequests().find((request) => request.id === id) || null,
  saveLinePricing: (
    id: string,
    lineItems: ProcurementLineItem[],
    requestNote = "",
  ) => {
    const next = readRequests().map((request) =>
      request.id === id
        ? { ...request, line_items: lineItems, request_note: requestNote }
        : request,
    );
    writeRequests(next);
    return next.find((request) => request.id === id) || null;
  },
  markQuotationSent: (id: string) => {
    const next = readRequests().map((request) =>
      request.id === id ? { ...request, quote_sent: true } : request,
    );
    writeRequests(next);
    return next.find((request) => request.id === id) || null;
  },
  ensureRequestForInquiry: (inquiry: {
    id: string;
    salesperson_name?: string;
    assigned_salesperson_name?: string;
    delivery_location?: string;
    deliveryLocation?: string;
    created_at?: string;
    ai_extraction_json?: any;
  }) => {
    const requests = readRequests();
    const existing = requests.find(
      (request) => request.inquiry_id === inquiry.id,
    );
    if (existing) return existing;
    const rawItems =
      inquiry.ai_extraction_json?.line_items ||
      inquiry.ai_extraction_json?.lineItems ||
      [];
    const line_items: ProcurementLineItem[] = (
      rawItems.length
        ? rawItems
        : [
            {
              sku_text: inquiry.ai_extraction_json?.productType || "Material",
              quantity: inquiry.ai_extraction_json?.quantityTons || 0,
              unit: "MT",
            },
          ]
    ).map((item: any) => ({
      sku_text: item.sku_text || item.description || "Material",
      grade: item.grade,
      dimensions: item.dimensions,
      quantity:
        Number(item.original_quantity ?? item.quantity ?? item.qty) || 0,
      unit: item.original_unit || item.unit || "MT",
      line_status: "needs_price",
    }));
    const request: ProcurementRequest = {
      id: requestIdForInquiry(inquiry.id),
      inquiry_id: inquiry.id,
      salesperson_name:
        inquiry.salesperson_name ||
        inquiry.assigned_salesperson_name ||
        "Salesperson",
      delivery_region:
        inquiry.delivery_location ||
        inquiry.deliveryLocation ||
        "Delivery location pending",
      requested_at: inquiry.created_at || new Date().toISOString(),
      line_items,
    };
    writeRequests([...requests, request]);
    return request;
  },
  getInquiryPricing: (inquiryId: string): InquirySalesPricing | null =>
    readSalesPricing()[inquiryId] || null,
  saveInquiryPricing: (inquiryId: string, pricing: InquirySalesPricing) => {
    const next = { ...readSalesPricing(), [inquiryId]: pricing };
    writeSalesPricing(next);
    return next[inquiryId];
  },
};

export const inquiryPricingStatus = (
  request: ProcurementRequest,
  pricing: InquirySalesPricing | null,
): InquiryPricingStatus => {
  if (pricing?.saved) return "pricing_saved";
  if (request.line_items.some((line) => line.line_status === "priced"))
    return "price_ready";
  if (request.line_items.every((line) => line.line_status === "cannot_price"))
    return "unavailable";
  return "awaiting_price";
};

export const inquiryPricingStatusLabel: Record<InquiryPricingStatus, string> = {
  awaiting_price: "Awaiting Price",
  price_ready: "Price Ready",
  unavailable: "Unavailable",
  pricing_saved: "Price Quote",
};

export const inquiryPricingStatusClasses: Record<InquiryPricingStatus, string> =
  {
    awaiting_price: "bg-amber-100 text-amber-800 border-amber-200",
    price_ready: "bg-blue-100 text-blue-800 border-blue-200",
  unavailable: "bg-rose-100 text-rose-800 border-rose-200",
    pricing_saved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

export const getProcurementStatus = (
  request: ProcurementRequest,
): ProcurementStatus => {
  if (request.quote_sent) return "quote_sent";
  const lines = request.line_items;
  if (lines.some((line) => line.line_status === "needs_price"))
    return "needs_pricing";
  if (lines.every((line) => line.line_status === "priced"))
    return "price_added";
  if (lines.every((line) => line.line_status === "cannot_price"))
    return "cannot_price";
  return "partly_priced";
};

export const procurementStatusLabel: Record<ProcurementStatus, string> = {
  needs_pricing: "Needs Pricing",
  price_added: "Price Added",
  partly_priced: "Partly Priced",
  cannot_price: "Can't Price",
  quote_sent: "Quote Sent",
};

export const procurementStatusClasses: Record<ProcurementStatus, string> = {
  needs_pricing: "bg-amber-50 text-amber-700 border-amber-200",
  price_added: "bg-blue-50 text-blue-700 border-blue-200",
  partly_priced: "bg-violet-50 text-violet-700 border-violet-200",
  cannot_price: "bg-rose-50 text-rose-700 border-rose-200",
  quote_sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function requestFromInquiry(inquiry: any): ProcurementRequest {
  const ai = inquiry?.ai_extraction_json || {};
  const source = ai.line_items || ai.lineItems || [];
  const line_items = (source.length ? source : [{ sku_text: "Material", quantity: 0, unit: "MT" }]).map(
    (item: any, index: number) => ({
      line_key: String(item.id || item.line_key || `${index}:${item.sku_text || item.description || "Material"}`),
      sku_text: item.sku_text || item.description || "Material",
      dimensions: item.dimensions,
      quantity: Number(item.original_quantity ?? item.quantity ?? item.qty) || 0,
      unit: item.original_unit || item.unit || "MT",
      line_status: "needs_price" as ProcurementLineStatus,
    }),
  );
  return {
    id: inquiry?.procurement_number || "",
    inquiry_id: inquiry?.id,
    salesperson_name: inquiry?.assigned_salesperson_name || inquiry?.salesperson_name || "Salesperson",
    delivery_region: inquiry?.delivery_location || ai.delivery_location || "Delivery location pending",
    requested_at: inquiry?.created_at || new Date().toISOString(),
    request_note: inquiry?.procurement_note || "",
    line_items,
  };
}

export function mergeDrawerLineRates(previous: any[] | undefined, incoming: any[]) {
  return incoming.map((item, index) => {
    const prior = previous?.[index];
    const incomingRate = Number(item?.rate) || 0;
    const priorRate = Number(prior?.rate) || 0;
    if (incomingRate > 0 || !priorRate) return item;
    return {
      ...item,
      rate: prior.rate,
      amount: prior.amount,
      cgst_amount: prior.cgst_amount,
      sgst_amount: prior.sgst_amount,
      igst_amount: prior.igst_amount,
      total_gst: prior.total_gst,
      final_amount: prior.final_amount,
    };
  });
}

export function pricingResult(response: any) {
  const body = response?.data ?? response;
  const nested = body?.data;
  const payload =
    nested &&
    typeof nested === "object" &&
    (Array.isArray(nested.lines) || nested.pricing_status)
      ? nested
      : body;
  return {
    lines: Array.isArray(payload?.lines) ? payload.lines : [],
    pricing_status: payload?.pricing_status,
  };
}

export function applyServerLines(inquiry: any, rows: any[]) {
  const request = requestFromInquiry(inquiry);
  if (!rows?.length) {
    return {
      request,
      pricing: {
        lines: request.line_items.map(() => ({
          basePricePerMt: "" as const,
          transportPerMt: "" as const,
          loadingPerMt: "" as const,
          marginPerMt: "" as const,
        })),
        saved: inquiry?.pricing_status === "sales_priced",
      },
    };
  }
  request.line_items = rows.map((row) => ({
    line_key: row.line_key,
    sku_text: row.sku_text || "Material",
    quantity: Number(row.quantity) || 0,
    unit: row.unit || "MT",
    base_price_per_mt: row.procurement_base_price_per_mt ?? undefined,
    line_status: row.line_status || "needs_price",
    line_note: row.procurement_line_note || undefined,
  }));
  return {
    request,
    pricing: {
      saved: inquiry?.pricing_status === "sales_priced",
      lines: rows.map((row) => ({
        basePricePerMt: row.sales_base_price_per_mt ?? row.procurement_base_price_per_mt ?? "",
        transportPerMt: row.transport_per_mt ?? "",
        loadingPerMt: row.loading_per_mt ?? "",
        marginPerMt: row.margin_per_mt ?? "",
      })),
    },
  };
}

export function inquiryStatusFromServer(
  inquiry: any,
): InquiryPricingStatus | null {
  if (inquiry?.pricing_status === "sales_priced") return "pricing_saved";
  if (
    inquiry?.pricing_status === "price_ready" ||
    inquiry?.pricing_status === "unavailable" ||
    inquiry?.pricing_status === "awaiting_price"
  ) {
    return inquiry.pricing_status;
  }
  return null;
}
