import { useState, useEffect, useRef, useMemo } from "react";
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FileText,
  Plus,
  Minus,
  Search,
  CheckCircle,
  RefreshCw,
  Bell,
  X,
  Building2,
  Calendar,
  Save,
  Check,
  UploadCloud,
  Send,
  ShoppingBag,
  Eye,
  ImageIcon,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  User,
  UserCheck,
  MoreVertical,
  Loader2,
  LayoutDashboard,
  IndianRupee,
  Trash2,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import {
  inquiriesApi,
  customersApi,
  employeesApi,
  dealsApi,
  zohoApi,
  activityLogsApi,
  logPoAllocationError,
} from "../lib/api";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../components/ui/dropdown-menu";
import toast from "react-hot-toast";
import type { DateFilterRange } from "../components/DateFilterControl";
import InquiryPdfModal from "../components/InquiryPdfModal";
import AddAssignedCustomerDialog, {
  isCustomerInAssignedList,
} from "../components/AddAssignedCustomerDialog";
import PaginationControl from "../components/PaginationControl";
import { Select } from "../components/ui/select";
import { normalizeListResponse, queryKeys } from "../lib/queryKeys";
import { useAuth } from "../context/AuthContext";
import {
  canFillProcurementBasePrices,
  canSendProcurementQuote,
} from "../utils/aclConstants";
import { getDaysAgo, formatLocalDate } from "../utils/dateUtils";
import {
  calculateLineItem,
  calculateLineItems,
  calculateSubtotal,
  calculateQuotationBreakdown,
  calculateTotalTonnageMt,
  displayedLineWeightMt,
  formatLineItemWeightMt,
  normalizeUnit,
  formatIndianCurrency,
} from "../utils/pricingEngine";
import { detectHsnCode } from "../utils/hsnDetector";
import {
  inquiryPricingStatusClasses,
  inquiryPricingStatusLabel,
  applyServerLines,
  inquiryStatusFromServer,
  mergeDrawerLineRates,
  pricingResult,
  type InquirySalesPricing,
  type ProcurementRequest,
} from "../lib/procurementMock";
import {
  calculateLineAmount,
  calculateLineRate,
  getGstSplit,
} from "../utils/procurementPricing";
import {
  addQuotationCcEmail,
  FIXED_QUOTATION_CC,
  isFixedQuotationCc,
  isValidQuotationEmail,
  normalizeQuotationEmail,
} from "../utils/quotationCc";

function withSalespersonCc(
  emails: string[],
  senderEmail: string,
  customerEmail = "",
): string[] {
  const sender = normalizeQuotationEmail(senderEmail || "");
  const customer = normalizeQuotationEmail(customerEmail || "");
  const rest = emails.filter(
    (email) => normalizeQuotationEmail(email) !== sender,
  );
  if (!sender || !isValidQuotationEmail(sender) || sender === customer) {
    return rest;
  }
  return [sender, ...rest];
}

function pricedLineAmount(rate: number, item: any) {
  return calculateLineAmount(
    rate,
    Number(item?.quantity) || 0,
    item?.unit || "MT",
    displayedLineWeightMt(item),
  );
}

function shownLineRate(item: any, pricingLine: any, procurementBase?: number) {
  const stored = Number(item?.rate) || 0;
  if (stored > 0) return stored;
  return calculateLineRate({
    basePricePerMt:
      Number(pricingLine?.basePricePerMt ?? procurementBase) || 0,
    transportPerMt: Number(pricingLine?.transportPerMt) || 0,
    loadingPerMt: Number(pricingLine?.loadingPerMt) || 0,
    creditPerMt: Number(pricingLine?.creditPerMt) || 0,
    marginPerMt: Number(pricingLine?.marginPerMt) || 0,
  });
}

function taxableLineAmount(item: any, rate: number) {
  if (rate > 0) {
    const fromRate = pricedLineAmount(rate, item);
    if (fromRate > 0) return fromRate;
  }
  return Number(item?.amount) || 0;
}

const PRICING_STATUS_RANK: Record<string, number> = {
  awaiting_price: 1,
  unavailable: 2,
  price_ready: 2,
  sales_priced: 3,
};

function keptPricingStatus(current?: string | null, incoming?: string | null) {
  const currentRank = PRICING_STATUS_RANK[String(current || "")] || 0;
  const incomingRank = PRICING_STATUS_RANK[String(incoming || "")] || 0;
  if (currentRank > incomingRank) return current || null;
  return incoming ?? current ?? null;
}

export interface InquiryItem {
  id: string;
  sender_name?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  sender_phone?: string;
  salesperson_name?: string;
  assigned_salesperson_name?: string;
  salesperson_phone?: string;
  payment_terms?: string;
  paymentTerms?: string;
  delivery_location?: string;
  deliveryLocation?: string;
  stage?: string;
  total_amount?: number;
  po_number?: string;
  po_date?: string;
  reference_po_number?: string;
  generated_po_number?: string;
  po_source?: string;
  po_status?: string;
  won_at?: string;
  lost_reason?: string;
  raw_text?: string;
  inquiry_type?: string;
  status?: string;
  source_channel?: string;
  media_urls?: string[];
  has_media?: boolean;
  preferred_make?: string;
  overall_confidence?: number;
  ai_extraction_json?: any;
  created_at: string;
  updated_at?: string;
  procurement_employee_id?: string | null;
  procurement_assigned_at?: string | null;
  procurement_number?: string | null;
  pricing_status?: string | null;
  tonnage_review_open?: boolean | null;
  tonnage_review?: {
    changed_at?: string | null;
    previous_total_mt?: number | null;
    next_total_mt?: number | null;
    lines?: { sku_text?: string; from_mt?: number; to_mt?: number }[];
  } | null;
  linked_deal_stage?: string | null;
  display_stage?: string | null;
}

export interface LineItemDetail {
  sku_text: string;
  dimensions?: string;
  brand?: string;
  make?: string;
  hsn_code?: string;
  quantity: number;
  unit?: string;
  rate: number | string;
  amount: number;
  isManualAmount?: boolean;
  converted_mt?: number | string;
  is_manual_mt?: boolean;
  cgst_rate?: number;
  cgst_amount?: number;
  sgst_rate?: number;
  sgst_amount?: number;
  total_gst?: number;
  final_amount?: number;
  base_price_per_mt?: number | "";
  transport_per_mt?: number | "";
  loading_per_mt?: number | "";
  credit_per_mt?: number | "";
  margin_per_mt?: number | "";
  igst_amount?: number;
}

export const NOS_MT_MISSING_MESSAGE =
  'MT not calculated: enter Length*Width*Thickness in spec (e.g. 2500*1250*10) or type MT manually.';

/** Nos weight comes from three dimensions. A typed MT is accepted instead. */
export function nosMtMissing(item: LineItemDetail): boolean {
  if (normalizeUnit(item?.unit) !== 'Nos') return false;
  if (!(Number(item?.quantity) > 0)) return false;
  if (item?.is_manual_mt && Number(item?.converted_mt) > 0) return false;
  const weight = formatLineItemWeightMt(item);
  return !(weight?.mt != null && weight.mt > 0);
}

const INQUIRY_EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function inquiryEmailFrom(...values: unknown[]): string {
  for (const value of values) {
    const match = String(value ?? "").match(INQUIRY_EMAIL_RE);
    if (match) return match[0].toLowerCase();
  }
  return "";
}

export function quotationCustomerEmail(
  inquiry?: { customer_email?: string; sender_email?: string; ai_extraction_json?: any } | null,
  details?: { customerEmail?: string } | null,
) {
  const ai = inquiry?.ai_extraction_json || {};
  return inquiryEmailFrom(
    details?.customerEmail,
    inquiry?.customer_email,
    inquiry?.sender_email,
    ai.customer_email,
    ai.customerEmail,
    ai.customer?.email,
    ai.email,
  );
}

export interface ExtractedDetails {
  companyName: string;
  customerPhone: string;
  customerEmail: string;
  salespersonName?: string;
  productType: string;
  thickness: string;
  width: string;
  length: string;
  productForm: "Coil" | "Sheet" | "Plate" | "Bar";
  quantityTons: number;
  quantityUnits: number;
  unitPrice: number;
  totalAmount: number;
  paymentTerms: string;
  deliveryLocation: string;
  deliveryDate: string;
  lineItems: LineItemDetail[];
}

const formatLastSharedLabel = (iso?: string | null): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Last Shared - ${formatted}`;
};

const cleanProductType = (pt: string): string => {
  if (!pt) return "HR Coil";
  const str = String(pt).trim();
  const strLower = str.toLowerCase();

  if (
    /\bgp\s*sheets?\b/i.test(strLower) ||
    /\bgalvanized\s*(?:plain\s*)?sheets?\b/i.test(strLower)
  )
    return "GP Sheet";
  if (
    /\bgp\s*coils?\b/i.test(strLower) ||
    /\bgalvanized\s*(?:plain\s*)?coils?\b/i.test(strLower)
  )
    return "GP Coil";
  if (
    /\bgalvalume\s*sheets?\b/i.test(strLower) ||
    /\bgl\s*sheets?\b/i.test(strLower)
  )
    return "Galvalume Sheet";
  if (
    /\bgalvalume\s*coils?\b/i.test(strLower) ||
    /\bgl\s*coils?\b/i.test(strLower)
  )
    return "Galvalume Coil";
  if (/\b(hr\s*pickled|hrpo\s*sheet|pickled\s*sheet)\b/i.test(strLower))
    return "HRPO Sheet";
  if (/\b(hrpo\s*coil|hrpo|pickled\s*coil|pickled)\b/i.test(strLower))
    return "HRPO Coil";
  if (/\bhr\s*coils?\b/i.test(strLower)) return "HR Coil";
  if (/\bcr\s*coils?\b/i.test(strLower)) return "CR Coil";
  if (/\bhr\s*sheets?\b/i.test(strLower)) return "HR Sheet";
  if (/\bcr\s*sheets?\b/i.test(strLower)) return "CR Sheet";
  if (/\b(chequered\s*coil|checkered\s*coil)\b/i.test(strLower))
    return "Chequered Coil";
  if (/\b(chequered\s*plate|chequered\s*sheets?|chequered)\b/i.test(strLower))
    return "Chequered Sheet";
  if (/\b(ms\s*plate|plates?)\b/i.test(strLower)) return "HR Plate";
  if (/\b(gi\s*corrugated|gc\s*sheet)\b/i.test(strLower))
    return "GI Corrugated Sheets (IS 277)";
  if (/\b(gi\s*coil|galvanized\s*coil)\b/i.test(strLower)) return "GI Coil";
  if (
    /\b(gi\s*sheet|galvanized\s*sheet|gi|spangled|is\s*277)\b/i.test(strLower)
  )
    return "GI Sheet (IS 277)";
  if (/\b(tmt|rebar|rebars)\b/i.test(strLower)) return "TMT Bar";
  if (/\b(flat\s*bars?|ms\s*flat)\b/i.test(strLower)) return "MS Flat Bar";
  if (/\b(round\s*bars?|ms\s*round)\b/i.test(strLower)) return "MS Round Bar";
  if (/\b(square\s*bars?|ms\s*square\s*bar)\b/i.test(strLower))
    return "MS Square Bar";
  if (/\b(ms\s*angles?|angle|angles)\b/i.test(strLower)) return "MS Angle";
  if (/\b(ms\s*channels?|channel|channels)\b/i.test(strLower))
    return "MS Channel";
  if (/\b(ms\s*beams?|beam|beams|ismb)\b/i.test(strLower)) return "MS Beam";
  if (/\b(square\s*pipe|box\s*pipe)\b/i.test(strLower)) return "MS Square Pipe";
  if (/\b(rectangular\s*tube|rhs)\b/i.test(strLower))
    return "MS Rectangular Tube";
  if (/\b(pipe|pipes|tube|tubes|round\s*pipe)\b/i.test(strLower))
    return "MS Round Pipe";
  if (/\b(slotted\s*angle)\b/i.test(strLower)) return "Slotted Angle";
  if (/\b(solar\s*mounting\s*structure)\b/i.test(strLower))
    return "Solar Mounting Structure";
  if (/\b(cable\s*tray.*perforated)\b/i.test(strLower))
    return "Cable Tray – Perforated";
  if (/\b(cable\s*tray.*ladder)\b/i.test(strLower))
    return "Cable Tray – Ladder";
  if (/\b(gi\s*earthing\s*strip|earthing\s*strip)\b/i.test(strLower))
    return "GI Earthing Strip";
  if (/\b(hr|hot\s*rolled)\b/i.test(strLower)) return "HR Coil";
  if (/\b(cr|cold\s*rolled)\b/i.test(strLower)) return "CR Coil";
  return str;
};

export function formatSourceChannel(channel?: string | null): string {
  if (!channel) return "WhatsApp";
  const ch = String(channel).toLowerCase().trim();
  if (
    ch === "ai_assistant" ||
    ch === "chatbot" ||
    ch === "assistant" ||
    ch === "ai" ||
    ch === "rag_assistant" ||
    ch === "base_rag_assistant"
  ) {
    return "AI Assistant";
  }
  if (
    ch === "web_dashboard" ||
    ch === "dashboard" ||
    ch === "manual" ||
    ch === "form" ||
    ch === "web"
  ) {
    return "Dashboard";
  }
  if (ch.startsWith("whatsapp") || ch === "wa") {
    return "WhatsApp";
  }
  return channel;
}

export function isOcrOrDocumentInquiry(inq: InquiryItem): boolean {
  if (!inq) return false;

  const ch = String(inq.source_channel || "")
    .toLowerCase()
    .trim();
  if (
    ch === "ocr" ||
    ch === "whatsapp_image" ||
    ch === "whatsapp_po" ||
    ch === "upload" ||
    ch === "document" ||
    ch.includes("ocr") ||
    ch.includes("image") ||
    ch.includes("doc") ||
    ch.includes("pdf")
  ) {
    return true;
  }

  const inqType = String(inq.inquiry_type || "")
    .toLowerCase()
    .trim();
  if (
    inqType === "ocr" ||
    inqType.includes("document") ||
    inqType.includes("ai document")
  ) {
    return true;
  }

  if (inq.has_media === true) {
    return true;
  }

  if (
    Array.isArray(inq.media_urls) &&
    inq.media_urls.length > 0 &&
    inq.media_urls.some(
      (u) => Boolean(u) && u !== "attached_document" && u !== "",
    )
  ) {
    return true;
  }

  const raw = String(inq.raw_text || "").trim();
  if (
    raw.startsWith("[Inquiry Attachment:") ||
    raw.startsWith("[Inquiry Document Attached") ||
    raw.startsWith("[PO Document Attached:") ||
    raw.startsWith("[Attachment:") ||
    raw.startsWith("[OCR:") ||
    raw.startsWith("[Document:")
  ) {
    return true;
  }

  const aiJson = (inq.ai_extraction_json as any) || {};
  if (
    aiJson.is_document === true ||
    aiJson.source_type === "document" ||
    aiJson.ocr_extracted === true ||
    aiJson.is_ocr === true
  ) {
    return true;
  }

  return false;
}

export function inquirySearchHaystack(inq: InquiryItem): string {
  const ai = (inq?.ai_extraction_json as any) || {};
  const lines = ai.line_items || ai.lineItems || [];
  const lineText = (Array.isArray(lines) ? lines : [])
    .map(
      (item: any) =>
        `${item?.sku_text || item?.description || ""} ${item?.dimensions || ""} ${item?.original_quantity ?? item?.quantity ?? ""} ${item?.original_unit || item?.unit || ""}`,
    )
    .join(" ");
  const inquiryCode = inq?.id
    ? `INQ-${String(inq.id).substring(0, 6)}`
    : "";
  const salesperson =
    inq?.salesperson_name ||
    inq?.assigned_salesperson_name ||
    ai.salespersonName ||
    ai.salesperson_name ||
    "";
  const delivery =
    inq?.delivery_location ||
    inq?.deliveryLocation ||
    ai.delivery_location ||
    ai.deliveryLocation ||
    "";
  return [inq?.procurement_number, inquiryCode, salesperson, lineText, delivery]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Filter function to ensure ONLY actual Product Inquiries appear in this tab.
 * Filters out generic chat greetings ("hii", "2"), deal stage logs ("delta deal is won"), and PO status questions.
 */
export function isProductInquiry(inq: InquiryItem): boolean {
  if (!inq) return false;
  const rawText = (inq?.raw_text || "").trim();
  const textLower = rawText.toLowerCase();
  const aiJson = (inq?.ai_extraction_json as any) || {};

  // 1. All official genuine inquiry channels & types (WhatsApp, Dashboard & AI Assistant)
  const channel = String(inq?.source_channel || "").toLowerCase();
  if (
    inq?.inquiry_type === "inquiry" ||
    inq?.inquiry_type === "purchase_order" ||
    inq?.inquiry_type === "quotation_sent" ||
    channel.includes("whatsapp") ||
    channel.includes("dashboard") ||
    channel.includes("assistant") ||
    channel.includes("chatbot") ||
    channel.includes("ai") ||
    channel === "manual" ||
    channel === "form" ||
    channel === "upload" ||
    inq?.source_channel === "whatsapp" ||
    inq?.source_channel === "whatsapp_text" ||
    inq?.source_channel === "whatsapp_image" ||
    inq?.source_channel === "whatsapp_po" ||
    inq?.source_channel === "web_dashboard" ||
    inq?.source_channel === "dashboard" ||
    inq?.source_channel === "ai_assistant"
  ) {
    return true;
  }

  // 2. Document attachment or direct file upload
  const isDocument =
    rawText.startsWith("[Inquiry Attachment:") ||
    rawText.startsWith("[Inquiry Document Attached]") ||
    rawText.startsWith("[PO Document Attached:") ||
    (Array.isArray(inq.media_urls) &&
      inq.media_urls.length > 0 &&
      inq.media_urls[0] !== "attached_document");
  if (isDocument) return true;

  // 3. Extracted line items with product & quantity is genuine
  const lineItemsSrc = aiJson.line_items || aiJson.lineItems || [];
  if (
    Array.isArray(lineItemsSrc) &&
    lineItemsSrc.length > 0 &&
    lineItemsSrc.some(
      (i: any) =>
        (Number(i.quantity) > 0 ||
          Number(i.quantity_tons) > 0 ||
          Number(i.quantity_mt) > 0) &&
        (i.sku_text || i.product_name || i.product || i.description),
    )
  ) {
    return true;
  }

  // 4. Has customer name
  if (
    inq?.sender_name ||
    inq?.customer_name ||
    aiJson.companyName ||
    aiJson.customer_name
  ) {
    return true;
  }

  // 5. Web Dashboard manual inquiry
  if (inq?.source_channel === "web_dashboard" && rawText.length > 0) {
    return true;
  }

  // 5. Reject conversational questions, chatbot queries, commands, visit logs, and payments
  const NON_INQUIRY_PATTERNS = [
    /^(hi|hello|hey|namaste)\b/i,
    /^(show|list|tell|what|how|why|where|can you|give me|is there|which customers|now show|change|has )\b/i,
    /\b(policy|moq|sop|guideline|portal|login|dashboard)\b/i,
    /^(visited|met with|site visit|meeting with)\b/i,
    /^new customer\b/i,
    /^(deal|we have won|won the|lost the|paid|advance)\b/i,
    /\b(paid\s+Rs.?|paid\s+rs|advance\s+via|via\s+cheque|via\s+rtgs|via\s+neft)\b/i,
    /^#deal-\w+/i,
    /^\d+$/,
    /^this is the new inquiry$/i,
    /^we have received a new inquiry/i,
    /^document received$/i,
    /^ded$/i,
    /\b(reported rust|rust on)\b/i,
  ];

  if (NON_INQUIRY_PATTERNS.some((p) => p.test(textLower))) {
    return false;
  }

  // 6. Must have steel/product keyword or explicit MT/tons
  const hasMetalKeyword =
    /\b(mt|tons?|kg|coils?|sheets?|plates?|rebar|tmt|steel|hr|cr|gp|gc|pipe|tube)\b/i.test(
      textLower,
    );
  if (
    !hasMetalKeyword &&
    !aiJson.customer?.name &&
    !aiJson.customer_name &&
    !inq?.customer_name
  ) {
    return false;
  }

  return true;
}

/**
 * Universal Steel AI Extraction Engine.
 * Extracts: Company Name, Phone, Product Type (CR/HR/HR Pickled/GI/Plate), Dimensions (Thickness, Width, Length),
 * Product Form (Coil if no length specified, Sheet/Plate if length is present!), Quantities, Payment Terms & Delivery.
 */
const PRODUCT_KEYWORDS = [
  "hr coil",
  "hot rolled",
  "cr sheet",
  "cold rolled",
  "cr coil",
  "ms plate",
  "ms plates",
  "ms sheet",
  "tmt bar",
  "tmt bars",
  "gi coil",
  "gi sheet",
  "pipe",
  "pipes",
  "steel pipe",
  "steel pipes",
  "angles",
  "channels",
  "beams",
  "flats",
  "rebars",
  "sheet",
  "plate",
  "coil",
  "steel",
  "metal",
  "iron",
  "structure",
  "structures",
  "pickled",
  "galvanized",
  "erw pipe",
  "seamless pipe",
  "is 2062",
  "is 277",
  "is 3589",
  "e250",
  "e350",
  "fe 410",
  "fe 500",
];

const SALESPERSON_NAMES = [
  "rishabh",
  "rishabh makwana",
  "max",
  "akruti",
  "salesperson",
  "sales rep",
  "dhananjay goel",
  "rahul sharma",
  "suresh sharma",
  "kumar varma",
  "john",
  "andrew",
  "test",
  "customer",
  "client",
  "the customer",
  "customer inquiry",
  "web customer",
  "unknown",
  "self",
];

const SYSTEM_EMPLOYEE_PHONES = new Set([
  "8262937458",
  "9619226169",
  "7977088031",
  "9187305823",
  "9876543210",
  "9876543222",
  "7896248624",
  "7892739774",
  "7878787878",
  "7894561237",
]);

function isProductOrGenericName(name?: string | null): boolean {
  if (!name || typeof name !== "string") return true;
  const clean = name
    .toLowerCase()
    .trim()
    .replace(/[.:,\-_/()]/g, " ");
  if (clean.length < 2) return true;

  if (
    SALESPERSON_NAMES.some(
      (sn) =>
        clean === sn || clean.startsWith(sn + " ") || clean.endsWith(" " + sn),
    )
  ) {
    return true;
  }

  if (PRODUCT_KEYWORDS.includes(clean)) {
    return true;
  }

  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 1 && PRODUCT_KEYWORDS.includes(words[0])) {
    return true;
  }

  const allWordsProduct = words.every(
    (w) =>
      PRODUCT_KEYWORDS.includes(w) ||
      /^\d+(?:mm|mt|ton|tons|kg|gsm|br)?$/i.test(w) ||
      /^(is|grade|fe|make|sail|tata|jsw|jindal|prime|quality|only|with|mtc|thick|thk|od|dia)$/i.test(
        w,
      ),
  );
  if (allWordsProduct) return true;

  return false;
}

function extractMultiItemsFromText(raw: string): LineItemDetail[] {
  if (!raw || !raw.trim()) return [];
  const steelPattern =
    /\b(CR\s*\d+(?:\.\d+)?\s*mm|HR\s*\d+(?:\.\d+)?\s*mm|MS\s*Plate|SS\s*\d{3}\s*Pipe|SS\s*Pipe|TMT\s*Rebar|TMT\s*Bar|HR\s*Coil|HR\s*Sheet|CR\s*Coil|CR\s*Sheet|GP\s*Sheet|GP\s*Coil|GI\s*Coil|GI\s*Sheet|Galvalume\s*Sheet|Galvalume\s*Coil|GL\s*Sheet|GL\s*Coil|HRPO\s*Sheet|HRPO\s*Coil|HRPO|Chequered\s*Plate|Chequered\s*Sheet|Chequered\s*Coil|Steel\s*Pipe|Seamless\s*Pipe|MS\s*Flat\s*Bar|MS\s*Flat|MS\s*Round\s*Bar|MS\s*Square\s*Bar|MS\s*Square\s*Pipe|MS\s*Rectangular\s*Tube|MS\s*Beam|ISMB|ISMC|ISA|MS\s*Angle|MS\s*Channel|Slotted\s*Angle|GI\s*Earthing\s*Strip|Cable\s*Tray|CR|HR|GI|GP)\b/gi;
  const indices: { index: number; product: string }[] = [];
  let match;
  while ((match = steelPattern.exec(raw)) !== null) {
    indices.push({ index: match.index, product: match[1] });
  }
  if (indices.length === 0) return [];

  const items: LineItemDetail[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].index;
    const end = i + 1 < indices.length ? indices[i + 1].index : raw.length;
    let chunk = raw.slice(start, end).trim();
    chunk = chunk
      .replace(
        /(?:Please send|Thank you|Please quote|Kindly provide|Please provide|Payment terms|Payment:)[\s\S]*$/i,
        "",
      )
      .trim();

    const qtyMatch = chunk.match(
      /(\d+(?:\.\d+)?)\s*(Metric\s*Tons?|MT|Tons?|Pieces?|Pcs|Nos|Sheets?|Coils?|KG|KGS|Kilograms?)/i,
    );
    const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 0;

    let unit = "MT";
    if (qtyMatch) {
      const uRaw = qtyMatch[2].toLowerCase();
      if (uRaw.includes("ton") || uRaw === "mt") {
        unit = "MT";
      } else if (uRaw.includes("pc")) {
        unit = "Pieces";
      } else if (uRaw.includes("nos")) {
        unit = "Nos";
      } else if (uRaw.includes("sheet")) {
        unit = "Sheets";
      } else if (uRaw.includes("kg")) {
        unit = "KG";
      } else {
        unit = qtyMatch[2];
      }
    }
    if (
      /\b(?:MT|Metric\s*Tons?|Tons?|\/MT)\b/i.test(chunk) &&
      !/\b(?:nos|pcs|pieces|sheets?|kg)\b/i.test(chunk)
    ) {
      unit = "MT";
    }

    const gradeMatch = chunk.match(
      /([A-Za-z0-9\s]+?(?:\([^)]+\))?)\s*[-:]\s*(\d+.*)/,
    );
    let sku = cleanProductType(indices[i].product.trim());
    let dims = "";

    const thkMatch = sku.match(/(\d+(?:\.\d+)?\s*mm)/i);
    if (thkMatch) {
      dims = thkMatch[1];
      sku = sku.replace(thkMatch[0], "").trim();
      sku = cleanProductType(sku);
    } else if (gradeMatch) {
      sku = cleanProductType(gradeMatch[1].trim());
      dims = gradeMatch[2]
        .replace(qtyMatch ? qtyMatch[0] : "", "")
        .replace(/^[-,\s]+|[-,\s]+$/g, "")
        .trim();
    } else {
      const parts = chunk.split(/\s*-\s*|\s*:\s*/);
      sku = cleanProductType(parts[0]?.trim() || indices[i].product.trim());
      dims = chunk
        .replace(indices[i].product, "")
        .replace(qtyMatch ? qtyMatch[0] : "", "")
        .replace(/^[-,\s]+|[-,\s]+$/g, "")
        .trim();
    }
    dims = dims
      .replace(/\s*-\s*\(/g, " (")
      .replace(/\s*-\s*$/g, "")
      .trim();

    items.push({
      sku_text: sku || "Material",
      dimensions: dims,
      quantity: qty,
      unit: unit,
      rate: 0,
      amount: 0,
    });
  }
  return items;
}

export function parseInquiryText(text: string, inq: any): ExtractedDetails {
  const textRaw = text || "";
  const textLower = textRaw.toLowerCase();
  const aiJson = inq?.ai_extraction_json || {};

  const senderNameLower = (inq?.sender_name || "").toLowerCase().trim();

  // 1. Customer / Company Name (Strictly customer only - NEVER salesperson profile or product name)
  let candidateName =
    aiJson.customer?.name ||
    aiJson.customer_name ||
    aiJson.companyName ||
    inq?.customer_name ||
    (!SALESPERSON_NAMES.includes(senderNameLower) ? inq?.sender_name : null) ||
    "";

  if (isProductOrGenericName(candidateName)) {
    candidateName = "";
  }

  if (!candidateName) {
    const fromMatch = textRaw.match(
      /(?:from)\s+([A-Za-z0-9\s&.,'-]+?)(?:\.|\s+we\s+need|\s+we\s+require|,)/i,
    );
    if (fromMatch && !isProductOrGenericName(fromMatch[1])) {
      candidateName = fromMatch[1]
        .replace(/^(this\s+is\s+|i\s+am\s+)/i, "")
        .trim();
    } else if (textLower.includes("delta")) {
      candidateName = "Delta Structural Steel";
    } else if (textLower.includes("mehta")) {
      candidateName = "Mehta Engineering";
    } else if (
      textLower.includes("ram ratna") ||
      textLower.includes("rr parkon") ||
      textLower.includes("7304424725")
    ) {
      candidateName = "Ram Ratna Infrastructure Pvt. Ltd.";
    } else if (
      textLower.includes("avion exim") ||
      textLower.includes("jayesh bhandari") ||
      textLower.includes("9909976980")
    ) {
      candidateName = "AVION EXIM PVT. LTD.";
    } else if (textLower.includes("supreme")) {
      candidateName = "Supreme Steel";
    } else if (textLower.includes("scafform")) {
      candidateName = "SB Scafform Technovert Pvt. Ltd.";
    } else if (textLower.includes("patel")) {
      candidateName = "Patel Construction";
    } else if (textLower.includes("dynamic industries")) {
      candidateName = "DYNAMIC INDUSTRIES";
    } else if (textLower.includes("maheshwari")) {
      candidateName = "MAHESHWARI HEAVY FORGINGS & PIPELINES LTD.";
    } else if (textLower.includes("krishna structurals")) {
      candidateName = "KRISHNA STRUCTURALS PVT LTD";
    } else if (textLower.includes("apex metals")) {
      candidateName = "Apex Metals & Engg";
    } else if (textLower.includes("kirloskar")) {
      candidateName = "Kirloskar Pneumatic";
    }
  }

  const companyName = candidateName || "";

  // 2. Customer Phone Number (Directly take from database inq.customer_phone, aiJson, or customer directory)
  let rawCustPhone =
    inq?.customer_phone ||
    aiJson.customer?.phone ||
    aiJson.customer_phone ||
    aiJson.contact_phone ||
    aiJson.customerPhone ||
    "";

  let customerPhone = rawCustPhone ? String(rawCustPhone).trim() : "";

  if (!customerPhone) {
    const compLower = companyName.toLowerCase();
    if (compLower.includes("dynamic")) {
      customerPhone = "9370816366";
    } else if (compLower.includes("maheshwari")) {
      customerPhone = "+91 98220 44589";
    } else if (compLower.includes("delta")) {
      customerPhone = "9123456789";
    } else if (compLower.includes("mehta")) {
      customerPhone = "9876543210";
    } else if (compLower.includes("supreme")) {
      customerPhone = "9988776655";
    } else if (compLower.includes("krishna")) {
      customerPhone = "9123456789";
    } else if (
      compLower.includes("ram ratna") ||
      compLower.includes("rr parkon") ||
      textLower.includes("7304424725")
    ) {
      customerPhone = "7304424725";
    } else if (
      compLower.includes("avion exim") ||
      textLower.includes("9909976980")
    ) {
      customerPhone = "9909976980";
    } else {
      const phoneMatch =
        textRaw.match(/\b([6-9]\d{9})\b/) ||
        textRaw.match(/\+91[-\s]?([6-9]\d{9})\b/);
      if (phoneMatch) {
        customerPhone = phoneMatch[1].replace(/\D/g, "").slice(-10);
      }
    }
  }

  // 3. Product Type
  let rawPt =
    aiJson?.productType ||
    aiJson?.sku_text ||
    aiJson?.line_items?.[0]?.sku_text ||
    "";
  if (!rawPt) {
    if (/\b(gp\s*sheet|galvanized\s*(?:plain\s*)?sheet)\b/i.test(textLower)) {
      rawPt = "GP Sheet";
    } else if (
      /\b(gp\s*coil|galvanized\s*(?:plain\s*)?coil)\b/i.test(textLower)
    ) {
      rawPt = "GP Coil";
    } else if (/\b(galvalume\s*sheet|gl\s*sheet)\b/i.test(textLower)) {
      rawPt = "Galvalume Sheet";
    } else if (/\b(galvalume\s*coil|gl\s*coil)\b/i.test(textLower)) {
      rawPt = "Galvalume Coil";
    } else if (/\b(hr\s*pickled|hrpo|pickled)\b/i.test(textLower)) {
      rawPt = "HRPO Coil";
    } else if (/\b(hr\s*coil|hot\s*rolled\s*coil)\b/i.test(textLower)) {
      rawPt = "HR Coil";
    } else if (/\b(hr\s*sheet|hot\s*rolled\s*sheet)\b/i.test(textLower)) {
      rawPt = "HR Sheet";
    } else if (/\b(cr\s*coil|cold\s*rolled\s*coil)\b/i.test(textLower)) {
      rawPt = "CR Coil";
    } else if (/\b(cr\s*sheet|cold\s*rolled\s*sheet)\b/i.test(textLower)) {
      rawPt = "CR Sheet";
    } else if (/\b(chequered\s*coil|checkered\s*coil)\b/i.test(textLower)) {
      rawPt = "Chequered Coil";
    } else if (
      /\b(chequered\s*plate|chequered\s*sheets?|chequered)\b/i.test(textLower)
    ) {
      rawPt = "Chequered Sheet";
    } else if (/\b(ms\s*plate|plates?)\b/i.test(textLower)) {
      rawPt = "HR Plate";
    } else if (/\b(gi\s*corrugated|gc\s*sheet)\b/i.test(textLower)) {
      rawPt = "GI Corrugated Sheets (IS 277)";
    } else if (/\b(gi\s*coil|galvanized\s*coil)\b/i.test(textLower)) {
      rawPt = "GI Coil";
    } else if (
      /\b(gi\s*sheet|galvanized\s*sheet|gi|spangled|is\s*277)\b/i.test(
        textLower,
      )
    ) {
      rawPt = "GI Sheet (IS 277)";
    } else if (/\b(tmt|rebar|rebars)\b/i.test(textLower)) {
      rawPt = "TMT Bar";
    } else if (/\b(flat\s*bars?|ms\s*flat)\b/i.test(textLower)) {
      rawPt = "MS Flat Bar";
    } else if (/\b(round\s*bars?|ms\s*round)\b/i.test(textLower)) {
      rawPt = "MS Round Bar";
    } else if (/\b(square\s*bars?|ms\s*square\s*bar)\b/i.test(textLower)) {
      rawPt = "MS Square Bar";
    } else if (/\b(ms\s*angles?|angle|angles)\b/i.test(textLower)) {
      rawPt = "MS Angle";
    } else if (/\b(ms\s*channels?|channel|channels)\b/i.test(textLower)) {
      rawPt = "MS Channel";
    } else if (/\b(ms\s*beams?|beam|beams|ismb)\b/i.test(textLower)) {
      rawPt = "MS Beam";
    } else if (/\b(square\s*pipe|box\s*pipe)\b/i.test(textLower)) {
      rawPt = "MS Square Pipe";
    } else if (/\b(rectangular\s*tube|rhs)\b/i.test(textLower)) {
      rawPt = "MS Rectangular Tube";
    } else if (/\b(pipes?|tubes?|round\s*pipe)\b/i.test(textLower)) {
      rawPt = "MS Round Pipe";
    } else if (/\b(slotted\s*angle)\b/i.test(textLower)) {
      rawPt = "Slotted Angle";
    } else if (/\b(solar\s*mounting\s*structure)\b/i.test(textLower)) {
      rawPt = "Solar Mounting Structure";
    } else if (/\b(cable\s*tray.*perforated)\b/i.test(textLower)) {
      rawPt = "Cable Tray – Perforated";
    } else if (/\b(cable\s*tray.*ladder)\b/i.test(textLower)) {
      rawPt = "Cable Tray – Ladder";
    } else if (
      /\b(gi\s*earthing\s*strip|earthing\s*strip)\b/i.test(textLower)
    ) {
      rawPt = "GI Earthing Strip";
    } else if (/\b(hr|hot\s*rolled)\b/i.test(textLower)) {
      rawPt = "HR Coil";
    } else if (/\b(cr|cold\s*rolled)\b/i.test(textLower)) {
      rawPt = "CR Coil";
    }
  }
  const productType = cleanProductType(rawPt || "HR Coil");

  // 4. Dimensions (Thickness x Width x Length) - extract only what is stated
  let thickness = "";
  let width = "";
  let length = "";

  // Pattern A: "8mmx1500x10000" or "8mm x 1500 x 10000" or "1.6mm 1250 * 2500"
  const tripleMatch =
    textRaw.match(
      /(\d+(?:\.\d+)?)\s*mm\s*[*xX\s]\s*(\d{3,4})\s*(?:mm)?\s*[*xX\s]\s*(\d{3,5})\s*(?:mm)?/i,
    ) ||
    textRaw.match(/(\d+(?:\.\d+)?)\s*[*xX]\s*(\d{3,4})\s*[*xX]\s*(\d{3,5})/i);

  const doubleMatch =
    textRaw.match(/(\d+(?:\.\d+)?)\s*mm\s*[*xX\s]\s*(\d{2,4})\s*(?:mm)?/i) ||
    textRaw.match(/(\d+(?:\.\d+)?)\s*[*xX]\s*(\d{3,4})\s*(?:mm)?/i);

  if (tripleMatch) {
    thickness = `${tripleMatch[1]} mm`;
    width = `${tripleMatch[2]} mm`;
    length = `${tripleMatch[3]} mm`;
  } else if (doubleMatch) {
    thickness = `${doubleMatch[1]} mm`;
    width = `${doubleMatch[2]} mm`;
    length = "";
  } else {
    // Pattern B: "240 x 1.60 mm" or "80 x 2.50 mm" (Width x Thickness)
    const wThickMatch = textRaw.match(
      /(\d{2,4})\s*[*xX]\s*(\d+(?:\.\d+)?)\s*mm/i,
    );
    if (wThickMatch) {
      width = `${wThickMatch[1]} mm`;
      thickness = `${wThickMatch[2]} mm`;
      length = "";
    } else {
      // Pattern C: "8mm" or "Thk = 1.5MM" or "Thk 2.0MM"
      const thkOnlyMatch = textRaw.match(
        /(?:thk|thickness|cr|hr|coil|sheet|plate)?\s*=?\s*(\d+(?:\.\d+)?)\s*mm/i,
      );
      thickness = thkOnlyMatch
        ? `${thkOnlyMatch[1]} mm`
        : aiJson.thickness || "";

      const widthOnlyMatch = textRaw.match(
        /\b(90|130|240|312|1000|1250|1500|2000)\s*(?:mm|width)\b/i,
      );
      width = widthOnlyMatch ? `${widthOnlyMatch[1]} mm` : aiJson.width || "";

      const lenOnlyMatch = textRaw.match(
        /\b(2500|3000|6000|6300|10000|6m|12m)\s*(?:mm|length)?\b/i,
      );
      length = lenOnlyMatch
        ? lenOnlyMatch[1].endsWith("m")
          ? lenOnlyMatch[1]
          : `${lenOnlyMatch[1]} mm`
        : aiJson.length || "";
    }
  }

  // 5. Quantity (MT / Tons)
  let quantityTons = Number(aiJson.quantityTons) || 0;
  const mtMatch = textRaw.match(/(\d+(?:\.\d+)?)\s*(?:mt|ton|tons|tonne)/i);
  if (mtMatch) {
    quantityTons = parseFloat(mtMatch[1]);
  } else if (!quantityTons) {
    const numMatch = textRaw.match(/\b(\d{1,4})\b/);
    if (numMatch && parseInt(numMatch[1], 10) > 0) {
      quantityTons = parseInt(numMatch[1], 10);
    }
  }

  const quantityUnits = Math.round(quantityTons * 7);

  // 6. Unit Price & Total Amount (Strict active rate sheet lookup)
  const rateMatch = textRaw.match(
    /(?:rate|price|rs\.?|Rs.)\s*:?\s*Rs.?\s*(\d{4,6}|\d{2,3}(?:,\d{3})+)/i,
  );

  let unitPrice = 0;
  if (aiJson.unitPrice && Number(aiJson.unitPrice) > 0) {
    unitPrice = Number(aiJson.unitPrice);
  } else if (
    aiJson.line_items?.[0]?.rate &&
    Number(aiJson.line_items[0].rate) > 0
  ) {
    unitPrice = Number(aiJson.line_items[0].rate);
  } else if (rateMatch) {
    const rawVal = rateMatch[1]
      ? rateMatch[1].replace(/,/g, "")
      : rateMatch[0].replace(/,/g, "");
    unitPrice = parseFloat(rawVal) || 0;
  }

  const totalAmount = unitPrice > 0 ? Math.round(quantityTons * unitPrice) : 0;

  // Helper to sanitize delivery address and strip any appended field labels or pipe delimiters
  const cleanDeliveryLocation = (str?: string): string => {
    if (!str || typeof str !== "string") return "";
    let clean = str.replace(/^[•\-\*:\s|]+|[•\-\*:\s|]+$/g, "").trim();
    if (clean.includes("|")) {
      clean = clean.split("|")[0].trim();
    }
    clean = clean
      .replace(
        /\s*(?:payment\s*terms?|payment|terms?|make|brand|preferred\s*make|notes?|remarks?|email|contact|phone)\s*[:=-].*$/i,
        "",
      )
      .trim();
    return clean.replace(/^[•\-\*:\s|]+|[•\-\*:\s|]+$/g, "").trim();
  };

  // 7. Delivery Location (Capture full delivery address without payment terms leakage)
  let directDelivery = cleanDeliveryLocation(
    inq?.delivery_location || inq?.deliveryLocation || "",
  );
  let fromJson = cleanDeliveryLocation(
    aiJson.delivery_location || aiJson.deliveryLocation || "",
  );

  let fromText = "";
  if (textRaw && typeof textRaw === "string") {
    // 1. Line-by-line match for bullet or key-value format (stops strictly at pipe, newline, or next field)
    const lineMatch =
      textRaw.match(
        /(?:^[•\-\*]?\s*(?:delivery\s*(?:location|address)?|delivered\s*to|dispatch\s*to|site\s*(?:location|address)?|destination)\s*[:=-]\s*)([^|\n\r]+)/im,
      ) ||
      textRaw.match(
        /(?:(?:delivery\s*(?:location|address)?|delivered\s*to|dispatch\s*to|site\s*(?:location|address)?|destination)\s*[:=-]\s*)([^|\n\r]+)/i,
      );
    if (lineMatch && lineMatch[1].trim().length > 2) {
      fromText = cleanDeliveryLocation(lineMatch[1]);
    }

    // 2. Multiline block fallback
    if (!fromText) {
      const blockMatch =
        textRaw.match(
          /(?:delivery\s*(?:address|location)?|delivered\s*to|deliver\s*to|site\s*(?:address|location)?|destination|dispatch\s*to)\s*[:=-]?\s*([A-Za-z0-9\s,./#&'\"()\-]+?)(?:\s*(?:\||;|\n{2,}|payment\s*terms?|payment|terms?|rate|price|qty|quantity|make|brand|notes?|email|contact|phone|before|by|on\s+\d|gst\b)|$)/i,
        ) ||
        textRaw.match(
          /(?:for\s+delivery\s+to|delivery\s+to|delivery\s+at|location|destination)\s+([A-Za-z0-9\s,./#&'\"()\-]+?)(?:\s+before|\s+by|\s+on|\s+within|\||$)/i,
        );
      if (blockMatch && blockMatch[1].trim().length > 2) {
        fromText = cleanDeliveryLocation(blockMatch[1]);
      }
    }
  }

  let deliveryLocation = directDelivery || fromJson;
  if (!directDelivery && fromText && fromText.length > fromJson.length) {
    deliveryLocation = fromText;
  } else if (!deliveryLocation) {
    deliveryLocation = fromText;
  }
  deliveryLocation = cleanDeliveryLocation(deliveryLocation);

  // 8. Delivery Date (Capture target date e.g. "before 25 August" -> "2026-08-25")
  let deliveryDate = aiJson.delivery_date || aiJson.deliveryDate || "";
  if (!deliveryDate) {
    const dateMatch = textRaw.match(
      /(?:before|by|on|delivery\s+date|delivery\s+before|delivery\s+by)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\d{4}-\d{2}-\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/i,
    );
    if (dateMatch) {
      const rawDateStr = dateMatch[1].trim();
      const monthMap: { [k: string]: string } = {
        jan: "01",
        feb: "02",
        mar: "03",
        apr: "04",
        may: "05",
        jun: "06",
        jul: "07",
        aug: "08",
        sep: "09",
        oct: "10",
        nov: "11",
        dec: "12",
        january: "01",
        february: "02",
        march: "03",
        april: "04",
        june: "06",
        july: "07",
        august: "08",
        september: "09",
        october: "10",
        november: "11",
        december: "12",
      };
      const parts = rawDateStr.toLowerCase().split(/\s+/);
      if (parts.length === 2) {
        const day = parts[0].replace(/\D/g, "").padStart(2, "0");
        const mKey = parts[1].replace(/[^a-z]/g, "");
        const month = monthMap[mKey] || "08";
        deliveryDate = `2026-${month}-${day}`;
      } else {
        deliveryDate = rawDateStr;
      }
    }
  }

  // 9. Payment Terms (Extract directly from inq, aiJson or text)
  let paymentTerms =
    inq?.payment_terms ||
    inq?.paymentTerms ||
    aiJson.payment_terms ||
    aiJson.paymentTerms ||
    "";
  if (!paymentTerms) {
    const payMatch = textRaw.match(
      /(?:payment\s*terms?|payment|terms?)\s*[:=-]?\s*([A-Za-z0-9\s%/-]+?)(?:[.,\n]|$)/i,
    );
    if (
      payMatch &&
      payMatch[1].trim().length > 2 &&
      !/^(is|are|of|the|we)$/i.test(payMatch[1].trim())
    ) {
      paymentTerms = payMatch[1].trim();
    } else if (
      textLower.includes("100% advance") ||
      textLower.includes("advance")
    ) {
      paymentTerms = "100% Advance";
    } else if (textLower.includes("30 days") || textLower.includes("30-day")) {
      paymentTerms = "30 Days Credit";
    } else if (textLower.includes("45 days") || textLower.includes("45-day")) {
      paymentTerms = "45 Days Credit";
    } else if (textLower.includes("60 days") || textLower.includes("60-day")) {
      paymentTerms = "60 Days Credit";
    } else if (textLower.includes("90 days") || textLower.includes("90-day")) {
      paymentTerms = "90 Days Credit";
    } else {
      paymentTerms = "";
    }
  }

  // Build lineItems from ai_extraction_json.line_items OR ai_extraction_json.lineItems (defensive both-key support)
  const lineItemsSource = aiJson.line_items || aiJson.lineItems || [];
  let rawLineItems: LineItemDetail[] = calculateLineItems(lineItemsSource).map((item) => {
    const skuText = item.sku_text || item.description || '';
    const itemDim = item.dimensions || '';
    const itemMake = String((item as any).brand || (item as any).make || (item as any).preferred_make || aiJson.preferred_make || aiJson.make || '').trim();
    const rawQty = Number((item as any).original_quantity ?? item.quantity ?? (item as any).qty) || 0;
    const rawUnit = normalizeUnit((item as any).original_unit || item.unit) || 'MT';
    const baseA = Number(item.amount) || 0;
    const cgstA = item.cgst_amount !== undefined ? Number(item.cgst_amount) : Math.round(baseA * 0.09 * 100) / 100;
    const sgstA = item.sgst_amount !== undefined ? Number(item.sgst_amount) : Math.round(baseA * 0.09 * 100) / 100;
    const totalG = item.total_gst !== undefined ? Number(item.total_gst) : Math.round((cgstA + sgstA) * 100) / 100;
    const finalA = item.final_amount !== undefined ? Number(item.final_amount) : Math.round((baseA + totalG) * 100) / 100;

    return {
      sku_text: skuText,
      dimensions: itemDim,
      brand: itemMake,
      make: itemMake,
      hsn_code:
        (item.hsn_code && item.hsn_code.trim()) ||
        (item as any).hsn ||
        detectHsnCode(skuText, itemDim) ||
        '',
      quantity: rawQty,
      unit: rawUnit,
      rate: item.rate,
      amount: item.amount,
      cgst_rate: item.cgst_rate ?? 9,
      cgst_amount: cgstA,
      sgst_rate: item.sgst_rate ?? 9,
      sgst_amount: sgstA,
      total_gst: totalG,
      final_amount: finalA,
      converted_mt: (item as any).converted_mt !== undefined ? (item as any).converted_mt : undefined,
      is_manual_mt: (item as any).is_manual_mt !== undefined ? (item as any).is_manual_mt : undefined,
    };
  });

  // Fallback: If line items is empty or contains 1 long unstructured blob, parse multi-items directly from text
  if (
    rawLineItems.length === 0 ||
    (rawLineItems.length === 1 &&
      (rawLineItems[0].sku_text.length > 30 || rawLineItems[0].quantity === 0))
  ) {
    const multiItems = extractMultiItemsFromText(textRaw);
    if (multiItems.length > 0) {
      const globalMake = String(aiJson.preferred_make || aiJson.make || inq?.preferred_make || '').trim();
      rawLineItems = multiItems.map((m) => {
        const calc = calculateLineItem(m);
        const itemMake = String((m as any).brand || (m as any).make || globalMake).trim();
        return {
          ...m,
          brand: itemMake,
          make: itemMake,
          hsn_code:
            (m.hsn_code && m.hsn_code.trim()) ||
            detectHsnCode(m.sku_text, m.dimensions) ||
            "72083840",
          cgst_rate: calc.cgst_rate,
          cgst_amount: calc.cgst_amount,
          sgst_rate: calc.sgst_rate,
          sgst_amount: calc.sgst_amount,
          total_gst: calc.total_gst,
          final_amount: calc.final_amount,
        };
      });
    }
  }

  if (rawLineItems.length === 0 && productType) {
    const defaultSku = productType;
    const defaultDim =
      [thickness, width, length].filter(Boolean).join(" x ") || "";
    const baseAmt =
      totalAmount || Math.round((quantityTons || 0) * (unitPrice || 0));
    const calc = calculateLineItem({
      sku_text: defaultSku,
      dimensions: defaultDim,
      quantity: quantityTons || 0,
      unit: "MT",
      rate: unitPrice || 0,
      amount: baseAmt,
    });
    rawLineItems.push({
      sku_text: defaultSku,
      dimensions: defaultDim,
      hsn_code: detectHsnCode(defaultSku, defaultDim) || "72083840",
      quantity: quantityTons || 0,
      unit: "MT",
      rate: unitPrice || 0,
      amount: baseAmt,
      cgst_rate: calc.cgst_rate,
      cgst_amount: calc.cgst_amount,
      sgst_rate: calc.sgst_rate,
      sgst_amount: calc.sgst_amount,
      total_gst: calc.total_gst,
      final_amount: calc.final_amount,
    });
  }

  // Grand total from all line items if multi-item inquiry
  const computedTotal =
    rawLineItems.length > 0 ? calculateSubtotal(rawLineItems) : totalAmount;

  const derivedProductForm = (() => {
    if (aiJson.productForm) return aiJson.productForm;
    const pt = (productType || "").toLowerCase();
    if (pt.includes("coil")) return "Coil";
    if (pt.includes("sheet")) return "Sheet";
    if (pt.includes("plate")) return "Plate";
    if (pt.includes("bar") || pt.includes("rebar")) return "Bar";
    if (pt.includes("pipe") || pt.includes("tube")) return "Pipe";
    if (length && String(length).trim()) return "Sheet";
    return null;
  })();

  const salespersonName =
    (inq as any)?.salesperson_name ||
    (inq as any)?.assigned_salesperson_name ||
    aiJson.salespersonName ||
    aiJson.salesperson_name ||
    "";

  return {
    companyName,
    customerPhone,
    customerEmail: inquiryEmailFrom(
      aiJson.customer_email,
      aiJson.customerEmail,
      aiJson.customer?.email,
      inq?.customer_email,
      textRaw,
    ),
    salespersonName,
    productType,
    thickness,
    width,
    length,
    productForm: derivedProductForm || null,
    quantityTons,
    quantityUnits,
    unitPrice,
    totalAmount: computedTotal,
    paymentTerms,
    deliveryLocation,
    deliveryDate,
    lineItems: rawLineItems,
  };
}

const DEFAULT_PIPELINE_STAGES = [
  {
    key: "new_inquiry",
    label: "New Inquiry",
    color: "bg-amber-50 border-amber-200",
  },
  { key: "quoted", label: "Price Quote", color: "bg-blue-50 border-blue-200" },
  {
    key: "negotiation",
    label: "Negotiation",
    color: "bg-orange-50 border-orange-200",
  },
  { key: "on_hold", label: "On Hold", color: "bg-purple-50 border-purple-200" },
  {
    key: "won",
    label: "Closed Won",
    color: "bg-emerald-50 border-emerald-200",
  },
  { key: "lost", label: "Closed Lost", color: "bg-rose-50 border-rose-200" },
];

function DealCard({
  deal,
  onStageChange,
  onDelete,
  onClick,
  canDelete = false,
}: {
  deal: any;
  onStageChange: (id: string, stage: string, cardDeal?: any) => void;
  onDelete: (deal: any) => void;
  onClick?: () => void;
  canDelete?: boolean;
}) {
  const currentStage = (deal.stage || "new_inquiry").toLowerCase().trim();
  const isWon = currentStage === "won";
  const isLost = currentStage === "lost";

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow relative group cursor-pointer ${
        isWon
          ? "bg-emerald-50/40 border-emerald-200"
          : isLost
            ? "bg-rose-50/40 border-rose-200"
            : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between mb-2 gap-1.5">
        <h4 className="text-sm font-semibold text-gray-800 leading-tight flex-1 min-w-0 line-clamp-2 break-words">
          {deal.customer_name || "Unknown Customer"}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium border whitespace-nowrap ${
              isWon
                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                : isLost
                  ? "bg-rose-100 text-rose-800 border-rose-200"
                  : deal.inquiry_type === "purchase_order"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-blue-100 text-blue-700 border-blue-200"
            }`}
          >
            {isWon
              ? "WON"
              : isLost
                ? "LOST"
                : deal.inquiry_type === "purchase_order"
                  ? "PO"
                  : "Inquiry"}
          </span>
          {canDelete && (
            <button
              type="button"
              title="Delete this deal and all records"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(deal);
              }}
              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {deal.po_number && (
        <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-block mb-1.5">
          PO: {deal.po_number}
        </p>
      )}

      {isLost && (deal.lost_reason || deal.loss_reason) && (
        <div className="mb-2 p-1.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
          <span className="font-semibold">Reason:</span>{" "}
          {deal.lost_reason || deal.loss_reason}
        </div>
      )}

      {deal.deal_items && deal.deal_items.length > 0 && (
        <div className="mb-2">
          {deal.deal_items.slice(0, 2).map((item: any, i: number) => (
            <p key={i} className="text-xs text-gray-600">
              • {item.sku_text || item.sku || item.product_name || "Item"} -{" "}
              {item.quantity} {item.unit || "MT"}
            </p>
          ))}
          {deal.deal_items.length > 2 && (
            <p className="text-xs text-gray-400">
              +{deal.deal_items.length - 2} more
            </p>
          )}
        </div>
      )}

      {(() => {
        let computedTotal = Number(deal.total_amount) || 0;
        if (
          computedTotal <= 0 &&
          Array.isArray(deal.deal_items) &&
          deal.deal_items.length > 0
        ) {
          const subtotal = deal.deal_items.reduce((sum: number, item: any) => {
            const amt =
              Number(item.amount) ||
              (Number(item.quantity) || 0) *
                (Number(item.rate || item.quoted_price || item.price_per_mt) ||
                  0);
            return sum + amt;
          }, 0);
          if (subtotal > 0) {
            computedTotal = subtotal + Math.round(subtotal * 0.18);
          }
        }

        if (computedTotal > 0) {
          return (
            <div
              className={`flex items-center gap-1 text-sm font-bold my-1.5 ${isWon ? "text-emerald-800" : "text-gray-900"}`}
            >
              <IndianRupee
                size={13}
                className={isWon ? "text-emerald-700" : "text-gray-700"}
              />
              <span>{Number(computedTotal).toLocaleString("en-IN")}</span>
            </div>
          );
        }
        return null;
      })()}

      <div
        className="mt-3 flex gap-1 flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        {["quoted", "negotiation", "on_hold", "won", "lost"]
          .filter((stage) => {
            if (
              (currentStage === "new_inquiry" || currentStage === "review") &&
              (stage === "won" || stage === "lost")
            ) {
              return false;
            }
            if (
              stage === currentStage ||
              (stage === "quoted" && currentStage === "qualified")
            ) {
              return false;
            }
            return true;
          })
          .map((stage) => (
            <button
              key={stage}
              onClick={() => onStageChange(deal.id, stage, deal)}
              className={`text-xs px-2 py-1 rounded border transition-colors
                ${
                  stage === "won"
                    ? "border-green-300 text-green-700 hover:bg-green-50"
                    : stage === "lost"
                      ? "border-red-300 text-red-700 hover:bg-red-50"
                      : stage === "on_hold"
                        ? "border-purple-300 text-purple-700 hover:bg-purple-50"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
            >
              {stage === "quoted"
                ? "→ Quote"
                : stage === "negotiation"
                  ? "→ Negotiation"
                  : stage === "on_hold"
                    ? "→ On Hold"
                    : stage === "won"
                      ? "✓ Won"
                      : "✗ Lost"}
            </button>
          ))}
      </div>

      <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5 text-xs">
        <span className="text-gray-400 font-medium text-[11px] whitespace-nowrap shrink-0">
          {deal.created_at
            ? new Date(deal.created_at).toLocaleDateString("en-IN")
            : ""}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded tracking-tight text-[11px] uppercase whitespace-nowrap shrink-0">
            {deal.deal_number
              ? `#${deal.deal_number.replace(/^#?(?:DEAL|INQ)-/i, "INQ-")}`
              : deal.id
                ? `#INQ-${deal.id.substring(0, 6).toUpperCase()}`
                : "#INQ"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function resolveLinkedDeal(
  inq: InquiryItem,
  companyName?: string,
  dealsList: any[] = [],
) {
  if (!dealsList || dealsList.length === 0) return null;
  // 1. Direct 1-to-1 match by inquiry_id
  const directMatch = dealsList.find(
    (d: any) => d.inquiry_id && d.inquiry_id === inq.id,
  );
  if (directMatch) return directMatch;

  // 2. Match ONLY to an active open in-progress deal for this customer (never closed won/lost)
  const cName = (companyName || inq.customer_name || inq.sender_name || "")
    .toLowerCase()
    .trim();
  if (cName && !isProductOrGenericName(cName)) {
    const matchingDeals = dealsList.filter(
      (d: any) => (d.customer_name || "").toLowerCase().trim() === cName,
    );
    if (matchingDeals.length > 0) {
      const openDeal = matchingDeals.find(
        (d: any) => !["won", "lost"].includes((d.stage || "").toLowerCase()),
      );
      if (openDeal) return openDeal;
    }
  }
  return null;
}

export function resolveInquiryDealStageKey(inq: InquiryItem): string {
  const stage = String(inq.display_stage || "").toLowerCase().trim();
  return ["new_inquiry", "quoted", "negotiation", "on_hold", "won", "lost"].includes(
    stage,
  )
    ? stage
    : "new_inquiry";
}

/** Price Quote on screen wins over a deal row that is still New Inquiry. */
export function statusMoveBlock(
  visibleStage: string,
  dealStage: string,
  target: string,
): "new_inquiry" | "on_hold" | null {
  const visible = String(visibleStage || "").toLowerCase().trim();
  const stored = String(dealStage || "").toLowerCase().trim();
  const current =
    visible === "quoted" || visible === "qualified" ? "quoted" : stored;
  if (
    (current === "new_inquiry" || current === "review" || !current) &&
    (target === "lost" || target === "on_hold" || target === "negotiation")
  ) {
    return "new_inquiry";
  }
  if (
    target === "on_hold" &&
    current !== "quoted" &&
    current !== "qualified"
  ) {
    return "on_hold";
  }
  return null;
}

const EMPTY_INQUIRIES: InquiryItem[] = [];
const EMPTY_CUSTOMER_NAMES: string[] = [];
const EMPTY_TONNAGE_REVIEWS: TonnageReviewRow[] = [];

interface TonnageReviewRow {
  id: string;
  procurement_number?: string | null;
  salesperson_name?: string | null;
  changed_at?: string | null;
  previous_total_mt?: number | null;
  next_total_mt?: number | null;
  lines?: { sku_text?: string; from_mt?: number; to_mt?: number }[];
}

function formatTonnageMt(value: unknown) {
  const rounded = Math.round((Number(value) || 0) * 1000) / 1000;
  return `${rounded} MT`;
}

function formatTonnageWhen(value?: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const INQUIRY_PREFERRED_MAKES = ['TATA', 'JSW', 'AM/NS India', 'SAIL', 'NMDC', 'Apollo', 'Others'];
const INQUIRY_PAYMENT_TERMS = ['Immediate', 'Advance', '30 Days', '45 Days', '60 Days', 'LC', 'BG', 'PDC'];

export default function InquiriesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const {
    effectivePhone,
    employee,
    viewingAs,
    activeRole,
    activeMode,
    isAdmin,
    isSalesManager,
    isProcurement,
    isProcurementManager,
    guardAction,
    can,
  } = useAuth();
  const canViewSalesperson = isAdmin || isSalesManager || isProcurement;
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "pipeline">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("view") === "pipeline" ? "pipeline" : "table";
  });
  const [pipelineLostModal, setPipelineLostModal] = useState<{
    dealId: string;
    reason: string;
  } | null>(null);
  const [confirmDeleteDeal, setConfirmDeleteDeal] = useState<any | null>(null);
  const [confirmDeleteInquiry, setConfirmDeleteInquiry] = useState<InquiryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("stage") || params.get("status") || "all";
  });
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryItem | null>(
    null,
  );
  const autoOpenedInquiryRef = useRef<string | null>(null);
  const pricingDirtyRef = useRef(false);
  const [drawerReturnTo, setDrawerReturnTo] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("returnTo"),
  );

  const activeSalespersonName =
    viewingAs?.name ||
    employee?.name ||
    (selectedInquiry as any)?.salesperson_name ||
    (selectedInquiry as any)?.assigned_salesperson_name ||
    "Shravan Kotagi";
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("view") === "pipeline") {
      setViewMode("pipeline");
    } else {
      setViewMode("table");
    }
    const stageParam = params.get("stage") || params.get("status");
    if (stageParam) {
      setFilterStatus(stageParam);
    }
  }, [location.search]);

  useEffect(() => {
    document.title =
      viewMode === "pipeline"
        ? "Pipeline - Enlight Sales OS"
        : "Inquiries - Enlight Sales OS";
  }, [viewMode]);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  const [editDetails, setEditDetails] = useState<ExtractedDetails | null>(null);
  const [procurementRequest, setProcurementRequest] =
    useState<ProcurementRequest | null>(null);
  const [inquiryPricing, setInquiryPricing] =
    useState<InquirySalesPricing | null>(null);
  const [expandedRateIndex, setExpandedRateIndex] = useState<number | null>(
    null,
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [existingCustomers, setExistingCustomers] = useState<string[]>([]);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showEditCompanyDropdown, setShowEditCompanyDropdown] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [showZeroRateConfirmModal, setShowZeroRateConfirmModal] =
    useState(false);
  const [pendingSaveItems, setPendingSaveItems] = useState<LineItemDetail[]>(
    [],
  );
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfModalInquiry, setPdfModalInquiry] = useState<InquiryItem | null>(
    null,
  );
  const [pdfModalDetails, setPdfModalDetails] =
    useState<ExtractedDetails | null>(null);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showDeclinePreview, setShowDeclinePreview] = useState(false);
  const [declineSent, setDeclineSent] = useState(false);
  const [declineBody, setDeclineBody] = useState("");
  const [declineEmail, setDeclineEmail] = useState("");
  const [declineSubject, setDeclineSubject] = useState("");
  const [declineCc, setDeclineCc] = useState<string[]>([]);
  const [declineCcDraft, setDeclineCcDraft] = useState("");
  const [declineCcError, setDeclineCcError] = useState("");
  const [declineSenderEmail, setDeclineSenderEmail] = useState("");
  const [declinePreviewLoading, setDeclinePreviewLoading] = useState(false);
  const [declinePreviewError, setDeclinePreviewError] = useState("");
  const [sendingDecline, setSendingDecline] = useState(false);
  const [shareInquiry, setShareInquiry] = useState<InquiryItem | null>(null);
  const [shareDetails, setShareDetails] = useState<ExtractedDetails | null>(
    null,
  );
  const [quotationEmail, setQuotationEmail] = useState("");
  const [quotationSubject, setQuotationSubject] = useState("");
  const [quotationBody, setQuotationBody] = useState("");
  const [quotationCc, setQuotationCc] = useState<string[]>([]);
  const [quotationCcDraft, setQuotationCcDraft] = useState("");
  const [quotationCcError, setQuotationCcError] = useState("");
  const [quotationReference, setQuotationReference] = useState("");
  const [quotationSenderEmail, setQuotationSenderEmail] = useState("");
  const [quotationPreviewLoading, setQuotationPreviewLoading] = useState(false);
  const [quotationPreviewError, setQuotationPreviewError] = useState("");
  const [sendingQuotation, setSendingQuotation] = useState(false);
  const [resendNotice, setResendNotice] = useState("");
  const [isQuotationSent, setIsQuotationSent] = useState(false);
  const [lastSharedById, setLastSharedById] = useState<Record<string, string>>(
    {},
  );
  const quotationWasShared = (inquiry?: { id?: string; ai_extraction_json?: any } | null) =>
    Boolean(
      inquiry?.id &&
        (lastSharedById[inquiry.id] ||
          (inquiry.ai_extraction_json as any)?.quotation_shared_at),
    );

  useEffect(() => {
    if (!showQuotationModal || !shareInquiry || !shareDetails) return;
    let cancelled = false;
    setQuotationPreviewLoading(true);
    setQuotationPreviewError("");
    inquiriesApi
      .previewQuotation(shareInquiry.id, {
        customer_email: quotationEmail.trim(),
        customer_name: shareDetails.companyName,
        details: shareDetails,
      })
      .then((res) => {
        if (cancelled) return;
        const preview = res?.data?.data || res?.data;
        setQuotationSubject(preview?.subject || "");
        setQuotationBody(preview?.body || "");
        setQuotationCc(
          Array.isArray(preview?.cc)
            ? preview.cc
                .map((email: string) => normalizeQuotationEmail(email))
                .filter(isValidQuotationEmail)
            : [],
        );
        setQuotationCcDraft("");
        setQuotationCcError("");
        setQuotationReference(preview?.quotation_reference || "");
        setQuotationSenderEmail(preview?.sender_email || "");
      })
      .catch((err: any) => {
        if (cancelled) return;
        setQuotationPreviewError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            "Unable to prepare the quotation email. Please try again.",
        );
        setQuotationSenderEmail("");
      })
      .finally(() => {
        if (!cancelled) setQuotationPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showQuotationModal, shareInquiry?.id]);

  useEffect(() => {
    if (!showDeclinePreview || !selectedInquiry) return;
    let cancelled = false;
    setDeclinePreviewLoading(true);
    setDeclinePreviewError("");
    inquiriesApi
      .previewDecline(selectedInquiry.id)
      .then((res) => {
        if (cancelled) return;
        const preview = res?.data?.data || res?.data || {};
        const customerName =
          selectedInquiry.customer_name ||
          selectedInquiry.sender_name ||
          (selectedInquiry.ai_extraction_json as { customer_name?: string } | undefined)?.customer_name ||
          "Customer";
        setDeclineSubject(
          preview.subject || `Enlight Metals - Quotation Update for ${customerName}`,
        );
        setDeclineBody(preview.body || "");
        const fromPreview = Array.isArray(preview.cc)
          ? preview.cc
              .map((email: string) => normalizeQuotationEmail(email))
              .filter(isValidQuotationEmail)
          : [];
        const salespersonEmail =
          (viewingAs || employee)?.email || preview.employee_email || "";
        setDeclineCc(
          withSalespersonCc(fromPreview, salespersonEmail, declineEmail),
        );
        setDeclineCcDraft("");
        setDeclineCcError("");
        setDeclineSenderEmail(preview.sender_email || "");
        if (preview.customer_email) setDeclineEmail(preview.customer_email);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setDeclinePreviewError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            "A decline email is available only when every line is unavailable.",
        );
        setDeclineSenderEmail("");
      })
      .finally(() => {
        if (!cancelled) setDeclinePreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showDeclinePreview, selectedInquiry?.id]);

  const commitDeclineCcDraft = () => {
    const result = addQuotationCcEmail(declineCc, declineCcDraft, declineEmail);
    setDeclineCc(result.emails);
    setDeclineCcError(result.error);
    if (!result.error) setDeclineCcDraft("");
    return result;
  };

  const commitQuotationCcDraft = () => {
    const result = addQuotationCcEmail(
      quotationCc,
      quotationCcDraft,
      quotationEmail,
    );
    setQuotationCc(result.emails);
    setQuotationCcError(result.error);
    if (!result.error) setQuotationCcDraft("");
  };

  // Full-screen image viewer
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [viewingDocLoading, setViewingDocLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  const [dayPreset, setDayPreset] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: "all" as any,
    from: undefined,
    to: undefined,
  });

  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [subMenuInqId, setSubMenuInqId] = useState<string | null>(null);
  const [lostModal, setLostModal] = useState<{
    dealId: string;
    inqId: string;
    reason: string;
  } | null>(null);
  const [wonModal, setWonModal] = useState<{
    dealId: string;
    inqId: string;
    companyName: string;
    dealCode: string;
    poNumber: string;
    generatedPoNumber: string;
    referencePoNumber: string;
    poDate: string;
    poReservationToken: string;
    poConflict?: string | null;
    checkingPo?: boolean;
  } | null>(null);
  const wonPoDirtyRef = useRef(false);

  useEffect(() => {
    const inquiry = selectedInquiry;
    if (!inquiry?.id) return;
    const stored =
      lastSharedById[inquiry.id] ||
      (inquiry.ai_extraction_json as any)?.quotation_shared_at;
    if (stored) return;
    const status = (inquiry.status || "").toLowerCase();
    const alreadyShared =
      status === "quoted" ||
      status === "won" ||
      status === "quotation_sent" ||
      inquiry.inquiry_type === "quotation_sent" ||
      isQuotationSent;
    if (!alreadyShared) return;

    let cancelled = false;
    const name = (
      inquiry.customer_name ||
      inquiry.sender_name ||
      editDetails?.companyName ||
      ""
    )
      .trim()
      .toLowerCase();

    activityLogsApi
      .getAll({ module: "Inquiries", search: "Quotation sent", limit: 200 })
      .then((response) => {
        if (cancelled) return;
        const raw = response?.data;
        const rows = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.data?.data)
              ? raw.data.data
              : [];
        const match = rows.find((log: any) => {
          const description = String(log?.description || "").toLowerCase();
          if (!description.startsWith("quotation sent")) return false;
          if (log?.entity_id)
            return String(log.entity_id) === String(inquiry.id);
          return Boolean(name) && description.includes(name);
        });
        const iso = match?.timestamp || match?.created_at;
        if (!iso) return;
        setLastSharedById((prev) =>
          prev[inquiry.id] ? prev : { ...prev, [inquiry.id]: iso },
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    selectedInquiry,
    editDetails?.companyName,
    isQuotationSent,
    lastSharedById,
  ]);

  const LOST_REASONS = [
    "Price",
    "Credit terms",
    "Delivery timeline",
    "Material unavailable",
    "Spec mismatch",
    "Competitor relationship",
    "Customer silent",
    "Cancelled by customer",
  ];

  useEffect(() => {
    setCurrentPage(1);
    setOpenActionMenuId(null);
    setSubMenuInqId(null);
  }, [searchTerm, filterStatus, dateRange]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenActionMenuId(null);
      setSubMenuInqId(null);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // Prevent background scrolling when any modal or drawer is open
  useEffect(() => {
    const isAnyModalOpen =
      showModal ||
      showEditDrawer ||
      showPdfModal ||
      showQuotationModal ||
      !!imageViewerUrl ||
      !!lostModal ||
      !!wonModal;
    const body = document.body;
    const docEl = document.documentElement;
    const mainLayoutContainer = document.querySelector(
      ".flex-1.overflow-auto",
    ) as HTMLElement | null;

    if (isAnyModalOpen) {
      body.style.overflow = "hidden";
      docEl.style.overflow = "hidden";
      if (mainLayoutContainer) {
        mainLayoutContainer.style.overflow = "hidden";
      }
      return () => {
        body.style.overflow = "unset";
        docEl.style.overflow = "unset";
        if (mainLayoutContainer) {
          mainLayoutContainer.style.overflow = "auto";
        }
      };
    } else {
      body.style.overflow = "unset";
      docEl.style.overflow = "unset";
      if (mainLayoutContainer) {
        mainLayoutContainer.style.overflow = "auto";
      }
    }
  }, [
    showModal,
    showEditDrawer,
    showPdfModal,
    showQuotationModal,
    imageViewerUrl,
  ]);

  const handleClearAllFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setDayPreset("all");
    setShowCustomDate(false);
    setCustomFrom("");
    setCustomTo("");
    setDateRange({
      preset: "all" as any,
      from: undefined,
      to: undefined,
    });
    setCurrentPage(1);
    setOpenActionMenuId(null);
  };

  const handleDayPresetChange = (preset: string) => {
    setDayPreset(preset);
    const today = formatLocalDate();
    if (preset === "all") {
      setShowCustomDate(false);
      setCustomFrom("");
      setCustomTo("");
      setDateRange({ preset: "all" as any, from: undefined, to: undefined });
    } else if (preset === "today") {
      setShowCustomDate(false);
      setDateRange({ preset: "today" as any, from: today, to: today });
    } else if (preset === "7_days") {
      setShowCustomDate(false);
      setDateRange({ preset: "7_days" as any, from: getDaysAgo(7), to: today });
    } else if (preset === "30_days") {
      setShowCustomDate(false);
      setDateRange({
        preset: "30_days" as any,
        from: getDaysAgo(30),
        to: today,
      });
    } else if (preset === "90_days") {
      setShowCustomDate(false);
      setDateRange({
        preset: "90_days" as any,
        from: getDaysAgo(90),
        to: today,
      });
    } else if (preset === "custom") {
      setShowCustomDate(true);
      setDateRange({ preset: "custom", from: customFrom, to: customTo });
    }
  };

  const handleCustomFromChange = (val: string) => {
    setCustomFrom(val);
    let effectiveTo = customTo;
    if (val && customTo && val > customTo) {
      effectiveTo = val;
      setCustomTo(val);
    }
    setDateRange({ preset: "custom", from: val, to: effectiveTo });
  };

  const handleCustomToChange = (val: string) => {
    setCustomTo(val);
    let effectiveFrom = customFrom;
    if (val && customFrom && customFrom > val) {
      effectiveFrom = val;
      setCustomFrom(val);
    }
    setDateRange({ preset: "custom", from: effectiveFrom, to: val });
  };

  // Form state for Manual Log & File Upload
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formCustomerEmail, setFormCustomerEmail] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [formPreferredMake, setFormPreferredMake] = useState("");
  const [formDeliveryLocation, setFormDeliveryLocation] = useState("");
  const [formPaymentTerms, setFormPaymentTerms] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRequirement, setFormRequirement] = useState("");
  const [formInquiryType, setFormInquiryType] = useState("Product Requirement");
  const [poFileName, setPoFileName] = useState("");
  const [poFileBase64, setPoFileBase64] = useState<string | null>(null);
  const [drawerFileBase64, setDrawerFileBase64] = useState<string | null>(null);
  const [isExtractingPo, setIsExtractingPo] = useState(false);
  const formExtractedJsonRef = useRef<any>(null);
  const uploadRequestRef = useRef(0);
  const emptyLineItem = (): LineItemDetail => ({
    sku_text: "",
    dimensions: "",
    brand: "",
    make: "",
    hsn_code: "",
    quantity: 0,
    unit: "MT",
    rate: 0,
    amount: 0,
    cgst_rate: 9,
    cgst_amount: 0,
    sgst_rate: 9,
    sgst_amount: 0,
    total_gst: 0,
    final_amount: 0,
  });

  const clearExtractedInquiryFields = () => {
    setFormCustomerName("");
    setFormCustomerEmail("");
    setShowAddCustomer(false);
    setShowCompanyDropdown(false);
    setFormPhone("");
    setFormPreferredMake("");
    setFormDeliveryLocation("");
    setFormPaymentTerms("");
    setFormRequirement("");
    setFormInquiryType("Product Requirement");
    setPoFileName("");
    setPoFileBase64(null);
    formExtractedJsonRef.current = null;
    setFormLineItems([emptyLineItem()]);
  };

  const handleRemoveUploadedInquiryDocument = () => {
    uploadRequestRef.current += 1;
    clearExtractedInquiryFields();
    const input = document.getElementById(
      "inquiry-doc-file-upload",
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  };
  const [formLineItems, setFormLineItems] = useState<LineItemDetail[]>([
    {
      sku_text: "",
      dimensions: "",
      brand: "",
      make: "",
      hsn_code: "",
      quantity: 0,
      unit: "MT",
      rate: 0,
      amount: 0,
      cgst_rate: 9,
      cgst_amount: 0,
      sgst_rate: 9,
      sgst_amount: 0,
      total_gst: 0,
      final_amount: 0,
    },
  ]);

  const handleCancelCreateInquiry = () => {
    setShowModal(false);
    clearExtractedInquiryFields();
  };

  const isPdf = (url: string) => {
    if (!url) return false;
    return (
      url.toLowerCase().includes(".pdf") ||
      url.startsWith("data:application/pdf")
    );
  };

  const {
    data: rawInquiries = EMPTY_INQUIRIES,
    isLoading: loading,
    isFetching,
    refetch: fetchMonthlyInquiries,
  } = useQuery<InquiryItem[]>({
    queryKey: ["inquiries-list", effectivePhone, activeRole, activeMode],
    queryFn: async () => {
      const params: any = {};
      if (effectivePhone) params.salesperson_phone = effectivePhone;
      if (activeMode) params.mode = activeMode;

      const res = await inquiriesApi.getAll(params);
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.data)
          ? res.data.data
          : [];
      return list;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const {
    data: tonnageReviews = EMPTY_TONNAGE_REVIEWS,
    isLoading: tonnageReviewsLoading,
    isError: tonnageReviewsError,
    refetch: fetchTonnageReviews,
  } = useQuery<TonnageReviewRow[]>({
    queryKey: ["tonnage-reviews", employee?.id],
    enabled: isProcurement,
    refetchInterval: 10000,
    queryFn: async () => {
      const res = await inquiriesApi.getTonnageReviews();
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.data)
          ? res.data.data
          : [];
      return list;
    },
  });

  const { data: rawCustomers = EMPTY_CUSTOMER_NAMES } = useQuery<string[]>({
    queryKey: queryKeys.customerNames(effectivePhone, activeRole, activeMode),
    queryFn: async (): Promise<string[]> => {
      const params: any = {};
      if (effectivePhone) params.salesperson_phone = effectivePhone;
      if (activeMode) params.mode = activeMode;

      const custRes = await customersApi.getAll(params).catch(() => null);
      const rawCust = custRes?.data;
      const cList = Array.isArray(rawCust)
        ? rawCust
        : Array.isArray(rawCust?.data)
          ? rawCust.data
          : [];
      const fetchedNames: string[] = cList
        .map((c: any) =>
          String(c.customer_name || c.name || c.company_name || "").trim(),
        )
        .filter(Boolean);

      return Array.from(new Set(fetchedNames)).sort((a, b) =>
        a.localeCompare(b),
      );
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    enabled: !isProcurement,
  });

  const { data: rawEmployees = [] } = useQuery<any[]>({
    queryKey: queryKeys.employeesDirectory,
    queryFn: async () => {
      const res = await employeesApi.getAll().catch(() => null);
      return normalizeListResponse(res?.data);
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: rawDeals = [],
    isFetching: dealsFetching,
    refetch: fetchDeals,
  } = useQuery<any[]>({
    queryKey: ["deals", effectivePhone, dateRange, activeRole, activeMode],
    queryFn: async () => {
      const params: any = {};
      if (effectivePhone) params.salesperson_phone = effectivePhone;
      if (activeMode) params.mode = activeMode;
      if (dateRange.from)
        params.from = dateRange.from.includes("T")
          ? dateRange.from
          : `${dateRange.from}T00:00:00.000Z`;
      if (dateRange.to)
        params.to = dateRange.to.includes("T")
          ? dateRange.to
          : `${dateRange.to}T23:59:59.999Z`;
      const res = await dealsApi.getAll(params).catch(() => null);
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.data)
          ? res.data.data
          : [];
      return list;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    enabled: !isProcurement,
  });

  const [isSyncingZoho, setIsSyncingZoho] = useState(false);

  const handleTriggerZohoSync = async () => {
    try {
      setIsSyncingZoho(true);
      const res = await zohoApi.pullInitialSync();
      const data = res?.data?.data || res?.data || {};
      const notice = Array.isArray(data.errors) ? data.errors[0] : "";
      if (
        data.success === false ||
        (notice && !data.companiesImported && !data.dealsImported)
      ) {
        toast.error(notice || "Could not sync with Zoho Bigin");
        return;
      }
      toast.success(
        `Bigin sync complete. Created: ${data.recordsCreated ?? data.companiesImported ?? 0}, Updated: ${data.recordsUpdated ?? 0}, Skipped: ${data.recordsSkipped ?? 0}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["inquiries-list"] });
      queryClient.invalidateQueries({ queryKey: ["customer-names-list"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      await Promise.all([fetchMonthlyInquiries(), fetchDeals()]);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Could not sync with Zoho Bigin",
      );
    } finally {
      setIsSyncingZoho(false);
    }
  };

  const stageMutation = useMutation({
    mutationFn: ({
      id,
      stage,
      reason,
      po_number,
      po_date,
    }: {
      id: string;
      stage: string;
      reason?: string;
      po_number?: string;
      po_date?: string;
    }) => dealsApi.updateStage(id, stage, reason, po_number, po_date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["kra-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries-list"] });
      toast.success("Deal stage updated");
      setPipelineLostModal(null);
      setWonModal(null);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "Failed to update deal"),
  });

  const releaseWonPoReservation = (
    reservationToken: string,
    poNumber?: string,
    dealId?: string,
  ) => {
    if (!reservationToken) return;
    void dealsApi
      .releasePoReservation({
        reservation_token: reservationToken,
        po_number: poNumber?.trim() || undefined,
        deal_id: dealId,
      })
      .catch((error) => {
        console.error("[SystemPO] Inquiry Won modal release failed", {
          reservationToken,
          poNumber,
          dealId,
          error,
        });
      });
  };

  const handleCancelWon = () => {
    if (!wonModal) return;
    const { poReservationToken, generatedPoNumber, poNumber, dealId } =
      wonModal;
    setWonModal(null);
    releaseWonPoReservation(
      poReservationToken,
      generatedPoNumber || poNumber,
      dealId,
    );
  };

  const openWonModalForDeal = async (details: {
    dealId: string;
    inqId: string;
    companyName: string;
    dealCode: string;
    existingDeal?: any;
  }) => {
    const reservationToken = `dashboard-won:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    const existingGenerated = String(
      details.existingDeal?.generated_po_number ||
        (/^EM\/PO\/\d+$/i.test(
          String(details.existingDeal?.po_number || "").trim(),
        )
          ? details.existingDeal.po_number
          : ""),
    ).trim();
    const legacyReferencePo =
      !existingGenerated &&
      details.existingDeal?.po_number &&
      !/^EM\/PO\/\d+$/i.test(String(details.existingDeal.po_number).trim())
        ? String(details.existingDeal.po_number).trim()
        : "";

    wonPoDirtyRef.current = false;
    let generatedPoNumber = existingGenerated;
    let poNumber = existingGenerated;
    let allocationToast: string | undefined;

    if (!existingGenerated) {
      allocationToast = toast.loading("Generating system PO…");
    }

    try {
      if (!existingGenerated) {
        const response = await dealsApi.allocatePo({
          reservation_token: reservationToken,
          deal_id: details.dealId,
        });
        const allocation = response?.data;
        if (!allocation?.po_number) {
          throw new Error("The system did not return a generated PO number.");
        }
        poNumber = String(allocation.po_number);
        generatedPoNumber = String(
          allocation.generated_po_number || allocation.po_number,
        );
      }

      if (allocationToast) toast.dismiss(allocationToast);
      setWonModal({
        dealId: details.dealId,
        inqId: details.inqId,
        companyName: details.companyName,
        dealCode: details.dealCode,
        poNumber,
        generatedPoNumber,
        referencePoNumber: String(
          details.existingDeal?.reference_po_number || legacyReferencePo,
        ).trim(),
        poDate:
          details.existingDeal?.po_date ||
          new Date().toISOString().split("T")[0],
        poReservationToken: reservationToken,
        poConflict: null,
        checkingPo: false,
      });
    } catch (error: any) {
      if (allocationToast) toast.dismiss(allocationToast);
      releaseWonPoReservation(
        reservationToken,
        generatedPoNumber || poNumber || undefined,
        details.dealId,
      );
      logPoAllocationError(
        "Inquiry Won modal",
        error,
        reservationToken,
        details.dealId,
      );
      toast.error(
        error?.response?.data?.message ||
          "Could not generate the system PO. Please try again.",
      );
    }
  };

  useEffect(() => {
    const poNumber = wonModal?.poNumber?.trim();
    if (!wonModal || !poNumber) return;

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setWonModal((previous) =>
        previous ? { ...previous, checkingPo: true } : null,
      );

      try {
        const response = await dealsApi.checkPoAvailability({
          po_number: poNumber,
          reservation_token: wonModal.poReservationToken,
          deal_id: wonModal.dealId,
        });
        if (!active) return;
        setWonModal((previous) =>
          previous
            ? {
                ...previous,
                poConflict:
                  response?.data?.available === false
                    ? response?.data?.reason ||
                      "This PO number is already allocated."
                    : null,
                checkingPo: false,
              }
            : null,
        );
      } catch {
        if (active) {
          setWonModal((previous) =>
            previous
              ? {
                  ...previous,
                  poConflict:
                    "PO availability could not be checked. Please try again.",
                  checkingPo: false,
                }
              : null,
          );
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [wonModal?.poNumber, wonModal?.poReservationToken, wonModal?.dealId]);

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      const targetInqId =
        confirmDeleteDeal?.inquiry_id || confirmDeleteDeal?.rawInquiry?.id;
      if (targetInqId) {
        try {
          return await inquiriesApi.delete(targetInqId);
        } catch {
          return await dealsApi.delete(id);
        }
      }
      return await dealsApi.delete(id);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["kra-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries-list"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toast.success("Deal and all associated records deleted successfully");
      setConfirmDeleteDeal(null);
      await Promise.all([fetchMonthlyInquiries(), fetchDeals()]);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to delete deal");
    },
  });

  const handlePipelineStageChange = (
    id: string,
    stage: string,
    cardDeal?: any,
  ) => {
    const rawInq =
      cardDeal?.rawInquiry ||
      inquiries.find((i) => i.id === id || i.id === cardDeal?.inquiry_id);
    const details =
      cardDeal?.details ||
      (rawInq ? parseInquiryText(rawInq.raw_text || "", rawInq) : null);

    if (rawInq && details) {
      handleUpdateDealStage(rawInq, details, stage);
    } else if (stage === "lost") {
      setPipelineLostModal({ dealId: id, reason: "" });
    } else if (stage === "won") {
      const targetDeal = rawDeals?.find((d: any) => d.id === id);
      const targetId = targetDeal?.inquiry_id || id;
      const cleanId = (
        targetId.startsWith("DEAL-") || targetId.startsWith("INQ-")
          ? targetId.replace(/^(?:DEAL|INQ)-/, "")
          : targetId.substring(0, 6)
      ).toUpperCase();
      void openWonModalForDeal({
        dealId: id,
        inqId: targetDeal?.inquiry_id || id,
        companyName: targetDeal?.customer_name || "Customer",
        dealCode: `#INQ-${cleanId}`,
        existingDeal: targetDeal,
      });
    } else {
      stageMutation.mutate({ id, stage });
    }
  };

  const getLinkedDeal = (inq: InquiryItem, companyName?: string) => {
    return resolveLinkedDeal(inq, companyName, rawDeals);
  };

  const getDealStageDisplay = (stage?: string) => {
    if (!stage) return null;
    const s = stage.toLowerCase().trim();
    if (
      s === "new_inquiry" ||
      s === "new" ||
      s === "new inquiry" ||
      s === "review"
    ) {
      return {
        label: "New Inquiry",
        className: "bg-amber-100 text-amber-800 border-amber-200",
      };
    }
    if (
      s === "quoted" ||
      s === "quotation_sent" ||
      s === "proposal" ||
      s === "qualified" ||
      s === "saved" ||
      s === "confirmed" ||
      s === "price quote" ||
      s === "proposal/price quote"
    ) {
      return {
        label: "Price Quote",
        className: "bg-blue-100 text-blue-800 border-blue-200",
      };
    }
    if (s === "negotiation" || s === "negotiation/review") {
      return {
        label: "Negotiation",
        className: "bg-orange-100 text-orange-800 border-orange-200",
      };
    }
    if (s === "on_hold" || s === "hold" || s === "on hold") {
      return {
        label: "On Hold",
        className: "bg-purple-100 text-purple-800 border-purple-200",
      };
    }
    if (s === "won") {
      return {
        label: "Won",
        className: "bg-emerald-100 text-emerald-900 border-emerald-200",
      };
    }
    if (s === "lost") {
      return {
        label: "Lost",
        className: "bg-rose-100 text-rose-800 border-rose-200",
      };
    }
    return {
      label: stage,
      className: "bg-slate-50 text-slate-700 border-slate-200",
    };
  };

  const getInquiryDealStageKey = (
    inq: InquiryItem,
  ): string => {
    return resolveInquiryDealStageKey(inq);
  };

  const handleUpdateDealStage = async (
    inq: InquiryItem,
    details: ExtractedDetails,
    targetStage: string,
  ) => {
    setOpenActionMenuId(null);
    setSubMenuInqId(null);

    let linked = getLinkedDeal(inq, details.companyName);

    if (!linked || !linked.id) {
      try {
        await inquiriesApi.updateStatus(inq.id, "confirmed", {
          ...details,
          companyName: details.companyName,
          customerPhone: details.customerPhone,
          salespersonName: activeSalespersonName,
          deliveryLocation: details.deliveryLocation,
          paymentTerms: details.paymentTerms,
          lineItems: details.lineItems,
          totalAmount: details.totalAmount,
        });
        const refetched = await dealsApi
          .getAll({ salesperson_phone: effectivePhone })
          .catch(() => null);
        const list = Array.isArray(refetched?.data)
          ? refetched.data
          : Array.isArray(refetched?.data?.data)
            ? refetched.data.data
            : [];
        linked = list.find(
          (d: any) =>
            d.inquiry_id === inq.id ||
            (d.customer_name &&
              d.customer_name.toLowerCase().trim() ===
                details.companyName?.toLowerCase().trim()),
        );
      } catch (err) {
        console.warn("Could not auto-sync deal:", err);
      }
    }

    if (!linked || !linked.id) {
      toast.error("No linked deal found for this inquiry.");
      return;
    }

    const currentDealStage = (linked.stage || "").toLowerCase().trim();
    const moveBlock = statusMoveBlock(
      getInquiryDealStageKey(inq),
      currentDealStage,
      targetStage,
    );
    if (moveBlock === "new_inquiry") {
      toast.error(
        `Cannot move inquiry to ${targetStage.toUpperCase().replace("_", " ")} from New Inquiry stage. Unit rates must be quoted first.`,
      );
      return;
    }

    if (moveBlock === "on_hold") {
      toast.error(
        "Cannot put deal on hold. Deal must be in Price Quote stage before it can be placed on hold.",
      );
      return;
    }

    if (targetStage === "lost") {
      setLostModal({ dealId: linked.id, inqId: inq.id, reason: "" });
      return;
    }

    if (targetStage === "won") {
      const targetId = linked.inquiry_id || linked.id;
      const cleanId = (
        targetId.startsWith("DEAL-") || targetId.startsWith("INQ-")
          ? targetId.replace(/^(?:DEAL|INQ)-/, "")
          : targetId.substring(0, 6)
      ).toUpperCase();
      void openWonModalForDeal({
        dealId: linked.id,
        inqId: inq.id,
        companyName: details.companyName || inq.sender_name || "Customer",
        dealCode: `#INQ-${cleanId}`,
        existingDeal: linked,
      });
      return;
    }

    try {
      const toastId = toast.loading(
        `Updating deal to ${targetStage.toUpperCase()}...`,
      );
      await dealsApi.updateStage(linked.id, targetStage);
      toast.dismiss(toastId);
      toast.success(
        `Deal status updated to ${targetStage.charAt(0).toUpperCase() + targetStage.slice(1)}!`,
      );

      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries-list"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      queryClient.invalidateQueries({ queryKey: ["kra-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      fetchMonthlyInquiries();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to update deal status.",
      );
    }
  };

  const handleConfirmWon = async () => {
    if (!wonModal || !wonModal.dealId) return;
    const cleanPo = (wonModal.poNumber || "").trim();
    if (!cleanPo) {
      toast.error("System PO number is required.");
      return;
    }
    if (wonModal.checkingPo || wonModal.poConflict) {
      toast.error(
        wonModal.poConflict || "Checking PO number availability. Please wait.",
      );
      return;
    }

    try {
      const availability = await dealsApi.checkPoAvailability({
        po_number: cleanPo,
        reservation_token: wonModal.poReservationToken,
        deal_id: wonModal.dealId,
      });
      if (availability?.data?.available === false) {
        const reason =
          availability?.data?.reason || "This PO number is already allocated.";
        setWonModal((previous) =>
          previous ? { ...previous, poConflict: reason } : null,
        );
        toast.error(reason);
        return;
      }
      const toastId = toast.loading(
        "Marking deal as Won and adding to Orders...",
      );
      await dealsApi.updateStage(
        wonModal.dealId,
        "won",
        undefined,
        cleanPo,
        wonModal.poDate,
        wonModal.referencePoNumber.trim() || undefined,
        wonModal.generatedPoNumber.trim() || cleanPo,
        wonModal.poReservationToken,
      );
      toast.dismiss(toastId);
      toast.success(
        `Inquiry marked as Won and added to Orders module (PO: ${cleanPo})!`,
      );
      setWonModal(null);

      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries-list"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      queryClient.invalidateQueries({ queryKey: ["kra-dashboard"] });
      fetchMonthlyInquiries();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        const reason =
          err?.response?.data?.message ||
          "This PO number is already allocated.";
        setWonModal((previous) =>
          previous ? { ...previous, poConflict: reason } : null,
        );
      }
      toast.error(
        err?.response?.data?.message || "Failed to mark deal as won.",
      );
    }
  };

  const handleConfirmLost = async () => {
    if (!lostModal || !lostModal.dealId || !lostModal.reason) return;
    try {
      const toastId = toast.loading("Marking deal as Lost...");
      await dealsApi.updateStage(lostModal.dealId, "lost", lostModal.reason);
      toast.dismiss(toastId);
      toast.success("Deal marked as Lost.");
      setLostModal(null);

      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries-list"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      queryClient.invalidateQueries({ queryKey: ["kra-dashboard"] });
      fetchMonthlyInquiries();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to mark deal as lost.",
      );
    }
  };

  const getSalespersonName = (
    inq?: InquiryItem | null,
    details?: ExtractedDetails | null,
  ) => {
    if (
      details?.salespersonName &&
      details.salespersonName !== "Sales Representative" &&
      details.salespersonName !== "Unknown"
    ) {
      return details.salespersonName;
    }
    if (
      (inq as any)?.salesperson_name &&
      (inq as any).salesperson_name !== "Sales Representative"
    ) {
      return (inq as any).salesperson_name;
    }
    if (
      (inq as any)?.assigned_salesperson_name &&
      (inq as any).assigned_salesperson_name !== "Sales Representative"
    ) {
      return (inq as any).assigned_salesperson_name;
    }
    if (
      (inq as any)?.salesperson &&
      (inq as any).salesperson !== "Sales Representative"
    ) {
      return (inq as any).salesperson;
    }

    const ai = (inq?.ai_extraction_json as any) || {};
    if (ai.salespersonName && ai.salespersonName !== "Sales Representative")
      return ai.salespersonName;
    if (ai.salesperson_name && ai.salesperson_name !== "Sales Representative")
      return ai.salesperson_name;

    const phone = (
      (inq?.salesperson_phone || inq?.sender_phone || "") as string
    ).replace(/\D/g, "");
    if (phone && rawEmployees && rawEmployees.length > 0) {
      const p10 = phone.slice(-10);
      const found = rawEmployees.find((e: any) => {
        const ePhone = (e.phone || "").replace(/\D/g, "");
        return ePhone.endsWith(p10) || p10.endsWith(ePhone.slice(-10));
      });
      if (found?.name) return found.name;
    }

    if (inq?.sender_name && rawEmployees && rawEmployees.length > 0) {
      const sName = inq.sender_name.toLowerCase().trim();
      if (
        !sName.includes("unknown") &&
        !sName.includes("customer") &&
        !sName.includes("retail") &&
        !sName.includes("steel") &&
        !sName.includes("ltd")
      ) {
        const found = rawEmployees.find(
          (e: any) =>
            (e.name || "").toLowerCase().trim() === sName ||
            sName.includes((e.name || "").toLowerCase().trim()),
        );
        if (found?.name) return found.name;
      }
    }

    if (viewingAs?.name) return viewingAs.name;
    if (employee && !employee.role?.toLowerCase().includes("admin"))
      return employee.name;

    return "Max";
  };

  useEffect(() => {
    if (!Array.isArray(rawInquiries)) return;
    setInquiries(rawInquiries);

    // If drawer is currently open for an inquiry, sync fresh data live into drawer
      if (selectedInquiry) {
        const freshItem = rawInquiries.find(
          (i: InquiryItem) => i.id === selectedInquiry.id,
        );
        if (freshItem) {
          const pricing_status = keptPricingStatus(
            selectedInquiry.pricing_status,
            freshItem.pricing_status,
          );
          setSelectedInquiry({ ...freshItem, pricing_status });
          const ai = (freshItem.ai_extraction_json as any) || {};
          const lineItemsSrc: any[] = ai.line_items || ai.lineItems || [];
          const resolvedSp = getSalespersonName(freshItem);
          const parsed = parseInquiryText(freshItem.raw_text || "", freshItem);

          if (lineItemsSrc.length > 0) {
            const frozenLineItems = lineItemsSrc.map((item: any) => {
              const skuText = item.sku_text || item.description || "";
              const itemDim = item.dimensions || "";
              return {
                sku_text: skuText,
                dimensions: itemDim,
                hsn_code:
                  (item.hsn_code && item.hsn_code.trim()) ||
                  item.hsn ||
                  detectHsnCode(skuText, itemDim) ||
                  "72083840",
                quantity:
                  Number(item.original_quantity ?? item.quantity ?? item.qty) || 0,
                unit: item.original_unit || item.unit || "MT",
                rate: Number(item.rate) || 0,
                amount: (() => {
                  const quantity =
                    Number(item.original_quantity ?? item.quantity ?? item.qty) || 0;
                  const unit = item.original_unit || item.unit || "MT";
                  const rate = Number(item.rate) || 0;
                  if (rate <= 0) return Number(item.amount) || 0;
                  return pricedLineAmount(rate, {
                    ...item,
                    sku_text: skuText,
                    dimensions: itemDim,
                    quantity,
                    unit,
                  });
                })(),
              };
            });
            const frozenTotal =
              ai.total_amount ||
              ai.totalAmount ||
              (frozenLineItems.length > 0
                ? frozenLineItems.reduce((s: number, i: any) => s + i.amount, 0)
                : 0);

            setEditDetails((prev) => {
              if (!prev) return null;
              const lineItems = mergeDrawerLineRates(
                prev.lineItems,
                frozenLineItems,
              ).map((item: any) => {
                const rate = Number(item.rate) || 0;
                if (rate > 0 && !(Number(item.amount) > 0)) {
                  return { ...item, amount: pricedLineAmount(rate, item) };
                }
                return item;
              });
              return {
                ...prev,
                companyName:
                  freshItem.customer_name ||
                  ai.customer_name ||
                  ai.companyName ||
                  parsed.companyName ||
                  prev.companyName ||
                  "",
                customerPhone: parsed.customerPhone || prev.customerPhone || "",
                salespersonName: resolvedSp,
                totalAmount: lineItems.reduce(
                  (sum: number, item: any) => sum + (Number(item.amount) || 0),
                  0,
                ) || frozenTotal,
                lineItems,
                paymentTerms:
                  freshItem.payment_terms ||
                  freshItem.paymentTerms ||
                  ai.payment_terms ||
                  ai.paymentTerms ||
                  parsed.paymentTerms ||
                  prev.paymentTerms ||
                  "",
                deliveryLocation:
                  freshItem.delivery_location ||
                  freshItem.deliveryLocation ||
                  ai.delivery_location ||
                  ai.deliveryLocation ||
                  parsed.deliveryLocation ||
                  prev.deliveryLocation ||
                  "",
              };
            });

            const isConfirmedState = ["confirmed", "quoted", "won"].includes(
              (freshItem.status || "").toLowerCase(),
            );
            setSaveSuccess(isConfirmedState);
          } else {
            setEditDetails((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                ...parsed,
                salespersonName: resolvedSp,
                paymentTerms:
                  freshItem.payment_terms ||
                  freshItem.paymentTerms ||
                  ai.payment_terms ||
                  ai.paymentTerms ||
                  parsed.paymentTerms ||
                  prev.paymentTerms ||
                  "",
                deliveryLocation:
                  freshItem.delivery_location ||
                  freshItem.deliveryLocation ||
                  ai.delivery_location ||
                  ai.deliveryLocation ||
                  parsed.deliveryLocation ||
                  prev.deliveryLocation ||
                  "",
              };
            });
          }
        }
      }
  }, [rawInquiries]);

  useEffect(() => {
    if (!Array.isArray(rawCustomers)) return;
    setExistingCustomers(rawCustomers);
  }, [rawCustomers]);

  const handleOpenDrawer = (inq: InquiryItem) => {
    setSelectedInquiry(inq);
    pricingDirtyRef.current = false;
    const mapped = applyServerLines(inq, []);
    setProcurementRequest(mapped.request);
    setInquiryPricing(mapped.pricing);
    inquiriesApi.getLinePricing(inq.id).then((response) => {
      if (pricingDirtyRef.current) return;
      applyPricingResult(inq, response);
    }).catch(() => undefined);
    setExpandedRateIndex(null);
    const initialMedia =
      inq.media_urls?.[0] &&
      (inq.media_urls[0].startsWith("data:") ||
        inq.media_urls[0].startsWith("http"))
        ? inq.media_urls[0]
        : null;
    setDrawerFileBase64(initialMedia);

    if (
      !initialMedia &&
      (inq.has_media ||
        inq.media_urls?.includes("attached_document") ||
        (inq.raw_text &&
          inq.raw_text.trim().startsWith("[Inquiry Attachment:")))
    ) {
      inquiriesApi
        .getOne(inq.id)
        .then((res) => {
          const fullInq = res?.data?.data || res?.data;
          const dbMedia = fullInq?.media_urls?.[0];
          if (
            dbMedia &&
            (dbMedia.startsWith("data:") || dbMedia.startsWith("http"))
          ) {
            setDrawerFileBase64(dbMedia);
          }
        })
        .catch(() => {});
    }

    setShowEditDrawer(true);
    setShowEditCompanyDropdown(false);

    const ai = (inq.ai_extraction_json as any) || {};
    const lineItemsSrc: any[] = ai.line_items || ai.lineItems || [];
    const resolvedSp = getSalespersonName(inq);

    if (lineItemsSrc.length > 0) {
      // Has structured line items in ai_extraction_json - use directly for ALL inquiries (review, confirmed, etc.)
      const frozenLineItems = lineItemsSrc.map((item: any) => {
        const skuText = item.sku_text || item.description || "";
        const itemDim = item.dimensions || "";
        const rawQty =
          Number(item.original_quantity ?? item.quantity ?? item.qty) || 0;
        const rawUnit = normalizeUnit(item.original_unit || item.unit) || "MT";
        const rate =
          Number(item.rate ?? item.unitPrice ?? item.price_per_mt) || 0;
        const calc = calculateLineItem({
          ...item,
          quantity: rawQty,
          unit: rawUnit,
          rate: rate,
          dimensions: itemDim,
          sku_text: skuText,
          isManualAmount: item.isManualAmount,
          amount: item.isManualAmount ? item.amount : 0,
        });

        const itemMake = String((item as any).brand || (item as any).make || (item as any).preferred_make || ai.preferred_make || ai.make || inq.preferred_make || '').trim();
        return {
          sku_text: skuText,
          dimensions: itemDim,
          brand: itemMake,
          make: itemMake,
          hsn_code:
            (item.hsn_code && item.hsn_code.trim()) ||
            item.hsn ||
            detectHsnCode(skuText, itemDim) ||
            "72083840",
          quantity: rawQty,
          unit: rawUnit,
          rate: rate,
          amount:
            rate > 0
              ? pricedLineAmount(rate, {
                  ...item,
                  quantity: rawQty,
                  unit: rawUnit,
                  sku_text: skuText,
                  dimensions: itemDim,
                })
              : calc.amount,
          converted_mt:
            (item as any).converted_mt !== undefined
              ? (item as any).converted_mt
              : undefined,
          is_manual_mt:
            (item as any).is_manual_mt !== undefined
              ? (item as any).is_manual_mt
              : undefined,
        };
      });
      const lineItemsSum = frozenLineItems.reduce(
        (s: number, i: any) => s + (Number(i.amount) || 0),
        0,
      );
      const frozenTotal =
        lineItemsSum > 0
          ? lineItemsSum
          : ai.total_amount || ai.totalAmount || 0;

      const parsed = parseInquiryText(inq.raw_text || "", inq);

      setEditDetails({
        companyName:
          inq.customer_name ||
          ai.customer_name ||
          ai.companyName ||
          parsed.companyName ||
          "",
        customerPhone: parsed.customerPhone || inq.customer_phone || "",
        customerEmail: parsed.customerEmail || inquiryEmailFrom(inq.customer_email),
        salespersonName: resolvedSp,
        productType: frozenLineItems[0]?.sku_text || ai.productType || "",
        thickness: ai.thickness || "",
        width: ai.width || "",
        length: ai.length || "",
        productForm: ai.productForm || "Coil",
        quantityTons:
          calculateTotalTonnageMt(frozenLineItems).totalMt ||
          ai.quantityTons ||
          0,
        quantityUnits: ai.quantityUnits || 0,
        unitPrice: frozenLineItems[0]?.rate || ai.unitPrice || 0,
        totalAmount: frozenTotal,
        paymentTerms:
          inq.payment_terms ||
          inq.paymentTerms ||
          ai.payment_terms ||
          ai.paymentTerms ||
          parsed.paymentTerms ||
          "",
        deliveryLocation:
          inq.delivery_location ||
          inq.deliveryLocation ||
          (parsed.deliveryLocation &&
          parsed.deliveryLocation.length >
            (ai.delivery_location || ai.deliveryLocation || "").length
            ? parsed.deliveryLocation
            : ai.delivery_location ||
              ai.deliveryLocation ||
              parsed.deliveryLocation ||
              ""),
        deliveryDate: ai.delivery_date || ai.deliveryDate || "",
        lineItems: frozenLineItems,
      });
    } else {
      // True fallback: no structured line items in ai_extraction_json, parse raw text
      const parsed = parseInquiryText(inq.raw_text || "", inq);
      setEditDetails({
        ...parsed,
        salespersonName: resolvedSp,
      });
    }

    const isConfirmedState = ["confirmed", "quoted", "won"].includes(
      (inq.status || "").toLowerCase(),
    );
    setSaveSuccess(isConfirmedState);
    setFieldErrors({});
  };

  const handleCloseDrawer = () => {
    setShowEditDrawer(false);
    setShowEditCompanyDropdown(false);
    setSelectedInquiry(null);
    setEditDetails(null);
    setProcurementRequest(null);
    setInquiryPricing(null);
    pricingDirtyRef.current = false;
    setSavingPrices(false);
    setDrawerFileBase64(null);
    setDrawerReturnTo(null);

    // Clean inquiry search params from URL so switching views/filters does not re-open drawer
    const params = new URLSearchParams(window.location.search);
    if (
      params.has("inquiryId") ||
      params.has("id") ||
      params.has("inquiry_id") ||
      params.has("returnTo")
    ) {
      params.delete("inquiryId");
      params.delete("id");
      params.delete("inquiry_id");
      params.delete("returnTo");
      const newSearch = params.toString();
      navigate({ search: newSearch ? `?${newSearch}` : "" }, { replace: true });
    }
  };

  const deleteInquiryMutation = useMutation({
    mutationFn: (id: string) => inquiriesApi.delete(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries-list"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["kra-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      queryClient.invalidateQueries({ queryKey: ["customer-names-list"] });
      toast.success("Inquiry and all associated records deleted successfully");
      setConfirmDeleteInquiry(null);
      handleCloseDrawer();
      await Promise.all([fetchMonthlyInquiries(), fetchDeals()]);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to delete inquiry");
    },
  });

  const updateInquiryPricingLine = (
    index: number,
    field: keyof InquirySalesPricing["lines"][number],
    rawValue: string,
  ) => {
    if (!editDetails || !selectedInquiry || !procurementRequest) return;
    pricingDirtyRef.current = true;
    const baseFromProcurement =
      procurementRequest.line_items[index]?.base_price_per_mt;
    const existing = inquiryPricing?.lines[index] || {
      basePricePerMt: baseFromProcurement ?? "",
      transportPerMt: "",
      loadingPerMt: "",
      creditPerMt: "",
      marginPerMt: "",
    };
    const value = rawValue === "" ? "" : Math.max(0, Number(rawValue) || 0);
    const lines = [...(inquiryPricing?.lines || [])];
    lines[index] = { ...existing, [field]: value };
    const nextPricing = { lines, saved: inquiryPricing?.saved || false };
    setInquiryPricing(nextPricing);

    const line = lines[index];
    const rate = calculateLineRate({
      basePricePerMt: Number(line.basePricePerMt) || 0,
      transportPerMt: Number(line.transportPerMt) || 0,
      loadingPerMt: Number(line.loadingPerMt) || 0,
      creditPerMt: Number(line.creditPerMt) || 0,
      marginPerMt: Number(line.marginPerMt) || 0,
    });
    const currentItem = editDetails.lineItems[index];
    const amount = pricedLineAmount(rate, currentItem);
    const gst = getGstSplit(amount, editDetails.deliveryLocation);
    const updatedItems = [...editDetails.lineItems];
    updatedItems[index] = {
      ...currentItem,
      rate,
      amount,
      base_price_per_mt: line.basePricePerMt,
      transport_per_mt: line.transportPerMt,
      loading_per_mt: line.loadingPerMt,
      credit_per_mt: line.creditPerMt,
      margin_per_mt: line.marginPerMt,
      cgst_amount: gst.cgst,
      sgst_amount: gst.sgst,
      igst_amount: gst.igst,
      total_gst: gst.total,
      final_amount: amount + gst.total,
    };
    setEditDetails({
      ...editDetails,
      lineItems: updatedItems,
      unitPrice: Number(updatedItems[0]?.rate) || 0,
      totalAmount: updatedItems.reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0,
      ),
    });
    setSaveSuccess(false);
  };

  const saveInquiryPrices = async () => {
    if (!selectedInquiry || !inquiryPricing || !procurementRequest || savingPrices) return;
    if (isProcurement && !canFillProcurementBasePrices(employee)) return;
    if (isProcurement && inquiryStatusFromServer(selectedInquiry) !== "awaiting_price") return;
    const lines = inquiryPricing.lines.map((line, index) => ({
      line_key:
        procurementRequest.line_items[index]?.line_key ||
        `${index}:${procurementRequest.line_items[index]?.sku_text || "line"}`,
      sku_text: procurementRequest.line_items[index]?.sku_text,
      quantity: procurementRequest.line_items[index]?.quantity,
      unit: procurementRequest.line_items[index]?.unit,
      base_price_per_mt: line.basePricePerMt === "" ? null : Number(line.basePricePerMt),
      line_note: procurementRequest.line_items[index]?.line_note || null,
      transport_per_mt: line.transportPerMt === "" ? 0 : Number(line.transportPerMt),
      loading_per_mt: line.loadingPerMt === "" ? 0 : Number(line.loadingPerMt),
      ...(isProcurement
        ? {}
        : {
            credit_per_mt:
              line.creditPerMt === "" ? 0 : Number(line.creditPerMt),
          }),
      margin_per_mt: line.marginPerMt === "" ? 0 : Number(line.marginPerMt),
    }));
    setSavingPrices(true);
    try {
      const response = isProcurement
        ? await inquiriesApi.saveProcurementPricing(selectedInquiry.id, { lines })
        : await inquiriesApi.saveSalesPricing(selectedInquiry.id, { lines });
      applyPricingResult(selectedInquiry, response);
      pricingDirtyRef.current = false;
      setExpandedRateIndex(null);
      if (isProcurement) {
        setSelectedInquiry((current) =>
          current && current.id === selectedInquiry.id
            ? { ...current, tonnage_review_open: false, tonnage_review: null }
            : current,
        );
        void fetchTonnageReviews();
      }
      toast.success("Prices saved");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Could not save prices",
      );
    } finally {
      setSavingPrices(false);
    }
  };

  const updateProcurementLineNote = (index: number, note: string) => {
    setProcurementRequest((current) => {
      if (!current) return current;
      return {
        ...current,
        line_items: current.line_items.map((line, lineIndex) =>
          lineIndex === index ? { ...line, line_note: note } : line,
        ),
      };
    });
  };

  const applyPricingResult = (inq: InquiryItem, response: any) => {
    const result = pricingResult(response);
    const pricingStatus = result.pricing_status || inq.pricing_status;
    const mapped = applyServerLines(
      { ...inq, pricing_status: pricingStatus },
      result.lines,
    );
    setSelectedInquiry((current) =>
      current && current.id === inq.id
        ? { ...current, pricing_status: pricingStatus }
        : current,
    );
    setProcurementRequest(mapped.request);
    setInquiryPricing(mapped.pricing);
    if (!result.lines.length) return;
    setEditDetails((current) => {
      if (!current?.lineItems?.length) return current;
      const lineItems = current.lineItems.map((item, index) => {
        const row = result.lines[index];
        const rate = Number(row?.rate_per_mt);
        if (!row || !rate) return item;
        const amount = pricedLineAmount(rate, item);
        const gst = getGstSplit(amount, current.deliveryLocation || "");
        return {
          ...item,
          rate,
          amount,
          cgst_amount: gst.cgst,
          sgst_amount: gst.sgst,
          igst_amount: gst.igst,
          total_gst: gst.total,
          final_amount: amount + gst.total,
        };
      });
      return {
        ...current,
        lineItems,
        totalAmount: lineItems.reduce(
          (sum, item) => sum + (Number(item.amount) || 0),
          0,
        ),
      };
    });
  };

  const copyPricingFieldToAll = (
    sourceIndex: number,
    field: "transportPerMt" | "loadingPerMt" | "creditPerMt" | "marginPerMt",
  ) => {
    if (!editDetails || !procurementRequest) return;
    const sourceValue = inquiryPricing?.lines[sourceIndex]?.[field] ?? "";
    const lines = editDetails.lineItems.map((_, index) => {
      const procurementBase =
        procurementRequest.line_items[index]?.base_price_per_mt ?? "";
      const current = inquiryPricing?.lines[index] || {
        basePricePerMt: procurementBase,
        transportPerMt: "",
        loadingPerMt: "",
        creditPerMt: "",
        marginPerMt: "",
      };
      return procurementRequest.line_items[index]?.line_status === "cannot_price"
        ? current
        : { ...current, [field]: sourceValue };
    });
    const updatedItems = editDetails.lineItems.map((item, index) => {
      const line = lines[index];
      const rate = calculateLineRate({
        basePricePerMt: Number(line.basePricePerMt) || 0,
        transportPerMt: Number(line.transportPerMt) || 0,
        loadingPerMt: Number(line.loadingPerMt) || 0,
        creditPerMt: Number(line.creditPerMt) || 0,
        marginPerMt: Number(line.marginPerMt) || 0,
      });
      const amount = pricedLineAmount(rate, item);
      const gst = getGstSplit(amount, editDetails.deliveryLocation);
      return {
        ...item,
        rate,
        amount,
        base_price_per_mt: line.basePricePerMt,
        transport_per_mt: line.transportPerMt,
        loading_per_mt: line.loadingPerMt,
        credit_per_mt: line.creditPerMt,
        margin_per_mt: line.marginPerMt,
        cgst_amount: gst.cgst,
        sgst_amount: gst.sgst,
        igst_amount: gst.igst,
        total_gst: gst.total,
        final_amount: amount + gst.total,
      };
    });
    setInquiryPricing({ lines, saved: inquiryPricing?.saved || false });
    setEditDetails({
      ...editDetails,
      lineItems: updatedItems,
      totalAmount: updatedItems.reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0,
      ),
    });
  };

  const currentInquiryPricingStatus = selectedInquiry
    ? inquiryStatusFromServer(selectedInquiry)
    : null;
  const procurementCanEditPrices =
    isProcurement &&
    canFillProcurementBasePrices(employee) &&
    currentInquiryPricingStatus === "awaiting_price";
  const procurementCanSendQuote = isProcurement && canSendProcurementQuote(employee);
  const isInquiryPricingSaved = inquiryPricing?.saved === true;
  const hasAvailableProcurementLine = Boolean(
    procurementRequest?.line_items.some(
      (line) => line.line_status === "priced",
    ),
  );
  const everyLineUnavailable = Boolean(
    procurementRequest?.line_items.length &&
      procurementRequest.line_items.every(
        (line) => line.line_status === "cannot_price",
      ),
  );
  const isInterstateDelivery =
    getGstSplit(0, editDetails?.deliveryLocation || "").type === "igst";
  const pricingLinesComplete = Boolean(
    editDetails?.lineItems?.length &&
      editDetails.lineItems.some(
        (_, index) =>
          procurementRequest?.line_items[index]?.line_status !== "cannot_price",
      ) &&
    editDetails.lineItems.every((_, index) => {
      if (
        procurementRequest?.line_items[index]?.line_status === "cannot_price"
      )
        return true;
      const line = inquiryPricing?.lines[index];
      const base =
        line?.basePricePerMt ??
        procurementRequest?.line_items[index]?.base_price_per_mt;
      return [
        base,
        line?.transportPerMt,
        line?.loadingPerMt,
        line?.marginPerMt,
      ].every((value) => value !== "" && value !== undefined && value !== null);
    }),
  );

  useEffect(() => {
    fetchMonthlyInquiries();
  }, [dateRange]);

  // Auto-open drawer if URL contains ?inquiryId=... or ?id=... or ?inquiry_id=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId =
      params.get("inquiryId") || params.get("id") || params.get("inquiry_id");
    const returnToParam = params.get("returnTo");
    if (!targetId || autoOpenedInquiryRef.current === targetId) return;

    const found = inquiries.find(
      (i) => String(i.id) === targetId || String(i.id).includes(targetId),
    );
    if (found) {
      autoOpenedInquiryRef.current = targetId;
      if (returnToParam) setDrawerReturnTo(returnToParam);
      handleOpenDrawer(found);
    } else if (inquiries.length > 0) {
      inquiriesApi
        .getOne(targetId)
        .then((res) => {
          const item = res?.data?.data || res?.data;
          if (item) {
            autoOpenedInquiryRef.current = targetId;
            if (returnToParam) setDrawerReturnTo(returnToParam);
            handleOpenDrawer(item);
          }
        })
        .catch((err) => {
          console.warn("Could not auto-open requested inquiry:", err);
          autoOpenedInquiryRef.current = targetId;
        });
    }
  }, [inquiries, location.search]);

  const executeSaveDrawerDetails = async (itemsToSave: LineItemDetail[]) => {
    if (!selectedInquiry || !editDetails) return;
    const procurementBlocked = ["confirmed", "won", "lost", "saved", "processed"].includes(
      (selectedInquiry.status || "").toLowerCase(),
    );
    if (isProcurement && procurementBlocked) {
      toast.error("Procurement roles cannot change a confirmed, won, or lost inquiry.");
      return;
    }
    try {
      setSubmitting(true);

      const baseAmt =
        itemsToSave.reduce((s, i) => s + (Number(i.amount) || 0), 0) ||
        editDetails.totalAmount ||
        0;
      const qBreakdown = calculateQuotationBreakdown(baseAmt, itemsToSave);

      const allMakes = Array.from(new Set(itemsToSave.map(i => i.brand || i.make).filter(Boolean)));
      const derivedPreferredMake = allMakes.join(', ');

      let summaryRequirement = '';
      if (itemsToSave.length > 0) {
        const itemStrs = itemsToSave.map(item => {
          const makeStr = (item.brand || item.make) ? ` [Make: ${item.brand || item.make}]` : '';
          return `${item.sku_text || 'Item'}${item.dimensions ? ` (${item.dimensions})` : ''}${makeStr}: ${item.quantity} ${item.unit || 'MT'} @ ₹${Number(item.rate) || 0}/${item.unit || 'MT'}`;
        });
        summaryRequirement = `${itemStrs.join(', ')}. Subtotal: ₹${qBreakdown.formattedSubtotal}, Grand Total: ${qBreakdown.formattedGrandTotal}. Delivery: ${editDetails.deliveryLocation}, Payment: ${editDetails.paymentTerms}`;
      } else {
        summaryRequirement = `${editDetails.productType} (${editDetails.productForm}), ${editDetails.quantityTons} MT @ ₹${(Number(editDetails.unitPrice) || 0).toLocaleString("en-IN")}/MT. Subtotal: ₹${qBreakdown.formattedSubtotal}, Grand Total: ${qBreakdown.formattedGrandTotal}. Delivery: ${editDetails.deliveryLocation}, Payment: ${editDetails.paymentTerms}`;
      }

      const mediaUrlsPayload = drawerFileBase64
        ? [drawerFileBase64]
        : selectedInquiry.media_urls || [];

      const payload = {
        ...editDetails,
        companyName: editDetails.companyName,
        customer_name: editDetails.companyName,
        customerPhone: editDetails.customerPhone,
        customer_phone: editDetails.customerPhone,
        customerEmail: (editDetails.customerEmail || "").trim(),
        customer_email: (editDetails.customerEmail || "").trim(),
        deliveryLocation: editDetails.deliveryLocation,
        delivery_location: editDetails.deliveryLocation,
        paymentTerms: editDetails.paymentTerms,
        payment_terms: editDetails.paymentTerms,
        preferred_make: derivedPreferredMake || (selectedInquiry?.ai_extraction_json as any)?.preferred_make || undefined,
        make: derivedPreferredMake || (selectedInquiry?.ai_extraction_json as any)?.make || undefined,
        lineItems: itemsToSave,
        line_items: itemsToSave,
        requirement: summaryRequirement,
        totalAmount: baseAmt,
        total_amount: baseAmt,
        subtotal: qBreakdown.subtotal,
        gstAmount: qBreakdown.CGST + qBreakdown.SGST,
        gst_amount: qBreakdown.CGST + qBreakdown.SGST,
        grandTotal: qBreakdown.grandTotal,
        grand_total: qBreakdown.grandTotal,
        media_urls: mediaUrlsPayload,
      };

      const nextStatus = isProcurement
        ? selectedInquiry.status || "review"
        : "confirmed";
      const response = await inquiriesApi.updateStatus(
        selectedInquiry.id,
        nextStatus,
        payload,
      );
      const body = response?.data;
      const saved = body?.id ? body : body?.data;
      const reviewOpened = Boolean(saved?.tonnage_review_open);
      const savedStatus = String(
        saved?.status ||
          (isProcurement ? selectedInquiry.status || "review" : "confirmed"),
      );
      const movedToQuote =
        !reviewOpened &&
        ["confirmed", "saved", "processed", "quoted", "quotation_sent"].includes(
          savedStatus.toLowerCase(),
        );

      const updatedObj: InquiryItem = {
        ...selectedInquiry,
        status: savedStatus,
        pricing_status: saved?.pricing_status ?? selectedInquiry.pricing_status,
        tonnage_review_open:
          saved?.tonnage_review_open ?? selectedInquiry.tonnage_review_open,
        tonnage_review: saved?.tonnage_review ?? selectedInquiry.tonnage_review,
        display_stage: movedToQuote ? "quoted" : selectedInquiry.display_stage,
        sender_name: editDetails.companyName,
        customer_name: editDetails.companyName,
        sender_phone: editDetails.customerPhone,
        customer_phone: editDetails.customerPhone,
        customer_email: (editDetails.customerEmail || "").trim(),
        raw_text: selectedInquiry.raw_text,
        media_urls: mediaUrlsPayload,
        ai_extraction_json: payload,
      };

      setSaveSuccess(true);
      setSelectedInquiry(updatedObj);
      setDrawerFileBase64(null);

      if (movedToQuote) {
        queryClient.setQueryData(["deals", effectivePhone], (old: any[] = []) =>
          old.map((d) =>
            d.inquiry_id === selectedInquiry.id ||
            (d.customer_name &&
              d.customer_name.toLowerCase().trim() ===
                editDetails.companyName?.toLowerCase().trim())
              ? { ...d, stage: "qualified" }
              : d,
          ),
        );
      }

      // Invalidate all related caches so Pipeline cards and KRA metrics update immediately
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["kra-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries-list"] });

      // Update in-memory inquiries list so item stays in list immediately
      setInquiries((prev) =>
        Array.isArray(prev)
          ? prev.map((item) =>
              item.id === selectedInquiry.id ? updatedObj : item,
            )
          : [],
      );
      toast.success("Inquiry saved successfully.");
    } catch (err: any) {
      console.error("Error saving inquiry details:", err);
      const errMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save inquiry changes.";
      toast.error(
        typeof errMsg === "string" ? errMsg : "Failed to save inquiry changes.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDrawerDetails = async () => {
    if (!guardAction('inquiries.edit')) return;
    if (!selectedInquiry || !editDetails) return;
    if (saveSuccess && !submitting) return; // Prevent re-saving if already in saved state without changes

    const errors: { [key: string]: string } = {};

    // 1. Company Name validation
    if (!editDetails.companyName || !editDetails.companyName.trim()) {
      errors["companyName"] = "Company Name is required.";
    }

    // 2. Line Items validation (Quantity > 0, Description required, HSN/SAC required)
    const rawItems =
      editDetails.lineItems && editDetails.lineItems.length > 0
        ? editDetails.lineItems
        : [
            {
              sku_text: editDetails.productType || "",
              dimensions: [
                editDetails.thickness,
                editDetails.width,
                editDetails.length,
              ]
                .filter(Boolean)
                .join(" x "),
              hsn_code: detectHsnCode(editDetails.productType || "") || "",
              quantity: editDetails.quantityTons || 0,
              unit: "MT",
              rate: editDetails.unitPrice || 0,
              amount: editDetails.totalAmount || 0,
            },
          ];

    // Filter out completely blank trailing rows added via '+' but left unfilled
    let currentItems = rawItems.filter((item) => {
      const hasSku = Boolean(item.sku_text && item.sku_text.trim());
      const hasDim = Boolean(item.dimensions && item.dimensions.trim());
      const hasQty = Number(item.quantity) > 0;
      const hasRate =
        item.rate !== "" &&
        item.rate !== null &&
        item.rate !== undefined &&
        Number(item.rate) > 0;
      return hasSku || hasDim || hasQty || hasRate;
    });

    if (currentItems.length === 0) {
      currentItems = rawItems;
    }

    if (currentItems.length === 0) {
      errors["lineItems"] = "Please add at least one line item.";
    }

    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];
      if (!item.sku_text || !item.sku_text.trim()) {
        errors[`sku_${i}`] = "Description is required.";
      }
      if (!item.dimensions || !item.dimensions.trim()) {
        errors[`dim_${i}`] = "Specification is required.";
      }
      if (!item.hsn_code || !item.hsn_code.trim()) {
        errors[`hsn_${i}`] = "HSN/SAC is required.";
      }
      if (
        item.quantity === null ||
        item.quantity === undefined ||
        Number(item.quantity) <= 0 ||
        isNaN(Number(item.quantity))
      ) {
        errors[`qty_${i}`] = "Quantity must be > 0.";
      }
    }

    // 3. Delivery Address validation
    if (!editDetails.deliveryLocation || !editDetails.deliveryLocation.trim()) {
      errors["deliveryLocation"] = "Delivery Address is required.";
    }

    // 4. Payment Terms validation
    if (!editDetails.paymentTerms || !editDetails.paymentTerms.trim()) {
      errors["paymentTerms"] = "Payment Terms is required.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaveSuccess(false);

      // Scroll to first invalid field
      setTimeout(() => {
        const firstErrEl = document.querySelector(".field-error-border");
        if (firstErrEl) {
          firstErrEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
      return;
    }

    setFieldErrors({});

    // Check if any product has rate set to 0 or left blank
    const unpricedItems = currentItems.filter((item) => {
      const r = item.rate;
      return (
        r === null ||
        r === undefined ||
        r === "" ||
        isNaN(Number(r)) ||
        Number(r) <= 0
      );
    });

    if (unpricedItems.length > 0) {
      setPendingSaveItems(currentItems);
      setShowZeroRateConfirmModal(true);
      return;
    }

    await executeSaveDrawerDetails(currentItems);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const requestId = uploadRequestRef.current + 1;
    uploadRequestRef.current = requestId;
    clearExtractedInquiryFields();
    setPoFileName(file.name);
    setIsExtractingPo(true);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64String = evt.target?.result as string;
        if (!base64String) {
          setIsExtractingPo(false);
          return;
        }

        const cleanBase64 = base64String.replace(/^data:[^;]+;base64,/, "");
        if (uploadRequestRef.current !== requestId) return;
        setPoFileBase64(base64String);

        let extracted: any = null;
        let extractError = "";

        // Process Document OCR via Backend Gemini Vision API Route (/inquiries/parse-document)
        try {
          const res = await inquiriesApi.parseDocument({
            file_base64: cleanBase64,
            mime_type: file.type || "image/jpeg",
          });
          const body = res.data;
          const candidate =
            body?.data?.customer_name ||
            body?.data?.line_items ||
            body?.data?.customer
              ? body.data
              : body?.customer_name || body?.line_items || body?.customer
                ? body
                : body?.data?.success === false
                  ? null
                  : body?.data;
          if (candidate && candidate.success !== false) {
            extracted = candidate;
          } else {
            extractError =
              body?.data?.error || body?.error || body?.message || "";
          }
        } catch (apiErr: any) {
          console.warn("Backend parse-document failed:", apiErr);
          extractError =
            apiErr?.response?.data?.message || apiErr?.message || "";
        }

        if (uploadRequestRef.current !== requestId) return;

        if (extracted) {
          formExtractedJsonRef.current = extracted;

          // Customer name: fill ONLY if explicitly present, keep blank if not
          const rawName =
            extracted.customer_name ||
            extracted.customerName ||
            extracted.company_name ||
            extracted.customer?.name ||
            "";
          const cleanCustomer =
            rawName && !isProductOrGenericName(String(rawName))
              ? String(rawName).trim()
              : "";
          setFormCustomerName(cleanCustomer);
          let filledFromDocument = Boolean(cleanCustomer);

          // Phone: fill if detected (10 digits), keep blank if not
          const rawPhone =
            extracted.customer_phone ||
            extracted.contact_phone ||
            extracted.customer?.phone ||
            extracted.phone ||
            "";
          const cleanPhone = String(rawPhone).replace(/\D/g, "").slice(-10);
          const validPhone =
            cleanPhone.length >= 10 && !SYSTEM_EMPLOYEE_PHONES.has(cleanPhone)
              ? cleanPhone
              : "";
          setFormPhone(validPhone);
          const extractedEmail = inquiryEmailFrom(
            extracted.customer_email,
            extracted.customerEmail,
            extracted.customer?.email,
            extracted.email,
          );
          setFormCustomerEmail(extractedEmail);
          if (extractedEmail) filledFromDocument = true;

          // Structured Line Items auto-fill
          const extractedLines = Array.isArray(extracted.line_items)
            ? extracted.line_items
            : Array.isArray(extracted.lineItems)
              ? extracted.lineItems
              : [];
          if (extractedLines.length > 0) {
            const mappedItems: LineItemDetail[] = extractedLines.map(
              (i: any) => {
                const skuText =
                  i.sku_text ||
                  i.sku ||
                  i.material ||
                  i.description ||
                  "Material";
                const dims =
                  i.dimensions ||
                  [i.thickness, i.width, i.length]
                    .filter(Boolean)
                    .join(" x ") ||
                  "";
                let q = Number(i.quantity ?? i.qty) || 0;
                let rawUnit = i.unit || "KG";
                const totalWt = Number(i.total_weight_kg ?? i.weight_kg ?? 0);

                if (
                  totalWt > 0 &&
                  (!i.unit ||
                    ["NOS", "NO", "PCS", "PC", "PIECES"].includes(
                      String(i.unit).toUpperCase(),
                    ) ||
                    (q > 0 && q < totalWt / 10))
                ) {
                  q = totalWt;
                  rawUnit = "KG";
                }

                const r = Number(i.rate ?? i.unit_price ?? i.price_per_mt) || 0;
                const amt = Number(i.amount) || 0;
                const detectedHsn = (
                  i.hsn_code ||
                  i.hsn ||
                  detectHsnCode(skuText, dims) ||
                  "72083840"
                ).trim();

                const calc = calculateLineItem({
                  sku_text: skuText,
                  dimensions: dims,
                  hsn_code: detectedHsn,
                  quantity: q,
                  unit: normalizeUnit(rawUnit) || "KG",
                  rate: r,
                  amount: amt,
                });

              const itemMake = String(
                i.preferred_make ||
                i.make ||
                i.brand ||
                extracted.preferred_make ||
                extracted.make ||
                extracted.brand ||
                ''
              ).trim();

              return {
                ...calc,
                sku_text: skuText,
                dimensions: dims,
                brand: itemMake,
                make: itemMake,
                hsn_code: detectedHsn,
                converted_mt: i.weight_mt !== undefined && i.weight_mt !== null ? i.weight_mt : calc.converted_mt,
              };
            });
            if (mappedItems.length > 0) {
              setFormLineItems(mappedItems);
              filledFromDocument = true;
            }
          } else if (extracted.sku_text || extracted.product_type) {
            const skuText =
              extracted.sku_text || extracted.product_type || "Material";
            const dims = extracted.dimensions || "";
            const detectedHsn = detectHsnCode(skuText, dims) || "72083840";
            let q = Number(extracted.quantity) || 0;
            let rawUnit = extracted.unit || "KG";
            const totalWt = Number(
              extracted.total_weight_kg ?? extracted.weight_kg ?? 0,
            );
            if (
              totalWt > 0 &&
              (!extracted.unit ||
                ["NOS", "NO", "PCS", "PC", "PIECES"].includes(
                  String(extracted.unit).toUpperCase(),
                ) ||
                (q > 0 && q < totalWt / 10))
            ) {
              q = totalWt;
              rawUnit = "KG";
            }
            const r = Number(extracted.rate) || 0;
            const singleMake = String(
              extracted.preferred_make ||
              extracted.make ||
              extracted.brand ||
              ''
            ).trim();
            const calc = calculateLineItem({
              sku_text: skuText,
              dimensions: dims,
              hsn_code: detectedHsn,
              quantity: q,
              unit: normalizeUnit(rawUnit) || "KG",
              rate: r,
              amount: 0,
            });
            setFormLineItems([{ ...calc, sku_text: skuText, dimensions: dims, brand: singleMake, make: singleMake, hsn_code: detectedHsn }]);
            filledFromDocument = true;
          }

          // Additional Notes: Only non-product notes, remarks, delivery timeline, contact details (never line items)
          const notesText = (
            extracted.additional_notes ||
            extracted.notes ||
            extracted.remarks ||
            ""
          ).trim();
          setFormRequirement(notesText);
          setFormInquiryType("Product Requirement (AI Document)");

          if (extracted.preferred_make || extracted.make || extracted.brand) {
            setFormPreferredMake(
              extracted.preferred_make || extracted.make || extracted.brand,
            );
          }
          if (extracted.payment_terms || extracted.paymentTerms) {
            setFormPaymentTerms(
              extracted.payment_terms || extracted.paymentTerms,
            );
          }
          const extractedDelivery =
            extracted.delivery_location ||
            extracted.deliveryLocation ||
            extracted.customer_address ||
            extracted.customer?.address ||
            "";
          if (extractedDelivery) {
            setFormDeliveryLocation(String(extractedDelivery).trim());
          }

          if (
            cleanCustomer ||
            extractedLines.length > 0 ||
            extracted.preferred_make ||
            extracted.payment_terms ||
            extractedDelivery
          ) {
            filledFromDocument = true;
          }

          if (filledFromDocument) {
            toast.success("Inquiry Document parsed! Details auto-filled.");
          } else {
            toast.error(
              extractError ||
                "Could not auto-extract inquiry details. You can enter the fields manually.",
            );
          }
        } else {
          toast.error(
            extractError ||
              "Could not auto-extract inquiry details. You can enter the fields manually.",
          );
        }

        if (uploadRequestRef.current === requestId) setIsExtractingPo(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error("FileReader error:", err);
      if (uploadRequestRef.current === requestId) setIsExtractingPo(false);
    }
  };

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardAction('inquiries.manage')) return;

    // Read directly from ref to avoid React state batching delays
    let extractedJson = formExtractedJsonRef.current;
    const customerName =
      formCustomerName.trim() && !isProductOrGenericName(formCustomerName)
        ? formCustomerName.trim()
        : (!isProductOrGenericName(extractedJson?.customer_name)
            ? extractedJson?.customer_name
            : "") || "";

    const rawCustomerPhone =
      formPhone.trim() ||
      extractedJson?.customer_phone ||
      extractedJson?.contact_phone ||
      extractedJson?.customer?.phone ||
      "";
    const cleanPhoneDigits = String(rawCustomerPhone)
      .replace(/\D/g, "")
      .slice(-10);
    const finalCustomerPhone =
      cleanPhoneDigits.length >= 10 &&
      !SYSTEM_EMPLOYEE_PHONES.has(cleanPhoneDigits)
        ? cleanPhoneDigits
        : "";

    if (!customerName) {
      toast.error("Please enter Company Name");
      const el = document.getElementById(
        "form-company-name",
      ) as HTMLInputElement;
      if (el) {
        el.focus();
        el.reportValidity();
      }
      return;
    }

    if (!isCustomerInAssignedList(customerName, rawCustomers)) {
      toast.error(
        "Cannot save inquiry: Customer is not in your assigned customer list.",
      );
      return;
    }

    if (formLineItems.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }

    for (let i = 0; i < formLineItems.length; i++) {
      const item = formLineItems[i];
      if (!item.sku_text.trim()) {
        const el = document.getElementById(
          `form-item-sku-${i}`,
        ) as HTMLInputElement;
        if (el) {
          el.focus();
          el.reportValidity();
        }
        return;
      }
      if (!item.dimensions?.trim()) {
        const el = document.getElementById(
          `form-item-spec-${i}`,
        ) as HTMLInputElement;
        if (el) {
          el.focus();
          el.reportValidity();
        }
        return;
      }
      if (!item.hsn_code || !item.hsn_code.trim()) {
        const el = document.getElementById(
          `form-item-hsn-${i}`,
        ) as HTMLInputElement;
        if (el) {
          el.focus();
          el.reportValidity();
        }
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        const el = document.getElementById(
          `form-item-qty-${i}`,
        ) as HTMLInputElement;
        if (el) {
          el.focus();
          el.reportValidity();
        }
        return;
      }
      if (nosMtMissing(item)) {
        toast.error(`Line ${i + 1}: ${NOS_MT_MISSING_MESSAGE}`);
        const el = document.getElementById(`form-item-spec-${i}`) as HTMLInputElement;
        if (el) el.focus();
        return;
      }
    }

    if (!formDeliveryLocation.trim()) {
      const el = document.getElementById(
        "form-delivery-location",
      ) as HTMLInputElement;
      if (el) {
        el.focus();
        el.reportValidity();
      }
      return;
    }

    if (!formPaymentTerms.trim()) {
      toast.error("Please select payment terms");
      const el = document.getElementById("form-payment-terms");
      if (el) {
        el.focus();
        if (typeof (el as any).reportValidity === "function") {
          (el as any).reportValidity();
        }
      }
      return;
    }

    const subtotal = formLineItems.reduce(
      (s, i) => s + (Number(i.amount) || 0),
      0,
    );
    const qBreakdown = calculateQuotationBreakdown(subtotal, formLineItems);
    const totalTonnage = calculateTotalTonnageMt(formLineItems);

    try {
      setSubmitting(true);

      const lineItemsPayload = formLineItems.map((i) => {
        const baseAmt =
          Number(i.amount) ||
          Math.round((Number(i.quantity) || 0) * (Number(i.rate) || 0));
        const cgstAmt =
          i.cgst_amount !== undefined
            ? Number(i.cgst_amount)
            : Math.round(baseAmt * 0.09 * 100) / 100;
        const sgstAmt =
          i.sgst_amount !== undefined
            ? Number(i.sgst_amount)
            : Math.round(baseAmt * 0.09 * 100) / 100;
        const totalGst = Math.round((cgstAmt + sgstAmt) * 100) / 100;
        const finalAmt =
          i.final_amount !== undefined && Number(i.final_amount) > 0
            ? Number(i.final_amount)
            : Math.round((baseAmt + totalGst) * 100) / 100;
        return {
          sku_text: i.sku_text.trim(),
          dimensions: i.dimensions ? i.dimensions.trim() : "",
          brand: (i.brand || i.make || "").trim(),
          make: (i.make || i.brand || "").trim(),
          hsn_code: i.hsn_code
            ? i.hsn_code.trim()
            : detectHsnCode(i.sku_text, i.dimensions) || "72083840",
          quantity: Number(i.quantity) || 0,
          unit: normalizeUnit(i.unit) || "MT",
          rate: Number(i.rate) || 0,
          amount: baseAmt,
          cgst_rate: 9,
          cgst_amount: cgstAmt,
          sgst_rate: 9,
          sgst_amount: sgstAmt,
          total_gst: totalGst,
          final_amount: finalAmt,
          converted_mt:
            i.converted_mt !== undefined &&
            i.converted_mt !== "" &&
            !isNaN(Number(i.converted_mt))
              ? Number(i.converted_mt)
              : undefined,
          is_manual_mt: i.is_manual_mt || undefined,
        };
      });

      const allCreatedMakes = Array.from(new Set(lineItemsPayload.map(i => i.brand || i.make).filter(Boolean)));
      const derivedPreferredMake = allCreatedMakes.join(', ') || formPreferredMake.trim();

      const aiExtractionJson: any = {
        ...(extractedJson || {}),
        customer: {
          name: customerName,
          phone: finalCustomerPhone,
          email: formCustomerEmail.trim() || null,
          gst: extractedJson?.customer_gst || null,
          address: formDeliveryLocation.trim() || null,
        },
        companyName: customerName,
        customer_name: customerName,
        customerPhone: finalCustomerPhone,
        customer_phone: finalCustomerPhone,
        customer_email: formCustomerEmail.trim(),
        customerEmail: formCustomerEmail.trim(),
        salespersonName: activeSalespersonName,
        productType: lineItemsPayload[0]?.sku_text || "",
        quantityTons:
          totalTonnage.totalMt || lineItemsPayload[0]?.quantity || 0,
        unitPrice: lineItemsPayload[0]?.rate || 0,
        total_amount: qBreakdown.grandTotal > 0 ? qBreakdown.grandTotal : 0,
        totalAmount: qBreakdown.grandTotal > 0 ? qBreakdown.grandTotal : 0,
        subtotal: qBreakdown.subtotal,
        cgst_amount: qBreakdown.CGST,
        sgst_amount: qBreakdown.SGST,
        rounding: qBreakdown.rounding,
        delivery_location: formDeliveryLocation.trim(),
        deliveryLocation: formDeliveryLocation.trim(),
        payment_terms: formPaymentTerms.trim(),
        paymentTerms: formPaymentTerms.trim(),
        preferred_make: derivedPreferredMake,
        make: derivedPreferredMake,
        line_items: lineItemsPayload,
        lineItems: lineItemsPayload,
        additional_notes: formRequirement.trim(),
        notes: formRequirement.trim(),
      };

      const itemStrs = lineItemsPayload.map((item, idx) => {
        const sku = item.sku_text || 'Item';
        const dims = item.dimensions ? ` (${item.dimensions})` : '';
        const makeStr = (item.brand || item.make) ? ` [Make: ${item.brand || item.make}]` : '';
        const qty = item.quantity ? ` - ${item.quantity} ${item.unit || 'MT'}` : '';
        const rate = Number(item.rate) > 0 ? ` @ ₹${item.rate}/${item.unit || 'MT'}` : '';
        return `${idx + 1}. ${sku}${dims}${makeStr}${qty}${rate}`.trim();
      }).filter(Boolean);

      const reqDetails = [
        itemStrs.length > 0 ? `Material:\n${itemStrs.join("\n")}` : "",
        derivedPreferredMake ? `Preferred Make: ${derivedPreferredMake}` : "",
        formDeliveryLocation.trim() ? `Delivery: ${formDeliveryLocation.trim()}` : "",
        formPaymentTerms.trim() ? `Payment Terms: ${formPaymentTerms.trim()}` : "",
        formRequirement.trim() ? `Notes: ${formRequirement.trim()}` : "",
      ].filter(Boolean).join("\n");
      const rawText = poFileName
        ? `[Inquiry Attachment: ${poFileName}]\n${reqDetails || "Inquiry"}`
        : reqDetails || "Inquiry";

      const createRes = await inquiriesApi.create({
        sender_name: customerName,
        customer_name: customerName,
        customer_phone: finalCustomerPhone,
        sender_phone: finalCustomerPhone,
        raw_text: rawText,
        inquiry_type: formInquiryType,
        status: "review",
        overall_confidence: 0.95,
        media_urls: poFileBase64 ? [poFileBase64] : [],
        ai_extraction_json: aiExtractionJson,
      });

      const newInquiry: InquiryItem = {
        id:
          createRes?.data?.id ||
          createRes?.data?.data?.id ||
          String(Date.now()),
        sender_name: customerName,
        customer_name: customerName,
        customer_phone: finalCustomerPhone,
        sender_phone: finalCustomerPhone,
        raw_text: rawText,
        inquiry_type: formInquiryType,
        status: "review",
        source_channel: "web_dashboard",
        overall_confidence: 0.95,
        media_urls: poFileBase64 ? [poFileBase64] : [],
        ai_extraction_json: aiExtractionJson,
        created_at: new Date().toISOString(),
      };

      toast.success("Inquiry logged successfully!");
      handleCancelCreateInquiry();

      // Prepend local inquiry so it appears immediately with full ai_extraction_json
      setInquiries((prev) => [
        newInquiry,
        ...(Array.isArray(prev) ? prev : []),
      ]);

      // Invalidate all related caches so Pipeline and Kanban reflect the new inquiry immediately
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["kra-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries-list"] });

      setTimeout(() => fetchMonthlyInquiries(), 2000);
    } catch (err: any) {
      console.error("Error logging inquiry:", err);
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to log inquiry. Please try again.";
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for 100% strictly monotonic descending sort by created_at with ISO timestamp parsing and secondary stable tie-breaker
  const parseSafeTime = (dateVal: any): number => {
    if (!dateVal) return 0;
    if (typeof dateVal === "number") return isNaN(dateVal) ? 0 : dateVal;
    const parsed = new Date(dateVal).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  const sortNewestFirst = <T extends { created_at?: any; id?: any }>(
    list: T[],
  ): T[] => {
    return [...list].sort((a, b) => {
      const timeA = parseSafeTime(a?.created_at);
      const timeB = parseSafeTime(b?.created_at);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      const idA = String(a?.id || "");
      const idB = String(b?.id || "");
      return idB.localeCompare(idA);
    });
  };

  // Single deterministic source of truth for active inquiries, always newest first
  const activeInquiryList = useMemo(() => {
    const serverList = Array.isArray(rawInquiries) ? rawInquiries : [];
    const localList = Array.isArray(inquiries) ? inquiries : [];

    const map = new Map<string, InquiryItem>();
    serverList.forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });
    localList.forEach((item) => {
      if (item?.id) {
        const existing = map.get(item.id);
        map.set(item.id, { ...existing, ...item });
      }
    });

    const combined = Array.from(map.values()).filter(isProductInquiry);
    return sortNewestFirst(combined);
  }, [rawInquiries, inquiries]);

  // Date range and search only. Status stays on the table and Kanban so the dropdown can still show every stage in the period.
  const periodInquiries = useMemo(() => {
    const list = activeInquiryList.filter((i) => {
      try {
        if (dateRange.from && dateRange.to) {
          const parseSafeIso = (dStr?: string) => {
            if (!dStr) return "";
            try {
              const trimmed = String(dStr).trim();
              if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
              const d = new Date(trimmed);
              if (isNaN(d.getTime())) return "";
              return d.toISOString().split("T")[0];
            } catch {
              return "";
            }
          };
          const inqDate = parseSafeIso(i?.created_at);
          if (inqDate) {
            const fromDate = dateRange.from.split("T")[0];
            const toDate = dateRange.to.split("T")[0];
            if (inqDate < fromDate || inqDate > toDate) return false;
          }
        }

        const text = i?.raw_text || "";
        const parsed = parseInquiryText(text, i);
        const name = (
          parsed.companyName ||
          i?.customer_name ||
          i?.sender_name ||
          ""
        ).toLowerCase();
        const phone = (
          parsed.customerPhone ||
          i?.sender_phone ||
          i?.customer_phone ||
          ""
        ).toLowerCase();
        const itemsSummary = (
          (parsed.lineItems || [])
            .map(
              (li: LineItemDetail) =>
                `${li.sku_text} ${li.dimensions || ""} ${li.quantity} ${li.unit || ""}`,
            )
            .join(" ") +
          " " +
          (parsed.productType || "")
        ).toLowerCase();

        const formattedDate = i?.created_at
          ? new Date(i.created_at).toLocaleString("en-IN").toLowerCase()
          : "";
        const dateOnly = i?.created_at
          ? new Date(i.created_at).toLocaleDateString("en-IN").toLowerCase()
          : "";
        const isoDate = (i?.created_at || "").toLowerCase();
        const linkedDealForSearch = getLinkedDeal(i, parsed.companyName);
        const dealIdStr = (
          linkedDealForSearch?.id
            ? `inq-${linkedDealForSearch.id.substring(0, 6)}`
            : i.id
              ? `inq-${i.id.substring(0, 6)}`
              : ""
        ).toLowerCase();
        const dealLegacyIdStr = (
          linkedDealForSearch?.id
            ? `deal-${linkedDealForSearch.id.substring(0, 6)}`
            : i.id
              ? `deal-${i.id.substring(0, 6)}`
              : ""
        ).toLowerCase();
        const altInqIdStr = (
          i.id ? `inq-${i.id.substring(0, 6)}` : ""
        ).toLowerCase();

        const s = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !s ||
          name.includes(s) ||
          dealIdStr.includes(s) ||
          dealLegacyIdStr.includes(s) ||
          altInqIdStr.includes(s) ||
          itemsSummary.includes(s) ||
          formattedDate.includes(s) ||
          dateOnly.includes(s) ||
          isoDate.includes(s) ||
          phone.includes(s) ||
          text.toLowerCase().includes(s) ||
          inquirySearchHaystack(i).includes(s);

        return matchesSearch;
      } catch {
        return true;
      }
    });

    return sortNewestFirst(list);
  }, [activeInquiryList, dateRange, searchTerm, rawDeals]);

  const stageCounts = useMemo(() => {
    const counts = {
      all: periodInquiries.length,
      awaiting_price: 0,
      price_ready: 0,
      unavailable: 0,
      new_inquiry: 0,
      quoted: 0,
      negotiation: 0,
      on_hold: 0,
      won: 0,
      lost: 0,
    };
    periodInquiries.forEach((inq) => {
      const stageKey = getInquiryDealStageKey(inq);
      const procStatus = inquiryStatusFromServer(inq);

      if (procStatus === "awaiting_price" || stageKey === "awaiting_price") {
        counts.awaiting_price++;
      }
      if (procStatus === "price_ready" || stageKey === "price_ready") {
        counts.price_ready++;
      }
      if (procStatus === "unavailable" || stageKey === "unavailable") {
        counts.unavailable++;
      }

      if (
        ["new_inquiry", "quoted", "negotiation", "on_hold", "won", "lost"].includes(
          stageKey,
        )
      ) {
        counts[
          stageKey as
            | "new_inquiry"
            | "quoted"
            | "negotiation"
            | "on_hold"
            | "won"
            | "lost"
        ]++;
      }
    });
    return counts;
  }, [periodInquiries, rawDeals]);

  const filtered = useMemo(() => {
    const list = activeInquiryList.filter((i) => {
      try {
        if (dateRange.from && dateRange.to) {
          const parseSafeIso = (dStr?: string) => {
            if (!dStr) return "";
            try {
              const trimmed = String(dStr).trim();
              if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
              const d = new Date(trimmed);
              if (isNaN(d.getTime())) return "";
              return d.toISOString().split("T")[0];
            } catch {
              return "";
            }
          };
          const inqDate = parseSafeIso(i?.created_at);
          if (inqDate) {
            const fromDate = dateRange.from.split("T")[0];
            const toDate = dateRange.to.split("T")[0];
            if (inqDate < fromDate || inqDate > toDate) return false;
          }
        }

        const text = i?.raw_text || "";
        const parsed = parseInquiryText(text, i);
        const name = (
          parsed.companyName ||
          i?.customer_name ||
          i?.sender_name ||
          ""
        ).toLowerCase();
        const phone = (
          parsed.customerPhone ||
          i?.sender_phone ||
          i?.customer_phone ||
          ""
        ).toLowerCase();
        const itemsSummary = (
          (parsed.lineItems || [])
            .map(
              (li: LineItemDetail) =>
                `${li.sku_text} ${li.dimensions || ""} ${li.quantity} ${li.unit || ""}`,
            )
            .join(" ") +
          " " +
          (parsed.productType || "")
        ).toLowerCase();

        const formattedDate = i?.created_at
          ? new Date(i.created_at).toLocaleString("en-IN").toLowerCase()
          : "";
        const dateOnly = i?.created_at
          ? new Date(i.created_at).toLocaleDateString("en-IN").toLowerCase()
          : "";
        const isoDate = (i?.created_at || "").toLowerCase();
        const linkedDealForSearch = getLinkedDeal(i, parsed.companyName);
        const dealIdStr = (
          linkedDealForSearch?.id
            ? `inq-${linkedDealForSearch.id.substring(0, 6)}`
            : i.id
              ? `inq-${i.id.substring(0, 6)}`
              : ""
        ).toLowerCase();
        const dealLegacyIdStr = (
          linkedDealForSearch?.id
            ? `deal-${linkedDealForSearch.id.substring(0, 6)}`
            : i.id
              ? `deal-${i.id.substring(0, 6)}`
              : ""
        ).toLowerCase();
        const altInqIdStr = (
          i.id ? `inq-${i.id.substring(0, 6)}` : ""
        ).toLowerCase();

        const s = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !s ||
          name.includes(s) ||
          dealIdStr.includes(s) ||
          dealLegacyIdStr.includes(s) ||
          altInqIdStr.includes(s) ||
          itemsSummary.includes(s) ||
          formattedDate.includes(s) ||
          dateOnly.includes(s) ||
          isoDate.includes(s) ||
          phone.includes(s) ||
          text.toLowerCase().includes(s) ||
          inquirySearchHaystack(i).includes(s);

        const dealStage = getInquiryDealStageKey(i);
        const procurementStatus = inquiryStatusFromServer(i);
        const matchesStatus =
          filterStatus === "all" ||
          dealStage === filterStatus ||
          procurementStatus === filterStatus;

        return matchesSearch && matchesStatus;
      } catch {
        return true;
      }
    });

    return sortNewestFirst(list);
  }, [activeInquiryList, dateRange, searchTerm, filterStatus, rawDeals]);

  const pipelineBoard = useMemo(() => {
    const board: Record<string, any[]> = {
      new_inquiry: [],
      quoted: [],
      negotiation: [],
      on_hold: [],
      won: [],
      lost: [],
    };

    filtered.forEach((inq) => {
      const parsed = parseInquiryText(inq.raw_text || "", inq);
      const stageKey = getInquiryDealStageKey(inq);

      if (board[stageKey]) {
        const linkedDeal = getLinkedDeal(inq, parsed.companyName);
        const aiJson = (inq.ai_extraction_json as any) || {};
        const lineItemsSrc = aiJson.line_items || aiJson.lineItems || [];

        let dealItems: any[] = [];
        if (linkedDeal?.deal_items && linkedDeal.deal_items.length > 0) {
          dealItems = linkedDeal.deal_items;
        } else if (lineItemsSrc.length > 0) {
          dealItems = lineItemsSrc.map((item: any) => ({
            sku_text:
              item.sku_text || item.description || item.product_name || "Item",
            dimensions: item.dimensions || "",
            quantity: Number(item.quantity || (item as any).qty || 0),
            unit: item.unit || "MT",
            rate: Number(item.rate || 0),
            amount: Number(
              item.amount ||
                Number(item.quantity || 0) * Number(item.rate || 0),
            ),
          }));
        } else if (parsed.lineItems && parsed.lineItems.length > 0) {
          dealItems = parsed.lineItems;
        }

        const totalAmt =
          Number(linkedDeal?.total_amount) ||
          Number(parsed.totalAmount) ||
          Number(aiJson.totalAmount) ||
          Number(aiJson.total_amount) ||
          0;

        const cleanInqId = inq.id ? inq.id.substring(0, 6).toUpperCase() : "";
        const dealNumber = cleanInqId
          ? `INQ-${cleanInqId}`
          : linkedDeal?.deal_number
            ? linkedDeal.deal_number.replace(/^#?(?:DEAL|INQ)-/i, "INQ-")
            : "INQ";

        board[stageKey].push({
          id: inq.id || linkedDeal?.id,
          inquiry_id: inq.id,
          deal_number: dealNumber,
          customer_name:
            linkedDeal?.customer_name ||
            parsed.companyName ||
            inq.customer_name ||
            inq.sender_name ||
            "Unknown Customer",
          customer_phone:
            linkedDeal?.customer_phone ||
            parsed.customerPhone ||
            inq.customer_phone ||
            inq.sender_phone ||
            "",
          stage: stageKey,
          inquiry_type: inq.inquiry_type,
          po_number: linkedDeal?.po_number || aiJson.po_number || "",
          lost_reason:
            linkedDeal?.lost_reason ||
            linkedDeal?.loss_reason ||
            aiJson.lost_reason ||
            (inq as any).lost_reason ||
            (inq as any).loss_reason ||
            "",
          loss_reason:
            linkedDeal?.lost_reason ||
            linkedDeal?.loss_reason ||
            aiJson.lost_reason ||
            (inq as any).lost_reason ||
            (inq as any).loss_reason ||
            "",
          deal_items: dealItems,
          total_amount: totalAmt,
          created_at: inq.created_at || linkedDeal?.created_at,
          rawInquiry: inq,
          details: parsed,
          linkedDeal: linkedDeal,
        });
      }
    });

    return board;
  }, [filtered, rawDeals]);

  const totalInquiriesCount = periodInquiries.length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filtered.length);
  const paginatedInquiries = filtered.slice(startIndex, endIndex);

  const handleViewInquiryDocument = async (inq: InquiryItem) => {
    if (drawerFileBase64) {
      setImageViewerUrl(drawerFileBase64);
      return;
    }

    const mediaUrl = inq.media_urls?.[0];
    if (
      mediaUrl &&
      (mediaUrl.startsWith("data:") || mediaUrl.startsWith("http"))
    ) {
      setImageViewerUrl(mediaUrl);
      return;
    }

    const isDocumentInquiry =
      inq.has_media ||
      inq.media_urls?.includes("attached_document") ||
      (inq.raw_text && inq.raw_text.trim().startsWith("[Inquiry Attachment:"));

    if (isDocumentInquiry) {
      try {
        setViewingDocLoading(true);
        const res = await inquiriesApi.getOne(inq.id);
        const fullInq = res?.data?.data || res?.data;
        const dbMedia = fullInq?.media_urls?.[0];
        if (
          dbMedia &&
          (dbMedia.startsWith("data:") || dbMedia.startsWith("http"))
        ) {
          setDrawerFileBase64(dbMedia);
          setImageViewerUrl(dbMedia);
          return;
        }
      } catch (e) {
        console.warn("Error fetching full inquiry doc:", e);
      } finally {
        setViewingDocLoading(false);
      }
    }

    // Only open text view if inquiry is genuinely a plain text inquiry
    setImageViewerUrl(`extracted_preview://${inq.id}`);
  };

  const openTonnageReview = async (review: TonnageReviewRow) => {
    const reviewFields = {
      tonnage_review_open: true,
      tonnage_review: {
        changed_at: review.changed_at,
        previous_total_mt: review.previous_total_mt,
        next_total_mt: review.next_total_mt,
        lines: review.lines || [],
      },
    };
    const found = inquiries.find((item) => item.id === review.id);
    if (found) {
      handleOpenDrawer({ ...found, ...reviewFields });
      return;
    }
    try {
      const res = await inquiriesApi.getOne(review.id);
      const item = res?.data?.data || res?.data;
      if (item) handleOpenDrawer({ ...item, ...reviewFields });
    } catch (error) {
      console.warn("Could not open tonnage review:", error);
      toast.error("Could not open that inquiry.");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] space-y-4 animate-fade-in font-sans">
      {/* Frozen Upper Section (Header, KPI Summary Cards, Filters, Search) */}
      <div className="shrink-0 space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="text-blue-600" size={28} />
              {viewMode === "pipeline"
                ? "Sales Pipeline"
                : "Inquiries & Quotations Management"}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {!isProcurement && (
              <button
                type="button"
                disabled={isSyncingZoho}
                onClick={handleTriggerZohoSync}
                className="h-9 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw
                  size={14}
                  className={
                    isSyncingZoho
                      ? "animate-spin text-blue-600"
                      : "text-slate-500"
                  }
                />
                <span>
                  {isSyncingZoho ? "Syncing with Bigin..." : "Sync Bigin"}
                </span>
              </button>
            )}

            {isProcurement && (
            <div className="relative shrink-0 w-9">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Tonnage updates"
                      title="Tonnage updates"
                      className="relative h-9 w-9 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-2xs flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <Bell size={15} />
                      {tonnageReviews.length > 0 && (
                        <span
                          aria-label={`${tonnageReviews.length} open tonnage ${tonnageReviews.length === 1 ? "update" : "updates"}`}
                          className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-4 text-center"
                        >
                          {tonnageReviews.length}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="!top-full !bottom-auto !mt-2 !mb-0 w-[22rem] max-h-96 !overflow-y-auto p-0"
                  >
                    <div className="border-b border-slate-100 px-3 py-2.5">
                      <p className="text-sm font-bold text-slate-900">
                        Tonnage updates
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Price Ready inquiries whose weight changed
                      </p>
                    </div>
                    {tonnageReviewsLoading ? (
                      <p className="px-3 py-4 text-xs text-slate-500">
                        Loading tonnage updates
                      </p>
                    ) : tonnageReviewsError ? (
                      <p className="px-3 py-4 text-xs text-red-600">
                        Could not load tonnage updates
                      </p>
                    ) : tonnageReviews.length === 0 ? (
                      <p className="px-3 py-4 text-xs text-slate-500">
                        No tonnage updates
                      </p>
                    ) : (
                      <div className="py-1">
                        {tonnageReviews.map((review) => {
                          const when = formatTonnageWhen(review.changed_at);
                          const products = (review.lines || [])
                            .map((line) => line.sku_text)
                            .filter(Boolean)
                            .join(", ");
                          return (
                            <DropdownMenuItem
                              key={review.id}
                              onClick={() => openTonnageReview(review)}
                              className="h-auto flex-col items-start whitespace-normal rounded-none px-3 py-2.5"
                            >
                              <span className="block text-sm font-bold text-slate-900">
                                {review.procurement_number || "Inquiry"}
                              </span>
                              <span className="block text-xs font-medium text-slate-500">
                                {review.salesperson_name || "Salesperson"}
                                {when ? ` · ${when}` : ""}
                              </span>
                              <span className="mt-1 block text-xs font-semibold text-amber-800">
                                {formatTonnageMt(review.previous_total_mt)} →{" "}
                                {formatTonnageMt(review.next_total_mt)}
                              </span>
                              {products && (
                                <span className="mt-0.5 block text-xs font-medium text-slate-600">
                                  {products}
                                </span>
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
            )}

            <button
              type="button"
              disabled={dealsFetching || isFetching}
              onClick={async () => {
                await Promise.all([
                  fetchMonthlyInquiries(),
                  fetchDeals(),
                  isProcurement ? fetchTonnageReviews() : Promise.resolve(),
                ]);
                toast.success(
                  viewMode === "pipeline"
                    ? "Pipeline refreshed"
                    : "Inquiries list refreshed",
                );
              }}
              title={
                viewMode === "pipeline"
                  ? "Refresh Pipeline"
                  : "Refresh Inquiries"
              }
              className="h-9 w-9 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-2xs flex items-center justify-center cursor-pointer disabled:opacity-60 shrink-0"
            >
              <RefreshCw
                size={15}
                className={
                  dealsFetching || isFetching
                    ? "animate-spin text-blue-600"
                    : ""
                }
              />
            </button>

            {!isProcurement && (
              <>
                <button
                  onClick={() => navigate("/orders")}
                  className="h-9 flex items-center gap-1.5 px-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0"
                >
                  <ShoppingBag size={14} className="text-emerald-600" /> View
                  Confirmed Orders
                </button>

                {can('inquiries.manage') && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="h-9 flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                  >
                    <Plus size={15} /> Log New Inquiry
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* KPI / Summary Card: Total Inquiries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">
                Total Inquiries
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {totalInquiriesCount}
              </p>
            </div>
            <div className="p-3 bg-slate-100 text-slate-900 rounded-lg">
              <FileText size={22} />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar - Compact Single Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* 1. Compact Search Bar with Clear (X) Icon */}
            <div className="relative w-full sm:w-64">
              <Search
                className="absolute left-3 top-2.5 text-slate-400"
                size={15}
              />
              <input
                type="text"
                placeholder={
                  isProcurement
                    ? "Search procurement id, salesperson, product..."
                    : "Search Customer, Items, Date..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  title="Clear Search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* 2. Days Filter Dropdown */}
            <Select
              value={dayPreset}
              onChange={(e) => handleDayPresetChange(e.target.value)}
              prefixIcon={<Calendar size={14} className="text-blue-600" />}
              wrapperClassName="w-full sm:w-auto inline-flex"
              className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
              menuClassName="w-44"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7_days">Last 7 Days</option>
              <option value="30_days">Last 30 Days</option>
              <option value="90_days">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </Select>

            {/* 3. Status Dropdown */}
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              wrapperClassName="w-full sm:w-auto inline-flex"
              className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
              menuClassName="w-56"
            >
              <option value="all">All ({stageCounts.all})</option>
              <option value="awaiting_price">
                Awaiting Price ({stageCounts.awaiting_price})
              </option>
              <option value="price_ready">
                Price Ready ({stageCounts.price_ready})
              </option>
              <option value="unavailable">
                Unavailable ({stageCounts.unavailable})
              </option>
              <option value="new_inquiry">
                New Inquiry ({stageCounts.new_inquiry})
              </option>
              <option value="quoted">
                Price Quote ({stageCounts.quoted})
              </option>
              <option value="negotiation">
                Negotiation ({stageCounts.negotiation})
              </option>
              <option value="on_hold">On Hold ({stageCounts.on_hold})</option>
              <option value="won">Won ({stageCounts.won})</option>
              <option value="lost">Lost ({stageCounts.lost})</option>
            </Select>

            {/* 4. Clear Filter Button */}
            {(searchTerm || filterStatus !== "all" || dayPreset !== "all") && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>

          {/* Custom Range Picker Inputs */}
          {showCustomDate && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-200 text-xs animate-in fade-in duration-150">
              <span className="text-slate-500 font-semibold">From:</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => handleCustomFromChange(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer"
              />
              <span className="text-slate-500 font-semibold">To:</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => handleCustomToChange(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer"
              />
            </div>
          )}

          {/* 5. Kanban View Button (Very Right in the Same Row) */}
          <div className="flex items-center ml-auto">
            <button
              type="button"
              onClick={() => {
                const nextMode = viewMode === "pipeline" ? "table" : "pipeline";
                setViewMode(nextMode);
                const params = new URLSearchParams(window.location.search);
                if (nextMode === "pipeline") {
                  params.set("view", "pipeline");
                } else {
                  params.delete("view");
                }
                navigate({ search: params.toString() }, { replace: true });
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer border ${
                viewMode === "pipeline"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
              }`}
              title={
                viewMode === "pipeline"
                  ? "Switch to Inquiries Listing"
                  : "Open Kanban View"
              }
            >
              <LayoutDashboard
                size={14}
                className={
                  viewMode === "pipeline" ? "text-white" : "text-blue-600"
                }
              />
              <span>Kanban View</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === "pipeline" ? (
        /* Kanban Board View */
        <div className="flex-1 min-h-0 overflow-auto pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 min-w-[1360px] 2xl:min-w-0">
            {DEFAULT_PIPELINE_STAGES.map(({ key, label, color }) => (
              <div
                key={key}
                className={`rounded-xl border-2 ${color} p-3 flex flex-col min-w-[210px]`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-700 text-sm">
                    {label}
                  </h3>
                  <span className="bg-white text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full border">
                    {pipelineBoard[key]?.length || 0}
                  </span>
                </div>
                <div className="space-y-2 flex-1">
                  {(pipelineBoard[key] || []).map((deal: any) => (
                    <DealCard
                      key={deal.inquiry_id || deal.id}
                      deal={deal}
                      onClick={() =>
                        deal.rawInquiry && handleOpenDrawer(deal.rawInquiry)
                      }
                      onStageChange={(id, stage, cardDeal) =>
                        handlePipelineStageChange(id, stage, cardDeal || deal)
                      }
                      onDelete={(d) => {
                        if (!guardAction('inquiries.delete')) return;
                        setConfirmDeleteDeal(d);
                      }}
                      canDelete={can('inquiries.delete')}
                    />
                  ))}
                  {(!pipelineBoard[key] || pipelineBoard[key].length === 0) && (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      No deals
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Standard Inquiries Table View */
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          <div
            className={`flex-1 min-h-0 overflow-auto ${!loading && filtered.length === 0 ? "flex flex-col" : ""}`}
          >
            <table className="w-full table-fixed text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider shadow-2xs">
                <tr>
                  <th className="px-3 py-3.5 text-center w-[4%]">Sr. No.</th>
                  <th className="px-5 py-3.5 text-left w-[22%]">Customer</th>
                  <th className="px-4 py-3.5 text-center w-[14%]">
                    Inquiry ID
                  </th>
                  <th className="px-4 py-3.5 text-center w-[18%]">
                    Items Summary
                  </th>
                  <th className="px-4 py-3.5 text-center w-[14%]">
                    Source Channel
                  </th>
                  <th className="px-4 py-3.5 text-center w-[16%]">
                    Inquiry Status
                  </th>
                  <th className="px-4 py-3.5 text-center w-[12%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      Loading monthly inquiries...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? null : (
                  paginatedInquiries.map((inq, idx) => {
                    const globalIdx = startIndex + idx + 1;
                    const details = (() => {
                      const parsed = parseInquiryText(inq.raw_text || "", inq);
                      const ai = inq?.ai_extraction_json || {};
                      const lineItemsSrc = ai.line_items || ai.lineItems || [];
                      const activeSalesperson =
                        inq.salesperson_name ||
                        (inq as any).assigned_salesperson_name ||
                        (inq as any).salesperson ||
                        ai.salespersonName ||
                        ai.salesperson_name ||
                        ai.salesperson ||
                        parsed.salespersonName ||
                        viewingAs?.name ||
                        employee?.name ||
                        "Vedant Goel";

                      if (lineItemsSrc.length > 0) {
                        return {
                          ...parsed,
                          companyName:
                            inq.customer_name ||
                            ai.customer_name ||
                            ai.companyName ||
                            parsed.companyName,
                          customerPhone:
                            inq.customer_phone ||
                            ai.customer_phone ||
                            parsed.customerPhone,
                          salespersonName: activeSalesperson,
                          lineItems: lineItemsSrc.map((item: any) => {
                            const sText =
                              item.sku_text ||
                              item.sku ||
                              item.product_name ||
                              "";
                            const sDim = item.dimensions || "";
                            return {
                              sku_text: sText,
                              dimensions: sDim,
                              hsn_code:
                                (item.hsn_code && item.hsn_code.trim()) ||
                                detectHsnCode(sText, sDim) ||
                                "72083840",
                              quantity:
                                Number(
                                  item.original_quantity ??
                                    item.quantity ??
                                    item.qty,
                                ) || 0,
                              unit: item.original_unit || item.unit || "MT",
                              rate: Number(item.rate) || 0,
                              amount:
                                Number(item.amount) ||
                                Math.round(
                                  Number(item.quantity) * Number(item.rate),
                                ),
                            };
                          }),
                          totalAmount:
                            ai.totalAmount ||
                            ai.total_amount ||
                            lineItemsSrc.reduce(
                              (s: number, i: any) =>
                                s +
                                (Number(i.amount) ||
                                  Math.round(
                                    Number(i.quantity || 0) *
                                      Number(i.rate || 0),
                                  )),
                              0,
                            ),
                        };
                      }
                      return {
                        ...parsed,
                        salespersonName: activeSalesperson,
                      };
                    })();
                    const rowLineItems =
                      details.lineItems && details.lineItems.length > 0
                        ? details.lineItems
                        : [
                            {
                              sku_text: details.productType || "",
                              dimensions: [
                                details.thickness,
                                details.width,
                                details.length,
                              ]
                                .filter(Boolean)
                                .join(" x "),
                              quantity: details.quantityTons || 0,
                              unit: "MT",
                            },
                          ];
                    const rowTonnage = calculateTotalTonnageMt(rowLineItems);
                    const tonnageFormatted =
                      rowTonnage.totalMt > 0
                        ? `(${rowTonnage.totalMt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT)`
                        : "";
                    const itemCount =
                      details.lineItems && details.lineItems.length > 0
                        ? details.lineItems.length
                        : 1;
                    const dealStageKey = getInquiryDealStageKey(inq);
                    const dealStageInfo = getDealStageDisplay(dealStageKey);
                    const linkedDeal = getLinkedDeal(inq, details.companyName);
                    const inquiryProcurementStatus = inquiryStatusFromServer(inq);
                    const inquiryCode = inq.id
                      ? `INQ-${inq.id.substring(0, 6).toUpperCase()}`
                      : linkedDeal?.id
                        ? `INQ-${linkedDeal.id.substring(0, 6).toUpperCase()}`
                        : "-";
                    const procurementCode = inq.procurement_number || "";

                    const showUpdateStatus =
                      !isProcurement &&
                      (dealStageKey === "qualified" ||
                      dealStageKey === "quoted" ||
                      dealStageKey === "negotiation" ||
                      dealStageKey === "on_hold");
                    const showShareQuotation =
                      (!isProcurement || procurementCanSendQuote) &&
                      (dealStageKey === "qualified" || dealStageKey === "quoted");

                    return (
                      <tr
                        key={inq.id || idx}
                        onClick={() => handleOpenDrawer(inq)}
                        className="group hover:bg-slate-50/75 transition-colors cursor-pointer"
                      >
                        <td data-label="Sr. No." className="px-3 py-3.5 font-medium text-slate-500 text-center">
                          {globalIdx}
                        </td>
                        <td data-label="Customer" className="px-5 py-3.5 text-left">
                          <div className="font-bold text-slate-900 text-sm truncate">
                            <span className="group-hover:text-blue-600 transition-colors inline-block">
                              {details.companyName || (
                                <span className="text-slate-300 font-normal italic">
                                  -
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono">
                            {inq.created_at
                              ? new Date(inq.created_at).toLocaleString("en-IN")
                              : "-"}
                          </div>
                          {canViewSalesperson && details.salespersonName && (
                            <div className="text-xs text-slate-500 font-medium inline-flex items-center gap-1 mt-0.5 whitespace-nowrap">
                              <UserCheck
                                size={12}
                                className="text-slate-400 shrink-0"
                              />
                              Rep: {details.salespersonName}
                            </div>
                          )}
                          {(isProcurementManager || isAdmin) && (
                            <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                              {inq.procurement_employee_id
                                ? `Procurement: ${rawEmployees.find((item: any) => item.id === inq.procurement_employee_id)?.name || "Assigned"}`
                                : "Procurement: Unassigned"}
                            </div>
                          )}
                        </td>
                        <td data-label="Inquiry ID" className="px-4 py-3.5 text-xs text-slate-700 text-center font-medium whitespace-nowrap">
                          {procurementCode ? (
                            <div>
                              <div>{procurementCode}</div>
                              <div className="text-[10px] text-slate-400">{inquiryCode}</div>
                            </div>
                          ) : (
                            inquiryCode
                          )}
                        </td>
                        <td data-label="Items Summary" className="px-4 py-3.5 text-xs text-slate-700 text-center font-medium whitespace-nowrap">
                          {itemCount} {itemCount === 1 ? "Item" : "Items"}
                          {tonnageFormatted && (
                            <span className="text-slate-600 font-semibold ml-1.5">
                              {tonnageFormatted}
                            </span>
                          )}
                        </td>
                        <td data-label="Source Channel" className="px-4 py-3.5 text-center text-xs font-medium text-slate-700">
                          {formatSourceChannel(inq.source_channel)}
                        </td>
                        <td data-label="Inquiry Status" className="px-4 py-3.5 text-center whitespace-nowrap">
                          {inquiryProcurementStatus &&
                          inquiryProcurementStatus !== "pricing_saved" ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border ${inquiryPricingStatusClasses[inquiryProcurementStatus]}`}
                            >
                              {
                                inquiryPricingStatusLabel[
                                  inquiryProcurementStatus
                                ]
                              }
                            </span>
                          ) : dealStageInfo ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border ${dealStageInfo.className}`}
                            >
                              {dealStageInfo.label}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal italic">
                              -
                            </span>
                          )}
                        </td>
                        <td data-label="Actions" className="px-4 py-3.5 text-center whitespace-nowrap">
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId((prev) =>
                                  prev === inq.id ? null : inq.id,
                                );
                                setSubMenuInqId(null);
                              }}
                              className="p-1.5 rounded-lg border bg-white hover:bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300 shadow-2xs transition-all inline-flex items-center justify-center cursor-pointer"
                              title="Actions"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {openActionMenuId === inq.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute right-0 ${
                                  idx >= paginatedInquiries.length - 2 &&
                                  paginatedInquiries.length >= 3
                                    ? "bottom-full mb-1"
                                    : "top-full mt-1"
                                } w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-left`}
                              >
                                {/* 1. Update Status Button & Sub-Menu (Price Quote, Negotiation, or On Hold) */}
                                {showUpdateStatus && (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSubMenuInqId((prev) =>
                                          prev === inq.id ? null : inq.id,
                                        );
                                      }}
                                      className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-between transition-colors cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <RefreshCw
                                          size={14}
                                          className="text-blue-600 shrink-0"
                                        />
                                        <span>Update Status</span>
                                      </div>
                                      <ChevronRight
                                        size={14}
                                        className={`text-slate-400 transition-transform ${
                                          subMenuInqId === inq.id
                                            ? "rotate-90 text-blue-600"
                                            : ""
                                        }`}
                                      />
                                    </button>

                                    {subMenuInqId === inq.id && (
                                      <div className="bg-slate-50 border-y border-slate-200 py-1 px-1 space-y-0.5 animate-in fade-in duration-100">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleUpdateDealStage(
                                              inq,
                                              details,
                                              "won",
                                            );
                                          }}
                                          className="w-full px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100/60 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                          <span>Won</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleUpdateDealStage(
                                              inq,
                                              details,
                                              "lost",
                                            );
                                          }}
                                          className="w-full px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100/60 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                          <span>Lost</span>
                                        </button>
                                        {(dealStageKey === "quoted" ||
                                          dealStageKey === "qualified") && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateDealStage(
                                                  inq,
                                                  details,
                                                  "negotiation",
                                                );
                                              }}
                                              className="w-full px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100/60 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                                            >
                                              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                              <span>Negotiation</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateDealStage(
                                                  inq,
                                                  details,
                                                  "on_hold",
                                                );
                                              }}
                                              className="w-full px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100/60 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                                            >
                                              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                              <span>On Hold</span>
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* 2. View PDF (Always visible) */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenActionMenuId(null);
                                    setSubMenuInqId(null);
                                    setPdfModalInquiry(inq);
                                    setPdfModalDetails(details);
                                    setShowPdfModal(true);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <Eye
                                    size={14}
                                    className="text-slate-500 shrink-0"
                                  />
                                  <span>View PDF</span>
                                </button>

                                {/* 3. Share Quotation (Only Qualified, Quoted, Negotiation) */}
                                {showShareQuotation && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenActionMenuId(null);
                                      setSubMenuInqId(null);
                                      setShareInquiry(inq);
                                      setShareDetails(details);
                                      setQuotationEmail(quotationCustomerEmail(inq, details));
                                      setQuotationCcDraft("");
                                      setQuotationCcError("");
                                      setShowQuotationModal(true);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <Send
                                      size={14}
                                      className="text-blue-600 shrink-0"
                                    />
                                    <span>Share Quotation</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {!loading && filtered.length === 0 && (
              <div className="flex-1 flex items-center justify-center px-4 text-center text-xs text-slate-400">
                No product inquiries found for this period.
              </div>
            )}
          </div>

          {/* Pagination Bar */}
          {filtered.length > 0 && (
            <PaginationControl
              currentPage={validCurrentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              startIndex={filtered.length === 0 ? 0 : startIndex + 1}
              endIndex={endIndex}
              itemLabel="inquiries"
            />
          )}
        </div>
      )}

      {/* AI INTERPRETATION & QA AUDIT POPUP MODAL */}
      {showEditDrawer && selectedInquiry && editDetails && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 overscroll-contain animate-in fade-in duration-150"
          onClick={handleCloseDrawer}
        >
          <div
            className="mobile-sheet bg-white rounded-2xl max-w-7.5xl max-w-[102rem] w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden my-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header (Fixed Top) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-200">
                  <FileText size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    Inquiry &amp; Audit
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {(() => {
                      const inqIdDisplay = selectedInquiry.id
                        ? `INQ-${selectedInquiry.id.substring(0, 6).toUpperCase()}`
                        : "-";
                      const procurementId = selectedInquiry.procurement_number;
                      return procurementId
                        ? `Procurement ID: ${procurementId} · Inquiry ID: ${inqIdDisplay.replace(/^#/, "")}`
                        : `Inquiry ID: ${inqIdDisplay.replace(/^#/, "")}`;
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {(drawerReturnTo ||
                  new URLSearchParams(location.search).get("returnTo")) && (
                  <button
                    type="button"
                    onClick={() => {
                      const ret =
                        drawerReturnTo ||
                        new URLSearchParams(location.search).get("returnTo");
                      if (ret) navigate(ret);
                    }}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs border border-blue-200"
                  >
                    <ArrowLeft size={14} /> Back to Customer Profile
                  </button>
                )}

                <button
                  type="button"
                  disabled={viewingDocLoading}
                  onClick={() => handleViewInquiryDocument(selectedInquiry)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-300 shadow-2xs"
                >
                  {viewingDocLoading ? (
                    <Loader2 size={14} className="animate-spin text-blue-600" />
                  ) : (
                    <Eye size={14} className="text-slate-600" />
                  )}
                  <span>
                    {viewingDocLoading
                      ? "Loading Document..."
                      : "View Original Inquiry"}
                  </span>
                </button>

                {can('inquiries.delete') && !isProcurement && (
                  <button
                    type="button"
                    disabled={deleteInquiryMutation.isPending}
                    onClick={() => {
                      if (!guardAction('inquiries.delete')) return;
                      setConfirmDeleteInquiry(selectedInquiry);
                    }}
                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 text-rose-700 hover:text-rose-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-rose-200 shadow-2xs cursor-pointer"
                    title="Delete Inquiry"
                  >
                    <Trash2 size={14} className="text-rose-600" />
                    <span>Delete</span>
                  </button>
                )}

                <button
                  onClick={handleCloseDrawer}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 overscroll-contain">
              {/* Editable Fields Form */}
              <div className="space-y-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Company Name{" "}
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <div className="relative flex items-center">
                        <Building2
                          className="absolute left-3 text-slate-400 pointer-events-none"
                          size={15}
                        />
                        <input
                          type="text"
                          placeholder="Type or select company name..."
                          value={editDetails.companyName}
                          onChange={(e) => {
                            setEditDetails({
                              ...editDetails,
                              companyName: e.target.value,
                            });
                            setShowEditCompanyDropdown(true);
                            setSaveSuccess(false);
                            if (fieldErrors["companyName"]) {
                              setFieldErrors((prev) => {
                                const n = { ...prev };
                                delete n["companyName"];
                                return n;
                              });
                            }
                          }}
                          onFocus={() => setShowEditCompanyDropdown(true)}
                          className={`w-full pl-9 pr-8 py-2 bg-white rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 placeholder:text-slate-400 placeholder:font-normal transition-all ${
                            fieldErrors["companyName"]
                              ? "border-2 border-red-500 ring-2 ring-red-500/20 bg-red-50/20 field-error-border"
                              : "border border-slate-300 focus:ring-blue-500"
                          }`}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowEditCompanyDropdown((prev) => !prev);
                          }}
                          className="absolute right-2 text-slate-400 hover:text-slate-600 p-1"
                        >
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${showEditCompanyDropdown ? "rotate-180" : ""}`}
                          />
                        </button>
                      </div>

                      {showEditCompanyDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                          {existingCustomers
                            .filter(
                              (c) =>
                                !editDetails.companyName ||
                                c
                                  .toLowerCase()
                                  .includes(
                                    editDetails.companyName.toLowerCase(),
                                  ),
                            )
                            .map((cName) => (
                              <div
                                key={cName}
                                onMouseDown={() => {
                                  setEditDetails({
                                    ...editDetails,
                                    companyName: cName,
                                  });
                                  setShowEditCompanyDropdown(false);
                                  setSaveSuccess(false);
                                }}
                                className="px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center justify-between transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <Building2
                                    size={13}
                                    className="text-slate-400"
                                  />
                                  {cName}
                                </span>
                                {editDetails.companyName.toLowerCase() ===
                                  cName.toLowerCase() && (
                                  <CheckCircle
                                    size={13}
                                    className="text-blue-600"
                                  />
                                )}
                              </div>
                            ))}
                          {existingCustomers.filter(
                            (c) =>
                              !editDetails.companyName ||
                              c
                                .toLowerCase()
                                .includes(
                                  editDetails.companyName.toLowerCase(),
                                ),
                          ).length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-400 italic">
                              No matching company found. Typing will update
                              company name.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editDetails.customerEmail || ""}
                      onChange={(e) => {
                        setEditDetails({
                          ...editDetails,
                          customerEmail: e.target.value,
                        });
                        setSaveSuccess(false);
                      }}
                      placeholder="buyer@company.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Salesperson
                    </label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 shadow-2xs">
                      <User size={15} className="text-blue-600 shrink-0" />
                      <span className="truncate">
                        {editDetails.salespersonName ||
                          getSalespersonName(selectedInquiry)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Structured Inquiry Table Layout */}
                {currentInquiryPricingStatus && (
                  <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-600">
                      Procurement pricing
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${inquiryPricingStatusClasses[currentInquiryPricingStatus]}`}
                    >
                      {inquiryPricingStatusLabel[currentInquiryPricingStatus]}
                    </span>
                  </div>
                )}
                {isProcurement &&
                  selectedInquiry?.tonnage_review_open &&
                  selectedInquiry.tonnage_review && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
                      Tonnage changed from{" "}
                      {formatTonnageMt(
                        selectedInquiry.tonnage_review.previous_total_mt,
                      )}{" "}
                      to{" "}
                      {formatTonnageMt(
                        selectedInquiry.tonnage_review.next_total_mt,
                      )}
                      . Save a base price again, or leave a line blank to mark
                      it unavailable.
                      {(selectedInquiry.tonnage_review.lines || []).length >
                        0 && (
                        <ul className="mt-2 space-y-1">
                          {selectedInquiry.tonnage_review.lines?.map(
                            (line, index) => (
                              <li key={`${line.sku_text}-${index}`}>
                                {line.sku_text || "Material"}:{" "}
                                {formatTonnageMt(line.from_mt)} →{" "}
                                {formatTonnageMt(line.to_mt)}
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                <div className={`bg-white rounded-xl border border-slate-300 shadow-xs ${expandedRateIndex === null ? "overflow-x-auto" : "overflow-visible"}`}>
                  <table className="w-full min-w-[1280px] table-fixed text-left text-xs text-slate-800 border-collapse">
                    <thead className="bg-slate-800 text-white font-bold uppercase text-[11px] tracking-wider">
                      <tr>
                        <th
                          rowSpan={isInquiryPricingSaved ? 2 : 1}
                          className={`px-2 py-3 border-r border-slate-700 w-[3%] text-center align-middle ${isInquiryPricingSaved ? "" : "hidden"}`}
                        >
                          #
                        </th>
                        <th
                          rowSpan={2}
                          className={`px-4 py-3 border-r border-slate-700 align-middle ${isInquiryPricingSaved ? "w-[23%]" : "w-[16%]"}`}
                        >
                          Description &amp; Specifications{" "}
                          <span className="text-red-500 font-bold">*</span>
                        </th>
                        <th
                          rowSpan={2}
                          className="px-3 py-3 border-r border-slate-700 w-[8%] text-center align-middle"
                        >
                          HSN/SAC{" "}
                          <span className="text-red-500 font-bold">*</span>
                        </th>
                        <th
                          rowSpan={2}
                          className={`px-3 py-3 border-r border-slate-700 text-center align-middle ${isInquiryPricingSaved ? "w-[9%]" : "w-[10%]"}`}
                        >
                          Brand/Make
                        </th>
                        <th
                          rowSpan={isInquiryPricingSaved ? 2 : 1}
                          className={`px-2 py-3 border-r border-slate-700 text-center align-middle ${isInquiryPricingSaved ? "w-[12%]" : "w-[144px]"}`}
                        >
                          Quantity, Unit &amp; Wt (MT){" "}
                          <span className="text-red-500 font-bold">*</span>
                        </th>
                        {isInquiryPricingSaved ? (
                          <>
                            <th
                              rowSpan={2}
                              className="px-3 py-3 border-r border-slate-700 w-[10%] text-center align-middle"
                            >
                              Rate (₹)/ MT
                            </th>
                            <th
                              rowSpan={2}
                              className="min-w-[14rem] w-[18%] whitespace-nowrap px-2 py-3 border-r border-slate-700 text-center text-[10px] bg-slate-800/90 tracking-widest align-middle"
                            >
                              GST (18%)
                            </th>
                          </>
                        ) : isProcurement ? (
                          <th className="px-2 py-3 border-r border-slate-700 text-center">
                            Base Price *
                          </th>
                        ) : (
                          <>
                            <th className="px-2 py-3 border-r border-slate-700 text-center">
                              Base Price {" "}
                              <span className="text-red-500 font-bold">*</span>
                            </th>
                            <th className="px-2 py-3 border-r border-slate-700 text-center">
                              Transport {" "}
                              <span className="text-red-500 font-bold">*</span>
                            </th>
                            <th className="px-2 py-3 border-r border-slate-700 text-center">
                              Loading {" "}
                              <span className="text-red-500 font-bold">*</span>
                            </th>
                            <th className="px-2 py-3 border-r border-slate-700 text-center">
                              Credit {" "}
                              <span className="text-red-500 font-bold">*</span>
                            </th>
                            <th className="px-2 py-3 border-r border-slate-700 text-center">
                              Margin {" "}
                              <span className="text-red-500 font-bold">*</span>
                            </th>
                          </>
                        )}
                        <th
                          rowSpan={isInquiryPricingSaved ? 2 : 1}
                          className={`px-3 py-3 border-r border-slate-700 text-left min-w-[100px] align-middle ${isInquiryPricingSaved ? "w-[14%]" : "w-[13%]"}`}
                        >
                          Amount (₹) Rate/MT
                        </th>
                        <th
                          rowSpan={isInquiryPricingSaved ? 2 : 1}
                          className={`px-2 py-3 text-center w-[3%] align-middle ${isInquiryPricingSaved ? "" : "hidden"}`}
                        ></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {(editDetails.lineItems &&
                      editDetails.lineItems.length > 0
                        ? editDetails.lineItems
                        : [
                            {
                              sku_text: editDetails.productType || "",
                              dimensions: [
                                editDetails.thickness,
                                editDetails.width,
                                editDetails.length,
                              ]
                                .filter(Boolean)
                                .join(" x "),
                              hsn_code: editDetails.productType
                                ? detectHsnCode(
                                    editDetails.productType,
                                    [
                                      editDetails.thickness,
                                      editDetails.width,
                                      editDetails.length,
                                    ]
                                      .filter(Boolean)
                                      .join(" x "),
                                  ) || "72083840"
                                : "",
                              quantity: editDetails.quantityTons || 0,
                              unit: "MT",
                              rate: editDetails.unitPrice || 0,
                              amount: editDetails.totalAmount || 0,
                            },
                          ]
                      ).map((item, idx) => (
                        <tr key={idx} className={`hover:bg-blue-50/30 ${procurementRequest?.line_items[idx]?.line_status === "cannot_price" ? "bg-rose-50/40 opacity-70" : ""}`}>
                          <td
                            data-label="Sr. No."
                            className={`px-3 py-3.5 border-r border-slate-200 text-slate-400 font-mono text-center text-xs ${isInquiryPricingSaved ? "" : "hidden"}`}
                          >
                            {idx + 1}
                          </td>
                          <td data-label="Description" className="px-4 py-3.5 border-r border-slate-200">
                            <div className="space-y-1">
                              <input
                                type="text"
                                readOnly={isProcurement}
                                value={item.sku_text || ""}
                                onChange={(e) => {
                                  const newSku = e.target.value;
                                  const updated = [
                                    ...(editDetails.lineItems || []),
                                  ];
                                  const currentHsn =
                                    updated[idx]?.hsn_code || "";
                                  const prevAutoHsn = detectHsnCode(
                                    updated[idx]?.sku_text || "",
                                    item.dimensions,
                                  );
                                  const newAutoHsn = detectHsnCode(
                                    newSku,
                                    item.dimensions,
                                  );

                                  let finalHsn = currentHsn;
                                  if (!newSku.trim()) {
                                    finalHsn = "";
                                  } else if (
                                    !currentHsn ||
                                    currentHsn === prevAutoHsn
                                  ) {
                                    finalHsn = newAutoHsn || "72083840";
                                  }

                                  const currentItem = {
                                    ...updated[idx],
                                    sku_text: newSku,
                                    hsn_code: finalHsn,
                                  };
                                  const calc = calculateLineItem({
                                    ...currentItem,
                                    amount: 0,
                                  });
                                  updated[idx] = {
                                    ...currentItem,
                                    amount: calc.amount,
                                    cgst_rate: calc.cgst_rate,
                                    cgst_amount: calc.cgst_amount,
                                    sgst_rate: calc.sgst_rate,
                                    sgst_amount: calc.sgst_amount,
                                    total_gst: calc.total_gst,
                                    final_amount: calc.final_amount,
                                  };
                                  const totalAmt = updated.reduce(
                                    (s, i) => s + (i.amount || 0),
                                    0,
                                  );
                                  const totalTons =
                                    calculateTotalTonnageMt(updated).totalMt;
                                  setEditDetails({
                                    ...editDetails,
                                    lineItems: updated,
                                    totalAmount: totalAmt,
                                    quantityTons: totalTons,
                                  });
                                  setSaveSuccess(false);
                                  if (fieldErrors[`sku_${idx}`]) {
                                    setFieldErrors((prev) => {
                                      const n = { ...prev };
                                      delete n[`sku_${idx}`];
                                      return n;
                                    });
                                  }
                                  if (finalHsn && fieldErrors[`hsn_${idx}`]) {
                                    setFieldErrors((prev) => {
                                      const n = { ...prev };
                                      delete n[`hsn_${idx}`];
                                      return n;
                                    });
                                  }
                                }}
                                className={`w-full px-2 py-1 bg-white rounded font-bold text-xs outline-none focus:ring-2 text-slate-900 placeholder:text-slate-400 placeholder:font-normal transition-all ${
                                  fieldErrors[`sku_${idx}`]
                                    ? "border-2 border-red-500 ring-2 ring-red-500/20 bg-red-50/20 field-error-border"
                                    : "border border-slate-300 focus:ring-blue-500"
                                }`}
                                placeholder="Product Name / Description"
                              />
                              {fieldErrors[`sku_${idx}`] && (
                                <span className="text-[10px] text-red-600 font-bold block">
                                  {fieldErrors[`sku_${idx}`]}
                                </span>
                              )}
                              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                                <span className="font-semibold text-slate-400 shrink-0">
                                  Spec:
                                </span>
                                <input
                                  type="text"
                                  readOnly={isProcurement}
                                  value={item.dimensions || ""}
                                  onChange={(e) => {
                                    const newDim = e.target.value;
                                    const updated = [
                                      ...(editDetails.lineItems || []),
                                    ];
                                    const currentHsn =
                                      updated[idx]?.hsn_code || "";
                                    const prevAutoHsn = detectHsnCode(
                                      updated[idx]?.sku_text || "",
                                      updated[idx]?.dimensions,
                                    );
                                    const newAutoHsn = detectHsnCode(
                                      updated[idx]?.sku_text || "",
                                      newDim,
                                    );

                                    let finalHsn = currentHsn;
                                    if (
                                      !String(
                                        updated[idx]?.sku_text || "",
                                      ).trim()
                                    ) {
                                      finalHsn = "";
                                    } else if (
                                      !currentHsn ||
                                      currentHsn === prevAutoHsn
                                    ) {
                                      finalHsn = newAutoHsn || "72083840";
                                    }

                                    const currentItem = {
                                      ...updated[idx],
                                      dimensions: newDim,
                                      hsn_code: finalHsn,
                                    };
                                    const calc = calculateLineItem({
                                      ...currentItem,
                                      amount: 0,
                                    });
                                    updated[idx] = {
                                      ...currentItem,
                                      amount: calc.amount,
                                      cgst_rate: calc.cgst_rate,
                                      cgst_amount: calc.cgst_amount,
                                      sgst_rate: calc.sgst_rate,
                                      sgst_amount: calc.sgst_amount,
                                      total_gst: calc.total_gst,
                                      final_amount: calc.final_amount,
                                    };
                                    const totalAmt = updated.reduce(
                                      (s, i) => s + (i.amount || 0),
                                      0,
                                    );
                                    const totalTons =
                                      calculateTotalTonnageMt(updated).totalMt;
                                    setEditDetails({
                                      ...editDetails,
                                      lineItems: updated,
                                      totalAmount: totalAmt,
                                      quantityTons: totalTons,
                                    });
                                    setSaveSuccess(false);
                                    if (fieldErrors[`dim_${idx}`]) {
                                      setFieldErrors((prev) => {
                                        const n = { ...prev };
                                        delete n[`dim_${idx}`];
                                        return n;
                                      });
                                    }
                                    if (fieldErrors[`qty_${idx}`] === NOS_MT_MISSING_MESSAGE && !nosMtMissing(updated[idx])) {
                                      setFieldErrors(prev => { const n = { ...prev }; delete n[`qty_${idx}`]; return n; });
                                    }
                                    if (finalHsn && fieldErrors[`hsn_${idx}`]) {
                                      setFieldErrors((prev) => {
                                        const n = { ...prev };
                                        delete n[`hsn_${idx}`];
                                        return n;
                                      });
                                    }
                                  }}
                                  className={`w-full px-2 py-0.5 bg-white rounded text-[11px] font-mono outline-none focus:ring-1 text-slate-700 placeholder:text-slate-400 placeholder:font-normal transition-all ${
                                    fieldErrors[`dim_${idx}`]
                                      ? "border-2 border-red-500 ring-2 ring-red-500/20 bg-red-50/20 field-error-border"
                                      : "border border-slate-200 focus:ring-blue-500"
                                  }`}
                                  placeholder="e.g. 1mm or 2.50mm x 1250mm"
                                />
                              </div>
                              {fieldErrors[`dim_${idx}`] && (
                                <span className="text-[10px] text-red-600 font-bold block">
                                  {fieldErrors[`dim_${idx}`]}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-3.5 border-r border-slate-200 text-center font-mono">
                            <input
                              id={`edit-item-hsn-${idx}`}
                              type="text"
                              readOnly={isProcurement}
                              required
                              value={item.hsn_code || ""}
                              onChange={(e) => {
                                const updated = [
                                  ...(editDetails.lineItems || []),
                                ];
                                updated[idx] = {
                                  ...updated[idx],
                                  hsn_code: e.target.value,
                                };
                                setEditDetails({
                                  ...editDetails,
                                  lineItems: updated,
                                });
                                setSaveSuccess(false);
                                if (fieldErrors[`hsn_${idx}`]) {
                                  setFieldErrors((prev) => {
                                    const n = { ...prev };
                                    delete n[`hsn_${idx}`];
                                    return n;
                                  });
                                }
                              }}
                              placeholder="e.g. 72083730"
                              className={`w-full px-2 py-1.5 bg-white rounded font-bold text-xs font-mono text-center text-slate-900 outline-none focus:ring-2 placeholder:text-slate-400 placeholder:font-normal transition-all ${
                                fieldErrors[`hsn_${idx}`]
                                  ? "border-2 border-red-500 ring-2 ring-red-500/20 bg-red-50/20 field-error-border"
                                  : "border border-slate-300 focus:ring-blue-500"
                              }`}
                            />
                            {fieldErrors[`hsn_${idx}`] && (
                              <span className="text-[10px] text-red-600 font-bold block">
                                {fieldErrors[`hsn_${idx}`]}
                              </span>
                            )}
                          </td>
                          <td data-label="Brand/Make" className="px-2 py-3.5 border-r border-slate-200 text-center">
                            <Select
                              value={item.brand || item.make || ''}
                              onChange={(e) => {
                                const updated = [...(editDetails.lineItems || [])];
                                updated[idx] = { ...updated[idx], brand: e.target.value, make: e.target.value };
                                setEditDetails({ ...editDetails, lineItems: updated });
                                setSaveSuccess(false);
                              }}
                              wrapperClassName="w-full"
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium hover:border-blue-400"
                              placeholder="Select make"
                            >
                              <option value="">Select make</option>
                              {INQUIRY_PREFERRED_MAKES.map((make) => (
                                <option key={make} value={make}>{make}</option>
                              ))}
                              {(item.brand || item.make) && !INQUIRY_PREFERRED_MAKES.includes(item.brand || item.make || '') && (
                                <option value={item.brand || item.make}>{item.brand || item.make}</option>
                              )}
                            </Select>
                          </td>
                          <td data-label="Qty" className="w-[144px] max-w-[144px] px-1.5 py-2 border-r border-slate-200">
                            <div className="flex w-full flex-col gap-1">
                              <div
                                className={`flex overflow-hidden rounded bg-white ${
                                  fieldErrors[`qty_${idx}`]
                                    ? "border-2 border-red-500 ring-2 ring-red-500/20 bg-red-50/20"
                                    : "border border-slate-300 focus-within:ring-2 focus-within:ring-blue-500"
                                }`}
                              >
                              <input
                                type="number"
                                readOnly={isProcurement}
                                min="0"
                                value={item.quantity === 0 ? "" : item.quantity}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const rawQ = val === "" ? 0 : parseFloat(val);
                                  const safeQ =
                                    isNaN(rawQ) || rawQ < 0 ? 0 : rawQ;
                                  const updated = [
                                    ...(editDetails.lineItems || []),
                                  ];
                                  let currentItem = {
                                    ...updated[idx],
                                    quantity: safeQ,
                                  };
                                  if (
                                    normalizeUnit(currentItem.unit) === "MT"
                                  ) {
                                    currentItem.converted_mt = safeQ;
                                  }
                                  const calc = calculateLineItem({
                                    ...currentItem,
                                    amount: 0,
                                  });
                                  updated[idx] = {
                                    ...currentItem,
                                    amount: calc.amount,
                                    cgst_rate: calc.cgst_rate,
                                    cgst_amount: calc.cgst_amount,
                                    sgst_rate: calc.sgst_rate,
                                    sgst_amount: calc.sgst_amount,
                                    total_gst: calc.total_gst,
                                    final_amount: calc.final_amount,
                                  };
                                  const totalAmt = updated.reduce(
                                    (s, i) => s + (i.amount || 0),
                                    0,
                                  );
                                  const totalTons =
                                    calculateTotalTonnageMt(updated).totalMt;
                                  setEditDetails({
                                    ...editDetails,
                                    lineItems: updated,
                                    totalAmount: totalAmt,
                                    quantityTons: totalTons,
                                  });
                                  setSaveSuccess(false);
                                  if (fieldErrors[`qty_${idx}`]) {
                                    setFieldErrors((prev) => {
                                      const n = { ...prev };
                                      delete n[`qty_${idx}`];
                                      return n;
                                    });
                                  }
                                }}
                                placeholder="0"
                                className="w-[52px] min-w-0 shrink-0 border-0 bg-transparent px-1 py-1 text-center font-mono text-xs font-bold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <select
                                value={normalizeUnit(item.unit) || "KG"}
                                onChange={(e) => {
                                  const newUnit = e.target.value;
                                  const updated = [
                                    ...(editDetails.lineItems || []),
                                  ];
                                  let currentItem = {
                                    ...updated[idx],
                                    unit: newUnit,
                                  };
                                  delete currentItem.is_manual_mt;
                                  if (newUnit === "MT") {
                                    currentItem.converted_mt =
                                      currentItem.quantity;
                                  } else {
                                    delete currentItem.converted_mt;
                                  }
                                  const calc = calculateLineItem({
                                    ...currentItem,
                                    amount: 0,
                                  });
                                  updated[idx] = {
                                    ...currentItem,
                                    amount: calc.amount,
                                    cgst_rate: calc.cgst_rate,
                                    cgst_amount: calc.cgst_amount,
                                    sgst_rate: calc.sgst_rate,
                                    sgst_amount: calc.sgst_amount,
                                    total_gst: calc.total_gst,
                                    final_amount: calc.final_amount,
                                  };
                                  const totalAmt = updated.reduce(
                                    (s, i) => s + (i.amount || 0),
                                    0,
                                  );
                                  const totalTons =
                                    calculateTotalTonnageMt(updated).totalMt;
                                  setEditDetails({
                                    ...editDetails,
                                    lineItems: updated,
                                    totalAmount: totalAmt,
                                    quantityTons: totalTons,
                                  });
                                  setSaveSuccess(false);
                                  if (fieldErrors[`qty_${idx}`] === NOS_MT_MISSING_MESSAGE && !nosMtMissing(updated[idx])) {
                                    setFieldErrors(prev => { const n = { ...prev }; delete n[`qty_${idx}`]; return n; });
                                  }
                                }}
                                className="w-[48px] shrink-0 border-0 border-l border-slate-300 bg-slate-50 px-0.5 py-1 text-[10px] font-bold text-slate-700 outline-none"
                              >
                                <option value="KG">KG</option>
                                <option value="MT">MT</option>
                                <option value="Nos">Nos</option>
                                {["Pcs", "Sheets", "Plates", "Coils"].includes(
                                  normalizeUnit(item.unit) || "",
                                ) && (
                                  <option value={normalizeUnit(item.unit)}>
                                    {normalizeUnit(item.unit)}
                                  </option>
                                )}
                              </select>
                              </div>
                              {(() => {
                                const itemWeight = formatLineItemWeightMt(item);
                                const displayMt = displayedLineWeightMt(item);
                                const hasWeight = displayMt != null && displayMt > 0;

                                return (
                                  <div
                                    className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] ${
                                      hasWeight
                                        ? "bg-blue-50/80 text-blue-900"
                                        : "bg-slate-100 text-slate-400"
                                    }`}
                                    title="Weight in MT (Editable - Amount calculates as MT × Rate)"
                                  >
                                    <span className="shrink-0 font-semibold">
                                      Wt
                                    </span>
                                    <input
                                      type="number"
                                      readOnly={isProcurement}
                                      step="any"
                                      min="0"
                                      value={displayMt ?? ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updated = [
                                          ...(editDetails.lineItems || []),
                                        ];
                                        let currentItem = { ...updated[idx] };

                                        if (val === "") {
                                          delete currentItem.converted_mt;
                                          delete currentItem.is_manual_mt;
                                        } else {
                                          const rawMt = parseFloat(val);
                                          const safeMt =
                                            isNaN(rawMt) || rawMt < 0
                                              ? 0
                                              : rawMt;
                                          currentItem.converted_mt = val;
                                          currentItem.is_manual_mt = true;
                                          if (
                                            normalizeUnit(currentItem.unit) ===
                                            "MT"
                                          ) {
                                            currentItem.quantity = safeMt;
                                          }
                                        }

                                        const calc = calculateLineItem({
                                          ...currentItem,
                                          amount: 0,
                                        });
                                        updated[idx] = {
                                          ...currentItem,
                                          amount: calc.amount,
                                          cgst_rate: calc.cgst_rate,
                                          cgst_amount: calc.cgst_amount,
                                          sgst_rate: calc.sgst_rate,
                                          sgst_amount: calc.sgst_amount,
                                          total_gst: calc.total_gst,
                                          final_amount: calc.final_amount,
                                        };
                                        const totalAmt = updated.reduce(
                                          (s, i) => s + (i.amount || 0),
                                          0,
                                        );
                                        const totalTons =
                                          calculateTotalTonnageMt(
                                            updated,
                                          ).totalMt;
                                        setEditDetails({
                                          ...editDetails,
                                          lineItems: updated,
                                          totalAmount: totalAmt,
                                          quantityTons: totalTons,
                                        });
                                        setSaveSuccess(false);
                                        if (fieldErrors[`qty_${idx}`] === NOS_MT_MISSING_MESSAGE && !nosMtMissing(updated[idx])) {
                                          setFieldErrors(prev => { const n = { ...prev }; delete n[`qty_${idx}`]; return n; });
                                        }
                                      }}
                                      placeholder={
                                        itemWeight.canConvert && itemWeight.mt
                                          ? String(itemWeight.mt)
                                          : "0.000"
                                      }
                                      className="min-w-0 flex-1 bg-transparent text-center font-mono text-[10px] font-bold text-blue-900 outline-none placeholder:font-normal placeholder:text-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    />
                                    <span className="select-none font-mono font-bold text-blue-700/80">
                                      MT
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                            {fieldErrors[`qty_${idx}`] && (
                              <span className="text-[10px] text-red-600 font-bold block text-center mt-0.5">
                                {fieldErrors[`qty_${idx}`]}
                              </span>
                            )}
                          </td>
                          {isInquiryPricingSaved ? (
                            <>
                              <td className="relative px-2.5 py-3.5 border-r border-slate-200 font-bold font-mono min-w-[95px]">
                                <button
                                  type="button"
                                  disabled={procurementRequest?.line_items[idx]?.line_status === "cannot_price"}
                                  onClick={() =>
                                    setExpandedRateIndex(
                                      expandedRateIndex === idx ? null : idx,
                                    )
                                  }
                                  className="w-full rounded border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-left text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {formatIndianCurrency(
                                    shownLineRate(
                                      item,
                                      inquiryPricing?.lines[idx],
                                      procurementRequest?.line_items[idx]
                                        ?.base_price_per_mt,
                                    ),
                                    true,
                                  )}
                                </button>
                                {expandedRateIndex === idx && (
                                  <div className="absolute left-0 top-full z-30 mt-1 w-72 space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                                    {(
                                      [
                                        ["Base price", "basePricePerMt"],
                                        ["Transport", "transportPerMt"],
                                        ["Loading", "loadingPerMt"],
                                        ["Credit", "creditPerMt"],
                                        ["Margin", "marginPerMt"],
                                      ] as const
                                    ).map(([label, field]) => (
                                      <label
                                        key={field}
                                        className="flex items-center justify-between gap-3 whitespace-nowrap text-xs text-slate-600"
                                      >
                                        {label}
                                        <input
                                          type="number"
                                          min="0"
                                          readOnly={isProcurement && field !== "basePricePerMt"}
                                          value={
                                            inquiryPricing?.lines[idx]?.[
                                              field
                                            ] ??
                                            (field === "basePricePerMt"
                                              ? procurementRequest?.line_items[
                                                  idx
                                                ]?.base_price_per_mt
                                              : undefined) ??
                                            ""
                                          }
                                          onChange={(event) =>
                                            updateInquiryPricingLine(
                                              idx,
                                              field,
                                              event.target.value,
                                            )
                                          }
                                          className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-right font-mono text-xs"
                                        />
                                      </label>
                                    ))}
                                    {!isProcurement && (
                                      <button
                                        type="button"
                                        onClick={() => saveInquiryPrices()}
                                        className="w-full rounded bg-blue-600 px-2 py-1.5 text-xs font-bold text-white"
                                      >
                                        Update
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="min-w-[14rem] w-[18%] px-2 py-3.5 border-r border-slate-200 font-mono text-right">
                                {(() => {
                                  const split = getGstSplit(
                                    taxableLineAmount(
                                      item,
                                      shownLineRate(
                                        item,
                                        inquiryPricing?.lines[idx],
                                        procurementRequest?.line_items[idx]
                                          ?.base_price_per_mt,
                                      ),
                                    ),
                                    editDetails?.deliveryLocation || "",
                                  );
                                  const taxLine = (label: string, amount: number) => (
                                    <div className="flex w-full flex-nowrap items-center justify-between gap-2 text-[10px] text-slate-500">
                                      <span className="whitespace-nowrap shrink-0 tabular-nums">{label}</span>
                                      <span className="whitespace-nowrap shrink-0 tabular-nums font-bold text-slate-800">{formatIndianCurrency(amount, true)}</span>
                                    </div>
                                  );
                                  return isInterstateDelivery ? (
                                    taxLine("IGST 18%", split.igst)
                                  ) : (
                                    <div className="space-y-1">
                                      {taxLine("CGST 9%", split.cgst)}
                                      {taxLine("SGST 9%", split.sgst)}
                                    </div>
                                  );
                                })()}
                              </td>
                            </>
                          ) : (
                            <>
                              {(
                                [
                                  [
                                    "basePricePerMt",
                                    procurementRequest?.line_items[idx]
                                      ?.base_price_per_mt,
                                  ],
                                  ["transportPerMt", undefined],
                                  ["loadingPerMt", undefined],
                                  ["creditPerMt", undefined],
                                  ["marginPerMt", undefined],
                                ] as const
                              )
                                .filter(([field]) => !isProcurement || field === "basePricePerMt")
                                .map(([field, procurementBase]) => {
                                const current =
                                  inquiryPricing?.lines[idx]?.[field] ??
                                  procurementBase ??
                                  "";
                                const waiting =
                                  field === "basePricePerMt" &&
                                  procurementBase === undefined;
                                return (
                                  <td
                                    key={field}
                                    className="px-2 py-3.5 border-r border-slate-200 min-w-[82px]"
                                  >
                                    <input
                                      type="number"
                                      min="0"
                                      disabled={
                                        procurementRequest?.line_items[idx]?.line_status === "cannot_price" ||
                                        (isProcurement && !procurementCanEditPrices)
                                      }
                                      value={current}
                                      onChange={(event) =>
                                        updateInquiryPricingLine(
                                          idx,
                                          field,
                                          event.target.value,
                                        )
                                      }
                                      placeholder={
                                        procurementRequest?.line_items[idx]?.line_status === "cannot_price"
                                          ? "Unavailable"
                                          : waiting
                                          ? "Enter base price"
                                          : "₹ / MT"
                                      }
                                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-mono disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                    />
                                    {isProcurement &&
                                      field === "basePricePerMt" &&
                                      (current === "" ||
                                        procurementRequest?.line_items[idx]
                                          ?.line_status === "cannot_price") && (
                                        <input
                                          type="text"
                                          aria-label={`Note for ${procurementRequest?.line_items[idx]?.sku_text || "line"}`}
                                          disabled={!procurementCanEditPrices}
                                          value={
                                            procurementRequest?.line_items[idx]
                                              ?.line_note || ""
                                          }
                                          onChange={(event) =>
                                            updateProcurementLineNote(
                                              idx,
                                              event.target.value,
                                            )
                                          }
                                          placeholder="Optional note if unavailable"
                                          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-[10px] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                        />
                                      )}
                                    {field !== "basePricePerMt" && procurementRequest?.line_items[idx]?.line_status !== "cannot_price" && (
                                      <button
                                        type="button"
                                        onClick={() => copyPricingFieldToAll(idx, field)}
                                        className="mt-1 w-full text-[9px] font-bold text-blue-600 hover:text-blue-800"
                                      >
                                        Copy to all
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                            </>
                          )}
                          <td className="px-3 py-3.5 text-left font-bold text-slate-900 font-mono border-r border-slate-200 min-w-[100px]">
                            {(() => {
                              const draftLine = inquiryPricing?.lines[idx];
                              const draftRate = shownLineRate(
                                item,
                                draftLine,
                                procurementRequest?.line_items[idx]?.base_price_per_mt,
                              );
                              const taxableAmount = isInquiryPricingSaved
                                ? taxableLineAmount(item, draftRate)
                                : pricedLineAmount(draftRate, item);
                              const displayedAmount = taxableAmount;
                              return (
                                <div className="space-y-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-xs font-bold">
                                  {!isInquiryPricingSaved }
                                  <div>{formatIndianCurrency(displayedAmount, true)}</div>
                                </div>
                              );
                            })()}
                          </td>
                          <td
                            className={`px-2 py-3.5 text-center ${isInquiryPricingSaved ? "" : "hidden"}`}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {(editDetails.lineItems || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = (
                                      editDetails.lineItems || []
                                    ).filter((_, i) => i !== idx);
                                    const totalAmt = updated.reduce(
                                      (s, i) => s + (i.amount || 0),
                                      0,
                                    );
                                    const totalTons =
                                      calculateTotalTonnageMt(updated).totalMt;
                                    setEditDetails({
                                      ...editDetails,
                                      lineItems: updated,
                                      totalAmount: totalAmt,
                                      quantityTons: totalTons,
                                    });
                                    setSaveSuccess(false);
                                  }}
                                  className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                                  title="Remove line item"
                                >
                                  <Minus size={15} />
                                </button>
                              )}
                              {idx ===
                                (editDetails.lineItems &&
                                editDetails.lineItems.length > 0
                                  ? editDetails.lineItems.length - 1
                                  : 0) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current =
                                      editDetails.lineItems &&
                                      editDetails.lineItems.length > 0
                                        ? editDetails.lineItems
                                        : [
                                            {
                                              sku_text:
                                                editDetails.productType || "",
                                              dimensions: "",
                                              brand: "",
                                              make: "",
                                              hsn_code: "",
                                              quantity:
                                                editDetails.quantityTons || 0,
                                              unit: "MT",
                                              rate: editDetails.unitPrice || 0,
                                              amount:
                                                editDetails.totalAmount || 0,
                                            },
                                          ];
                                    const updated = [
                                      ...current,
                                      {
                                        sku_text: "",
                                        dimensions: "",
                                        brand: current[idx]?.brand || current[0]?.brand || "",
                                        make: current[idx]?.make || current[0]?.make || "",
                                        hsn_code: "",
                                        quantity: 0,
                                        unit: "MT",
                                        rate: 0,
                                        amount: 0,
                                        cgst_rate: 9,
                                        cgst_amount: 0,
                                        sgst_rate: 9,
                                        sgst_amount: 0,
                                        total_gst: 0,
                                        final_amount: 0,
                                      },
                                    ];
                                    setEditDetails({
                                      ...editDetails,
                                      lineItems: updated,
                                    });
                                    setSaveSuccess(false);
                                  }}
                                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center"
                                  title="Add line item"
                                >
                                  <Plus size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!isProcurement && !isInquiryPricingSaved && (
                    <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3">
                      <button
                        type="button"
                        disabled={
                          savingPrices ||
                          !pricingLinesComplete ||
                          currentInquiryPricingStatus === "unavailable"
                        }
                        onClick={saveInquiryPrices}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {savingPrices ? "Saving..." : "Save Prices"}
                      </button>
                    </div>
                  )}

                  {procurementRequest && (
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs">
                      <p className="font-semibold text-slate-700">
                        Procurement{" "}
                        <span className="ml-1 font-mono text-slate-900">
                          {procurementRequest.id}
                        </span>
                      </p>
                      {procurementRequest.request_note && (
                        <p className="mt-1 text-slate-600">
                          {procurementRequest.request_note}
                        </p>
                      )}
                      {procurementRequest.line_items
                        .filter((line) => line.line_status === "cannot_price")
                        .map((line) => (
                          <p
                            key={`${line.sku_text}-${line.dimensions}`}
                            className="mt-1 text-rose-700"
                          >
                            {line.sku_text}: Can&apos;t price —{" "}
                            {line.line_note || "Reason not provided"}
                          </p>
                        ))}
                    </div>
                  )}

                  {/* Standard Quotation Pricing Breakdown Layout (Matching Reference) */}
                  {(() => {
                    const activeLineItems =
                      editDetails.lineItems && editDetails.lineItems.length > 0
                        ? editDetails.lineItems.filter(
                            (_, index) =>
                              procurementRequest?.line_items[index]
                                ?.line_status !== "cannot_price",
                          )
                        : [
                            {
                              sku_text: editDetails.productType || "",
                              dimensions: [
                                editDetails.thickness,
                                editDetails.width,
                                editDetails.length,
                              ]
                                .filter(Boolean)
                                .join(" x "),
                              quantity: editDetails.quantityTons || 0,
                              unit: "MT",
                              rate: editDetails.unitPrice || 0,
                              amount: editDetails.totalAmount || 0,
                            },
                          ];

                    const amountFor = (item: any, index: number) => {
                      if (!isInquiryPricingSaved) return Number(item.amount) || 0;
                      return taxableLineAmount(
                        item,
                        shownLineRate(
                          item,
                          inquiryPricing?.lines[index],
                          procurementRequest?.line_items[index]?.base_price_per_mt,
                        ),
                      );
                    };
                    const subtotal = activeLineItems.reduce(
                      (sum, item, index) => {
                        const sourceIndex = (editDetails.lineItems || []).indexOf(item);
                        return sum + amountFor(item, sourceIndex >= 0 ? sourceIndex : index);
                      },
                      0,
                    );
                    const gstTotals = activeLineItems.reduce(
                      (totals, item, index) => {
                        const sourceIndex = (editDetails.lineItems || []).indexOf(item);
                        const split = getGstSplit(
                          amountFor(item, sourceIndex >= 0 ? sourceIndex : index),
                          editDetails.deliveryLocation,
                        );
                        return {
                          cgst: totals.cgst + split.cgst,
                          sgst: totals.sgst + split.sgst,
                          igst: totals.igst + split.igst,
                        };
                      },
                      { cgst: 0, sgst: 0, igst: 0 },
                    );
                    const gstTotal =
                      gstTotals.cgst + gstTotals.sgst + gstTotals.igst;
                    const grandTotal = subtotal + gstTotal;

                    const totalTonnage =
                      calculateTotalTonnageMt(activeLineItems);
                    const formattedItemsInTotal = totalTonnage.formattedText;
                    const quantityLabel = (
                      totalTonnage.summaryText || ""
                    ).replace(/, /g, " | ");
                    const estimateParts =
                      formattedItemsInTotal.split("Est. Total Weight:");
                    const weightLabel = formattedItemsInTotal.includes(
                      "Weight conversion unavailable",
                    )
                      ? "Weight conversion unavailable"
                      : estimateParts.length > 1
                        ? estimateParts[1].trim()
                        : formattedItemsInTotal;

                    return (
                      <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4">
                        <div className="pt-1 text-xs leading-snug text-slate-900">
                          <p>
                            <span className="font-bold">
                              Total Quantities:{" "}
                            </span>
                            <span className="font-mono font-bold">
                              {quantityLabel}
                            </span>
                          </p>
                          <p className="mt-1">
                            <span className="font-bold">
                              Est. Total Weight:{" "}
                            </span>
                            <span className="font-mono font-bold">
                              {weightLabel}
                            </span>
                          </p>
                        </div>

                        <div className="w-full sm:w-64 space-y-1 text-xs text-slate-700">
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-medium text-slate-600">
                              Sub Total
                            </span>
                            <span className="font-mono text-slate-900 font-medium">
                              {formatIndianCurrency(subtotal, true)}
                            </span>
                          </div>
                          {isInterstateDelivery ? (
                            <div className="flex justify-between items-center py-0.5">
                              <span className="font-medium text-slate-600">IGST (18%)</span>
                              <span className="font-mono text-slate-900 font-medium">{formatIndianCurrency(gstTotals.igst, true)}</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-center py-0.5">
                                <span className="font-medium text-slate-600">CGST (9%)</span>
                                <span className="font-mono text-slate-900 font-medium">{formatIndianCurrency(gstTotals.cgst, true)}</span>
                              </div>
                              <div className="flex justify-between items-center py-0.5">
                                <span className="font-medium text-slate-600">SGST (9%)</span>
                                <span className="font-mono text-slate-900 font-medium">{formatIndianCurrency(gstTotals.sgst, true)}</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t border-slate-300 font-black text-slate-950 text-sm">
                            <span className="font-bold">Total</span>
                            <span className="font-mono text-base font-black text-slate-950">
                              {formatIndianCurrency(grandTotal, true)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Commercial Terms Footer (Background Removed to match popup) */}
                  <div className="p-4 bg-transparent border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1 uppercase tracking-wider text-[10px]">
                        Delivery Address{" "}
                        <span className="text-red-500 font-bold">*</span>
                      </span>
                      <input
                        type="text"
                        value={editDetails.deliveryLocation}
                        onChange={(e) => {
                          setEditDetails({
                            ...editDetails,
                            deliveryLocation: e.target.value,
                          });
                          setSaveSuccess(false);
                          if (fieldErrors["deliveryLocation"]) {
                            setFieldErrors((prev) => {
                              const n = { ...prev };
                              delete n["deliveryLocation"];
                              return n;
                            });
                          }
                        }}
                        placeholder="e.g. Chakan Industrial Area, Pune"
                        className={`w-full px-3 py-2 bg-white rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 placeholder:text-slate-400 placeholder:font-normal transition-all ${
                          fieldErrors["deliveryLocation"]
                            ? "border-2 border-red-500 ring-2 ring-red-500/20 bg-red-50/20 field-error-border"
                            : "border border-slate-300 focus:ring-blue-500"
                        }`}
                      />
                      {fieldErrors["deliveryLocation"] && (
                        <span className="text-[11px] text-red-600 font-bold block mt-1">
                          {fieldErrors["deliveryLocation"]}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500 font-semibold block mb-1 uppercase tracking-wider text-[10px]">
                        Payment Terms{" "}
                        <span className="text-red-500 font-bold">*</span>
                      </span>
                      <input
                        type="text"
                        value={editDetails.paymentTerms}
                        onChange={(e) => {
                          setEditDetails({
                            ...editDetails,
                            paymentTerms: e.target.value,
                          });
                          setSaveSuccess(false);
                          if (fieldErrors["paymentTerms"]) {
                            setFieldErrors((prev) => {
                              const n = { ...prev };
                              delete n["paymentTerms"];
                              return n;
                            });
                          }
                        }}
                        placeholder="e.g. 30 Days Credit, 100% Advance"
                        className={`w-full px-3 py-2 bg-white rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 placeholder:text-slate-400 placeholder:font-normal transition-all ${
                          fieldErrors["paymentTerms"]
                            ? "border-2 border-red-500 ring-2 ring-red-500/20 bg-red-50/20 field-error-border"
                            : "border border-slate-300 focus:ring-blue-500"
                        }`}
                      />
                      {fieldErrors["paymentTerms"] && (
                        <span className="text-[11px] text-red-600 font-bold block mt-1">
                          {fieldErrors["paymentTerms"]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar (Solid White Pinned Footer) */}
            <div className="px-6 py-3.5 bg-white border-t border-slate-200 shrink-0 z-20 flex items-center justify-end gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
              {activeRole === "salesperson" && hasAvailableProcurementLine && can('inquiries.send_quote') && (
                <span className="relative group">
                  <button
                    type="button"
                    disabled={!isInquiryPricingSaved}
                    title={
                      quotationWasShared(selectedInquiry)
                        ? formatLastSharedLabel(
                            lastSharedById[selectedInquiry.id] ||
                              (selectedInquiry.ai_extraction_json as any)
                                ?.quotation_shared_at,
                          ) || undefined
                        : undefined
                    }
                    onClick={() => {
                      setShareInquiry(selectedInquiry);
                      setShareDetails(editDetails);
                      setQuotationEmail(quotationCustomerEmail(selectedInquiry, editDetails));
                      setQuotationCcDraft("");
                      setQuotationCcError("");
                      setShowQuotationModal(true);
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all disabled:cursor-not-allowed disabled:bg-slate-300 flex items-center gap-1.5"
                  >
                    {quotationWasShared(selectedInquiry) ? (
                      <>
                        <Check size={15} /> Share Again
                      </>
                    ) : (
                      <>
                        <Send size={15} /> Share Quotation
                      </>
                    )}
                  </button>
                </span>
              )}
              {activeRole === "salesperson" && everyLineUnavailable && (
                  <button
                    type="button"
                    onClick={() => {
                      const ai = (selectedInquiry.ai_extraction_json || {}) as any;
                      const customerEmail = inquiryEmailFrom(
                        (selectedInquiry as any).customer_email,
                        (selectedInquiry as any).sender_email,
                        ai.customer_email,
                        ai.customerEmail,
                        editDetails?.customerEmail,
                      );
                      setDeclineSent(false);
                      setDeclinePreviewError("");
                      setDeclineEmail(customerEmail);
                      setDeclineCcDraft("");
                      setDeclineCcError("");
                      setDeclineCc(
                        withSalespersonCc(
                          [...FIXED_QUOTATION_CC],
                          (viewingAs || employee)?.email || "",
                          customerEmail,
                        ),
                      );
                      setShowDeclinePreview(true);
                    }}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all"
                  >
                    Send Decline Email
                  </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPdfModalInquiry(selectedInquiry);
                  setPdfModalDetails(editDetails);
                  setShowPdfModal(true);
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <Eye size={15} /> View PDF
              </button>

              {procurementCanEditPrices && !isInquiryPricingSaved && (
                <button
                  type="button"
                  disabled={savingPrices || !procurementRequest?.line_items.length}
                  onClick={saveInquiryPrices}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {savingPrices ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Prices"
                  )}
                </button>
              )}

              {!isProcurement && (
              <button
                type="button"
                disabled={submitting || saveSuccess}
                onClick={handleSaveDrawerDetails}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
                  submitting
                    ? "bg-blue-600 opacity-80 cursor-wait"
                    : saveSuccess
                      ? "bg-emerald-600 hover:bg-emerald-600 cursor-default shadow-xs"
                      : "bg-blue-600 hover:bg-blue-700 active:scale-95"
                }`}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check size={15} /> Saved
                  </>
                ) : (
                  <>
                    <Save size={15} /> Save
                  </>
                )}
              </button>
              )}

              {(() => {
                const currentDrawerDealStage = selectedInquiry
                  ? getInquiryDealStageKey(selectedInquiry)
                  : "";
                const isQuotedDrawerStage =
                  currentDrawerDealStage === "quoted" ||
                  currentDrawerDealStage === "qualified";
                if (!selectedInquiry || !isQuotedDrawerStage) return null;
                if (isProcurement && !procurementCanSendQuote) return null;
                if (activeRole === "salesperson" && hasAvailableProcurementLine) return null;

                const shareAgain = quotationWasShared(selectedInquiry);
                const lastSharedLabel = shareAgain
                  ? formatLastSharedLabel(
                      lastSharedById[selectedInquiry.id] ||
                        (selectedInquiry.ai_extraction_json as any)
                          ?.quotation_shared_at,
                    )
                  : "";

                return (
                  <span className="relative group">
                    <button
                      type="button"
                      title={lastSharedLabel || undefined}
                      onClick={() => {
                        setShareInquiry(selectedInquiry);
                        setShareDetails(editDetails);
                        setQuotationEmail(quotationCustomerEmail(selectedInquiry, editDetails));
                        setQuotationCcDraft("");
                        setQuotationCcError("");
                        setShowQuotationModal(true);
                      }}
                      className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
                        shareAgain
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {shareAgain ? (
                        <>
                          <Check size={15} /> Share Again
                        </>
                      ) : (
                        <>
                          <Send size={15} /> Share Quotation
                        </>
                      )}
                    </button>
                    {lastSharedLabel && (
                      <span className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden group-hover:block whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg">
                        {lastSharedLabel}
                      </span>
                    )}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Inquiry Quotation PDF Preview Modal */}
      {showPdfModal && pdfModalDetails && pdfModalInquiry && (
        <InquiryPdfModal
          inquiry={pdfModalInquiry}
          details={pdfModalDetails}
          onClose={() => {
            setShowPdfModal(false);
            setPdfModalInquiry(null);
            setPdfModalDetails(null);
          }}
        />
      )}

      {/* FULL-SCREEN LIGHT MODE IMAGE / DOCUMENT / TEXT VIEWER */}
      {imageViewerUrl && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4"
          onClick={() => setImageViewerUrl(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                {imageViewerUrl.startsWith("extracted_preview://")
                  ? "Original Customer Inquiry Message"
                  : "Attached Customer Document / Inquiry File"}
              </span>
              <button
                onClick={() => setImageViewerUrl(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 flex items-center gap-1 text-xs font-bold transition-colors"
              >
                <X size={18} /> Close
              </button>
            </div>

            {imageViewerUrl.startsWith("extracted_preview://") ? (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Source Inquiry Text</span>
                  {selectedInquiry?.created_at && (
                    <span className="font-mono">
                      Received:{" "}
                      {new Date(selectedInquiry.created_at).toLocaleString(
                        "en-IN",
                      )}
                    </span>
                  )}
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-sm font-sans whitespace-pre-wrap leading-relaxed select-text min-h-[140px] max-h-[60vh] overflow-y-auto">
                  {selectedInquiry?.raw_text || "No inquiry text recorded."}
                </div>
              </div>
            ) : isPdf(imageViewerUrl) ? (
              <iframe
                src={imageViewerUrl}
                title="Inquiry PDF Document"
                className="w-full h-[70vh] rounded-xl bg-white shadow-inner border border-slate-200"
              />
            ) : (
              <div className="w-full h-[70vh] flex items-center justify-center bg-slate-50 rounded-xl p-2 overflow-auto border border-slate-200">
                <img
                  src={imageViewerUrl}
                  alt="Inquiry document full view"
                  className="max-w-full max-h-[68vh] object-contain rounded-lg shadow-md bg-white border border-slate-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const fallbackDiv = document.getElementById(
                      "image-fallback-card",
                    );
                    if (fallbackDiv) fallbackDiv.style.display = "flex";
                  }}
                />
              </div>
            )}

            {/* Fallback UI if media URL is raw WhatsApp ID or broken base64 */}
            <div
              id="image-fallback-card"
              style={{ display: "none" }}
              className="flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-3 max-w-md mx-auto my-4"
            >
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                <ImageIcon size={32} />
              </div>
              <div>
                <h3 className="text-slate-900 font-bold text-sm">
                  Customer Attached Document
                </h3>
                <p className="text-slate-600 text-xs mt-1">
                  Document content was parsed and extracted with Gemini AI into
                  the structured inquiry table.
                </p>
              </div>
            </div>

            {imageViewerUrl.startsWith("http") && (
              <div className="flex items-center justify-end mt-4 gap-2">
                <a
                  href={imageViewerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <ExternalLink size={14} /> Open Original Attachment
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 0 / Blank Rate Save Confirmation Modal */}
      {showZeroRateConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Save with 0 / Blank Rates
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  This inquiry contains products with 0/blank rates. Do you
                  still want to proceed?
                </p>
              </div>
            </div>

            {/* List the unpriced products */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 max-h-40 overflow-y-auto">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Products with 0 / Blank Rate:
              </span>
              {pendingSaveItems
                .filter(
                  (i) =>
                    i.rate === null ||
                    i.rate === undefined ||
                    i.rate === "" ||
                    isNaN(Number(i.rate)) ||
                    Number(i.rate) <= 0,
                )
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-0.5"
                  >
                    <span className="font-semibold text-slate-800 truncate mr-2">
                      {item.sku_text || "Item"}{" "}
                      {item.dimensions ? `(${item.dimensions})` : ""}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-amber-600 shrink-0 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Rate:{" "}
                      {item.rate === "" ||
                      item.rate === null ||
                      item.rate === undefined
                        ? "Blank"
                        : "₹0"}
                    </span>
                  </div>
                ))}
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Note: Products with 0 or blank rates will be saved with this
              inquiry but automatically excluded from the quotation PDF.
            </p>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowZeroRateConfirmModal(false);
                  setPendingSaveItems([]);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Review Rates
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowZeroRateConfirmModal(false);
                  await executeSaveDrawerDetails(pendingSaveItems);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Proceed &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeclinePreview && selectedInquiry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-decline-title"
            className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <h2 id="send-decline-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Send className="text-rose-600" size={22} />
                Send Decline Email
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowDeclinePreview(false);
                  setDeclineCcDraft("");
                  setDeclineCcError("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. customer@example.com"
                  value={declineEmail}
                  onChange={(event) => setDeclineEmail(event.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
                />
              </div>
              {declinePreviewLoading && (
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw size={13} className="animate-spin" /> Preparing email…
                </div>
              )}
              {declinePreviewError && (
                <div className="p-3 rounded-xl text-xs font-bold border bg-rose-50 text-rose-900 border-rose-200">
                  {declinePreviewError}
                </div>
              )}
              {declineSenderEmail && (
                <div className="text-[11px] text-slate-500">
                  From: <span className="font-semibold text-slate-700">{declineSenderEmail}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CC</label>
                <div
                  className="min-h-[42px] w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs flex flex-wrap items-center gap-1.5 bg-white"
                  onClick={(event) => event.currentTarget.querySelector("input")?.focus()}
                >
                  {declineCc.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700"
                    >
                      {email}
                      {!isFixedQuotationCc(email) && (
                        <button
                          type="button"
                          aria-label={`Remove ${email}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeclineCc((current) => current.filter((item) => item !== email));
                          }}
                          className="text-slate-400 hover:text-slate-700 rounded-full"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </span>
                  ))}
                  <input
                    type="email"
                    value={declineCcDraft}
                    onChange={(event) => {
                      setDeclineCcDraft(event.target.value);
                      if (declineCcError) setDeclineCcError("");
                    }}
                    onBlur={commitDeclineCcDraft}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        commitDeclineCcDraft();
                      } else if (event.key === "Backspace" && !declineCcDraft) {
                        const lastRemovable = [...declineCc]
                          .reverse()
                          .find((email) => !isFixedQuotationCc(email));
                        if (!lastRemovable) return;
                        setDeclineCc((current) => {
                          const index = current.lastIndexOf(lastRemovable);
                          return index < 0
                            ? current
                            : current.filter((_, itemIndex) => itemIndex !== index);
                        });
                      }
                    }}
                    placeholder={declineCc.length === 0 ? "Add CC recipients" : "Add another email"}
                    className="min-w-[150px] flex-1 border-0 bg-transparent px-1 py-1 text-xs font-semibold outline-none text-slate-800 placeholder:text-slate-400"
                  />
                </div>
                {declineCcError && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">{declineCcError}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={declineSubject}
                  onChange={(event) => setDeclineSubject(event.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={10}
                  value={declineBody}
                  onChange={(event) => setDeclineBody(event.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-medium leading-relaxed outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 resize-y"
                />
              </div>
              {declineSent && (
                <p className="rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                  Decline email sent.
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 shrink-0 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeclinePreview(false);
                  setDeclineCcDraft("");
                  setDeclineCcError("");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  sendingDecline ||
                  declineSent ||
                  declinePreviewLoading ||
                  !declineEmail.trim() ||
                  !declineBody.trim() ||
                  Boolean(declinePreviewError)
                }
                onClick={async () => {
                  const targetEmail = declineEmail.trim();
                  if (!targetEmail.includes("@")) {
                    toast.error("Please enter a valid customer email address");
                    return;
                  }
                  const ccResult = addQuotationCcEmail(declineCc, declineCcDraft, targetEmail);
                  if (ccResult.error) {
                    setDeclineCcError(ccResult.error);
                    toast.error(ccResult.error);
                    return;
                  }
                  setDeclineCc(ccResult.emails);
                  setDeclineCcDraft("");
                  try {
                    setSendingDecline(true);
                    await inquiriesApi.sendDecline(selectedInquiry.id, {
                      customer_email: targetEmail,
                      email_subject: declineSubject,
                      email_body: declineBody,
                      cc: ccResult.emails,
                    });
                    setDeclineSent(true);
                    toast.success("Decline email sent");
                  } catch (err: any) {
                    toast.error(
                      err?.response?.data?.error ||
                        err?.response?.data?.message ||
                        "Could not send the decline email.",
                    );
                  } finally {
                    setSendingDecline(false);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {sendingDecline ? "Sending..." : "Send Decline Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Official Quotation Email Modal (Resend API Integration) */}
      {showQuotationModal && shareDetails && shareInquiry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-quotation-title"
            className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <h2 id="share-quotation-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Send className="text-blue-600" size={22} />
                Share Quotation
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowQuotationModal(false);
                  setShareInquiry(null);
                  setShareDetails(null);
                  setResendNotice("");
                  setQuotationCcDraft("");
                  setQuotationCcError("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-4">
            {/* Small Relevant Info Message */}
            <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
              <FileText size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-blue-950">
                  Official Commercial Quotation
                </p>
                <p className="text-blue-800 text-[11px] mt-0.5 leading-relaxed">
                  The complete 2-page PDF quotation for{" "}
                  <strong>{shareDetails.companyName || "Customer"}</strong> with
                  itemized rates, taxes, bank details, and commercial terms will
                  be generated and dispatched directly to the customer.
                </p>
              </div>
            </div>

            {/* Banner: Unpriced Products Automatically Excluded from PDF */}
            {(() => {
              const items = shareDetails.lineItems || [];
              const zeroItems = items.filter(
                (i) =>
                  i.rate === null ||
                  i.rate === undefined ||
                  i.rate === "" ||
                  isNaN(Number(i.rate)) ||
                  Number(i.rate) <= 0,
              );
              if (zeroItems.length === 0) return null;

              return (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <AlertTriangle
                      size={15}
                      className="text-amber-600 shrink-0"
                    />
                    <span>Unpriced Products Automatically Excluded</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    <strong>{zeroItems.length} product(s)</strong> with empty or
                    0 rates are automatically removed from this quotation PDF to
                    ensure accuracy and clarity:
                  </p>
                  <ul className="text-[11px] font-medium text-amber-900 list-disc list-inside space-y-0.5 pl-1">
                    {zeroItems.map((z, idx) => (
                      <li key={idx} className="truncate">
                        {z.sku_text || "Item"}
                        {z.dimensions ? ` (${z.dimensions})` : ""} —{" "}
                        {z.quantity} {z.unit || "MT"}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* Warning if all items are unpriced */}
            {(() => {
              const items = shareDetails.lineItems || [];
              const validItems = items.filter(
                (i) =>
                  i.rate !== null &&
                  i.rate !== undefined &&
                  i.rate !== "" &&
                  !isNaN(Number(i.rate)) &&
                  Number(i.rate) > 0,
              );
              if (items.length > 0 && validItems.length === 0) {
                return (
                  <div className="p-3 rounded-xl text-xs font-bold border bg-rose-50 text-rose-900 border-rose-200 flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    Cannot send quotation: All products have 0 or blank rates.
                    Please specify prices before dispatching.
                  </div>
                );
              }
              return null;
            })()}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Email Address{" "}
                  <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. customer@example.com"
                  value={quotationEmail}
                  onChange={(e) => setQuotationEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-800"
                />
              </div>

              {quotationPreviewLoading && (
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw size={13} className="animate-spin" /> Preparing
                  email preview…
                </div>
              )}
              {quotationPreviewError && (
                <div className="p-3 rounded-xl text-xs font-bold border bg-rose-50 text-rose-900 border-rose-200">
                  {quotationPreviewError}
                </div>
              )}
              {quotationSenderEmail && (
                <div className="text-[11px] text-slate-500">
                  From:{" "}
                  <span className="font-semibold text-slate-700">
                    {quotationSenderEmail}
                  </span>
                  {quotationReference && (
                    <>
                      {" "}
                      · Reference:{" "}
                      <span className="font-semibold text-slate-700">
                        {quotationReference}
                      </span>
                    </>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CC
                </label>
                <div
                  className="min-h-[42px] w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all flex flex-wrap items-center gap-1.5 bg-white"
                  onClick={(event) => {
                    const input = event.currentTarget.querySelector("input");
                    input?.focus();
                  }}
                >
                  {quotationCc.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700"
                    >
                      {email}
                      <button
                        type="button"
                        aria-label={`Remove ${email}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setQuotationCc((current) =>
                            current.filter((item) => item !== email),
                          );
                        }}
                        className="text-slate-400 hover:text-slate-700 rounded-full"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="email"
                    value={quotationCcDraft}
                    onChange={(event) => {
                      setQuotationCcDraft(event.target.value);
                      if (quotationCcError) setQuotationCcError("");
                    }}
                    onBlur={commitQuotationCcDraft}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        commitQuotationCcDraft();
                      } else if (
                        event.key === "Backspace" &&
                        !quotationCcDraft &&
                        quotationCc.length > 0
                      ) {
                        setQuotationCc((current) => current.slice(0, -1));
                      }
                    }}
                    placeholder={
                      quotationCc.length === 0
                        ? "Add CC recipients"
                        : "Add another email"
                    }
                    className="min-w-[150px] flex-1 border-0 bg-transparent px-1 py-1 text-xs font-semibold outline-none text-slate-800 placeholder:text-slate-400"
                  />
                </div>
                {quotationCcError && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">
                    {quotationCcError}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subject <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quotationSubject}
                  onChange={(e) => setQuotationSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Body <span className="text-red-500 font-bold">*</span>
                </label>
                <textarea
                  required
                  rows={10}
                  value={quotationBody}
                  onChange={(e) => setQuotationBody(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-medium leading-relaxed outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-800 resize-y"
                />
              </div>

              {resendNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold border ${
                    resendNotice.toLowerCase().includes("dispatched") ||
                    resendNotice.toLowerCase().includes("sent") ||
                    resendNotice.toLowerCase().includes("generated") ||
                    resendNotice.toLowerCase().includes("recorded") ||
                    resendNotice.toLowerCase().includes("success")
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                      : "bg-rose-50 text-rose-900 border-rose-200"
                  }`}
                >
                  {resendNotice}
                </div>
              )}
            </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 shrink-0 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowQuotationModal(false);
                  setShareInquiry(null);
                  setShareDetails(null);
                  setResendNotice("");
                  setQuotationCcDraft("");
                  setQuotationCcError("");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  sendingQuotation ||
                  quotationPreviewLoading ||
                  !quotationEmail.trim() ||
                  !quotationSubject.trim() ||
                  !quotationBody.trim() ||
                  !quotationSenderEmail ||
                  Boolean(quotationPreviewError) ||
                  ((shareDetails.lineItems || []).length > 0 &&
                    !(shareDetails.lineItems || []).some(
                      (i) =>
                        i.rate !== null &&
                        i.rate !== undefined &&
                        i.rate !== "" &&
                        !isNaN(Number(i.rate)) &&
                        Number(i.rate) > 0,
                    ))
                }
                onClick={async () => {
                  const targetEmail = quotationEmail.trim();
                  if (!targetEmail || !targetEmail.includes("@")) {
                    toast.error("Please enter a valid customer email address");
                    return;
                  }
                  const ccResult = addQuotationCcEmail(
                    quotationCc,
                    quotationCcDraft,
                    targetEmail,
                  );
                  if (ccResult.error) {
                    setQuotationCcError(ccResult.error);
                    toast.error(ccResult.error);
                    return;
                  }
                  const finalCc = ccResult.emails;
                  setQuotationCc(finalCc);
                  setQuotationCcDraft("");
                  try {
                    if (!guardAction('inquiries.send_quote')) return;
                    setSendingQuotation(true);
                    setResendNotice("");
                    const pricedItems = (shareDetails.lineItems || []).filter(
                      (i) =>
                        i.rate !== null &&
                        i.rate !== undefined &&
                        i.rate !== "" &&
                        !isNaN(Number(i.rate)) &&
                        Number(i.rate) > 0,
                    );
                    const filteredDetails = {
                      ...shareDetails,
                      lineItems:
                        pricedItems.length > 0
                          ? pricedItems
                          : shareDetails.lineItems,
                    };
                    const res = await inquiriesApi.sendQuotation(
                      shareInquiry.id,
                      {
                        customer_email: targetEmail,
                        customer_name: shareDetails.companyName,
                        details: filteredDetails,
                        email_subject: quotationSubject,
                        email_body: quotationBody,
                        quotation_reference: quotationReference,
                        cc: finalCc,
                      },
                    );
                    const msg =
                      res?.data?.message ||
                      res?.data?.data?.message ||
                      "Live email & PDF Quotation dispatched to customer!";
                    const sharedAt =
                      res?.data?.quotation_shared_at ||
                      res?.data?.data?.quotation_shared_at ||
                      new Date().toISOString();
                    setResendNotice(msg);
                    setIsQuotationSent(true);
                    setLastSharedById((prev) => ({
                      ...prev,
                      [shareInquiry.id]: sharedAt,
                    }));

                    // 1. Optimistic live update of local state immediately
                    setInquiries((prev) =>
                      prev.map((i) =>
                        i.id === shareInquiry.id
                          ? {
                              ...i,
                              status: "quoted",
                              inquiry_type: "quotation_sent",
                              ai_extraction_json: {
                                ...(i.ai_extraction_json || {}),
                                quotation_shared_at: sharedAt,
                              },
                            }
                          : i,
                      ),
                    );
                    if (
                      selectedInquiry &&
                      selectedInquiry.id === shareInquiry.id
                    ) {
                      setSelectedInquiry((prev) =>
                        prev
                          ? {
                              ...prev,
                              status: "quoted",
                              ai_extraction_json: {
                                ...(prev.ai_extraction_json || {}),
                                quotation_shared_at: sharedAt,
                              },
                            }
                          : null,
                      );
                    }

                    // Optimistically update linked deal stage to 'quoted'
                    queryClient.setQueryData(
                      ["deals", effectivePhone],
                      (old: any[] = []) =>
                        old.map((d) =>
                          d.inquiry_id === shareInquiry.id ||
                          (d.customer_name &&
                            d.customer_name.toLowerCase().trim() ===
                              shareDetails?.companyName?.toLowerCase().trim())
                            ? { ...d, stage: "quoted" }
                            : d,
                        ),
                    );

                    // 2. Invalidate React Query caches immediately so all views update live
                    queryClient.invalidateQueries({
                      queryKey: ["inquiries-list"],
                    });
                    queryClient.invalidateQueries({ queryKey: ["deals"] });
                    queryClient.invalidateQueries({ queryKey: ["pipeline"] });
                    queryClient.invalidateQueries({ queryKey: ["kanban"] });
                    queryClient.invalidateQueries({
                      queryKey: ["kra-dashboard"],
                    });
                    fetchMonthlyInquiries();

                    if (res?.data?.email_sent !== false) {
                      setTimeout(() => {
                        setShowQuotationModal(false);
                        setShareInquiry(null);
                        setShareDetails(null);
                        setResendNotice("");
                        setQuotationCcDraft("");
                        setQuotationCcError("");
                      }, 1200);
                    }
                  } catch (err: any) {
                    console.error("Error sending quotation:", err);
                    const errMsg =
                      err?.response?.data?.error ||
                      err?.response?.data?.message ||
                      "Quotation recorded! Add RESEND_API_KEY in backend .env to send live emails.";
                    setResendNotice(errMsg);
                    toast.error(errMsg);
                  } finally {
                    setSendingQuotation(false);
                  }
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                {sendingQuotation ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {sendingQuotation
                  ? "Dispatching Email & PDF..."
                  : "Share Quotation Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log New Customer Inquiry Modal */}
      {showModal && (
        <div className="mobile-sheet-overlay fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="mobile-sheet bg-white rounded-2xl max-w-7.5xl max-w-[102rem] w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto overscroll-contain">
            <div className="sheet-header flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" size={20} />
                Log New Inquiry
              </h2>
              <button
                type="button"
                onClick={handleCancelCreateInquiry}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Upload Inquiry Document Section */}
            <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs text-blue-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <UploadCloud size={15} className="text-blue-600" />
                  Upload Inquiry Document (Auto-Fill via Gemini)
                </span>
                <span className="text-[10px] text-slate-400 font-medium font-mono">
                  PDF, JPEG, PNG
                </span>
              </div>

              <label
                htmlFor="inquiry-doc-file-upload"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    handleFileUpload({ target: { files } } as any);
                  }
                }}
                className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-white/90 hover:bg-blue-50/60 rounded-xl cursor-pointer transition-all"
              >
                <input
                  id="inquiry-doc-file-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {isExtractingPo ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 animate-pulse py-1">
                    <Loader2 size={16} className="animate-spin" />
                    <span>AI Extracting inquiry details from document...</span>
                  </div>
                ) : poFileBase64 ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 py-1">
                    <CheckCircle
                      size={15}
                      className="text-emerald-600 shrink-0"
                    />
                    <span className="truncate max-w-xs">
                      {poFileName || "Document Attached"}
                    </span>
                    <span className="text-[10px] text-blue-600 underline ml-1">
                      Change
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 font-medium py-1">
                    Drop document here, or{" "}
                    <span className="text-blue-600 font-bold underline">
                      Browse File
                    </span>
                  </p>
                )}
              </label>
              {poFileBase64 && !isExtractingPo && (
                <button
                  type="button"
                  onClick={handleRemoveUploadedInquiryDocument}
                  className="mt-2 text-[11px] font-bold text-rose-700 underline"
                >
                  Remove
                </button>
              )}
            </div>

            <form onSubmit={handleCreateInquiry} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 items-start">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Company Name <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="relative flex items-center">
                    <Building2
                      className="absolute left-3 text-slate-400 pointer-events-none"
                      size={15}
                    />
                    <input
                      id="form-company-name"
                      type="text"
                      required
                      placeholder="Type or select company name..."
                      value={formCustomerName}
                      onChange={(e) => {
                        setFormCustomerName(e.target.value);
                        setShowCompanyDropdown(true);
                      }}
                      onFocus={() => setShowCompanyDropdown(true)}
                      className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowCompanyDropdown((prev) => !prev);
                      }}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${showCompanyDropdown ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {showCompanyDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {existingCustomers
                        .filter(
                          (c) =>
                            !formCustomerName ||
                            c
                              .toLowerCase()
                              .includes(formCustomerName.toLowerCase()),
                        )
                        .map((cName) => (
                          <div
                            key={cName}
                            onMouseDown={() => {
                              setFormCustomerName(cName);
                              setShowCompanyDropdown(false);
                            }}
                            className="px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <Building2 size={13} className="text-slate-400" />
                              {cName}
                            </span>
                            {formCustomerName.toLowerCase() ===
                              cName.toLowerCase() && (
                              <CheckCircle
                                size={13}
                                className="text-blue-600"
                              />
                            )}
                          </div>
                        ))}
                      {existingCustomers.filter(
                        (c) =>
                          !formCustomerName ||
                          c
                            .toLowerCase()
                            .includes(formCustomerName.toLowerCase()),
                      ).length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400 italic">
                          This company is not in your assigned customer list.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {formCustomerName.trim() &&
                  !isCustomerInAssignedList(formCustomerName, rawCustomers) && (
                    <div className="mt-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                      <AlertCircle
                        size={16}
                        className="text-rose-600 shrink-0 mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="font-bold">
                          Customer Not Assigned:
                        </span>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          "{formCustomerName}" is not in your assigned customer
                          list. Add this customer before saving the inquiry.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAddCustomer(true)}
                          className="mt-2 px-3 py-1.5 bg-white border border-rose-300 text-rose-800 rounded-lg text-[11px] font-bold hover:bg-rose-100"
                        >
                          Add this customer
                        </button>
                      </div>
                    </div>
                  )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="form-customer-email"
                  type="email"
                  value={formCustomerEmail}
                  onChange={(e) => setFormCustomerEmail(e.target.value)}
                  placeholder="buyer@company.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
              </div>

              {/* Structured Line Items Table matching Image 3 / Orders */}
              <div className="bg-white rounded-xl border border-slate-300 overflow-x-auto shadow-xs">
                <table className="w-full min-w-[960px] table-fixed text-left text-xs text-slate-800 border-collapse">
                  <thead className="bg-slate-800 text-white font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th
                        rowSpan={2}
                        className="px-2 py-3 border-r border-slate-700 w-[3%] text-center align-middle"
                      >
                        Sr. No.
                      </th>
                      <th
                        rowSpan={2}
                        className="px-4 py-3 border-r border-slate-700 w-[16%] align-middle"
                      >
                        Description &amp; Specifications{" "}
                        <span className="text-red-500 font-bold">*</span>
                      </th>
                      <th
                        rowSpan={2}
                        className="px-3 py-3 border-r border-slate-700 w-[8%] text-center align-middle"
                      >
                        HSN/SAC
                      </th>
                      <th
                        rowSpan={2}
                        className="px-3 py-3 border-r border-slate-700 w-[10%] text-center align-middle"
                      >
                        Brand/Make
                      </th>
                      <th
                        rowSpan={2}
                        className="w-[144px] border-r border-slate-700 px-2 py-3 text-center align-middle leading-tight"
                      >
                        Quantity, Unit &amp; Wt (MT){" "}
                        <span className="text-red-500 font-bold">*</span>
                      </th>
                      <th
                        rowSpan={2}
                        className="px-3 py-3 border-r border-slate-700 w-[12%] text-center align-middle"
                      >
                        Rate (₹)/ MT{" "}
                        <span className="text-red-500 font-bold">*</span>
                      </th>
                      <th
                        colSpan={2}
                        className="px-3 py-1.5 border-r border-b border-slate-700 text-center text-[10px] bg-slate-800/90 tracking-widest"
                      >
                        18% GST
                      </th>
                      <th
                        rowSpan={2}
                        className="px-3 py-3 border-r border-slate-700 w-[13%] text-left min-w-[100px] align-middle"
                      >
                        Amount (₹)
                      </th>
                      <th
                        rowSpan={2}
                        className="px-2 py-3 text-center w-[3%] align-middle"
                      ></th>
                    </tr>
                    <tr>
                      <th className="px-2.5 py-1.5 border-r border-slate-700 text-right text-[10px] w-[8%] min-w-[75px] bg-slate-850">
                        CGST (9%)
                      </th>
                      <th className="px-2.5 py-1.5 border-r border-slate-700 text-right text-[10px] w-[8%] min-w-[75px] bg-slate-850">
                        SGST (9%)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {formLineItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 [&>td]:align-middle">
                        <td data-label="Sr. No." className="px-3 py-3.5 border-r border-slate-200 text-slate-400 font-mono text-center text-xs">
                          {idx + 1}
                        </td>
                        <td data-label="Description" className="px-4 py-3.5 border-r border-slate-200">
                          <div className="space-y-1">
                            <input
                              id={`form-item-sku-${idx}`}
                              type="text"
                              required
                              value={item.sku_text || ""}
                              onChange={(e) => {
                                const newSku = e.target.value;
                                const updated = [...formLineItems];
                                const currentHsn = updated[idx]?.hsn_code || "";
                                const prevAutoHsn = detectHsnCode(
                                  updated[idx]?.sku_text || "",
                                  item.dimensions,
                                );
                                const newAutoHsn = detectHsnCode(
                                  newSku,
                                  item.dimensions,
                                );

                                let finalHsn = currentHsn;
                                if (!newSku.trim()) {
                                  finalHsn = "";
                                } else if (
                                  !currentHsn ||
                                  currentHsn === prevAutoHsn
                                ) {
                                  finalHsn = newAutoHsn;
                                }

                                const currentItem = {
                                  ...updated[idx],
                                  sku_text: newSku,
                                  hsn_code: finalHsn,
                                };
                                const calc = calculateLineItem({
                                  ...currentItem,
                                  amount: 0,
                                });
                                updated[idx] = {
                                  ...currentItem,
                                  amount: calc.amount,
                                  cgst_rate: calc.cgst_rate,
                                  cgst_amount: calc.cgst_amount,
                                  sgst_rate: calc.sgst_rate,
                                  sgst_amount: calc.sgst_amount,
                                  total_gst: calc.total_gst,
                                  final_amount: calc.final_amount,
                                };
                                setFormLineItems(updated);
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                              placeholder="Product Name / Description"
                            />
                            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                              <span className="font-semibold text-slate-400 shrink-0">
                                Spec:
                              </span>
                              <input
                                id={`form-item-spec-${idx}`}
                                type="text"
                                required
                                value={item.dimensions || ""}
                                onChange={(e) => {
                                  const newDim = e.target.value;
                                  const updated = [...formLineItems];
                                  const currentHsn =
                                    updated[idx]?.hsn_code || "";
                                  const prevAutoHsn = detectHsnCode(
                                    updated[idx]?.sku_text || "",
                                    updated[idx]?.dimensions,
                                  );
                                  const newAutoHsn = detectHsnCode(
                                    updated[idx]?.sku_text || "",
                                    newDim,
                                  );

                                  let finalHsn = currentHsn;
                                  if (
                                    !currentHsn ||
                                    currentHsn === prevAutoHsn
                                  ) {
                                    finalHsn = newAutoHsn;
                                  }

                                  const currentItem = {
                                    ...updated[idx],
                                    dimensions: newDim,
                                    hsn_code: finalHsn,
                                  };
                                  const calc = calculateLineItem({
                                    ...currentItem,
                                    amount: 0,
                                  });
                                  updated[idx] = {
                                    ...currentItem,
                                    amount: calc.amount,
                                    cgst_rate: calc.cgst_rate,
                                    cgst_amount: calc.cgst_amount,
                                    sgst_rate: calc.sgst_rate,
                                    sgst_amount: calc.sgst_amount,
                                    total_gst: calc.total_gst,
                                    final_amount: calc.final_amount,
                                  };
                                  setFormLineItems(updated);
                                }}
                                className="w-full px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
                                placeholder="e.g. 8X6000X1500"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3.5 border-r border-slate-200 text-center font-mono">
                          <input
                            id={`form-item-hsn-${idx}`}
                            type="text"
                            required
                            value={item.hsn_code || ""}
                            onChange={(e) => {
                              const updated = [...formLineItems];
                              updated[idx] = {
                                ...updated[idx],
                                hsn_code: e.target.value,
                              };
                              setFormLineItems(updated);
                            }}
                            placeholder="e.g. 72083730"
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs font-mono text-center text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                          />
                        </td>
                        <td data-label="Brand/Make" className="px-2 py-3.5 border-r border-slate-200 text-center">
                          <Select
                            value={item.brand || item.make || ''}
                            onChange={(e) => {
                              const updated = [...formLineItems];
                              updated[idx] = { ...updated[idx], brand: e.target.value, make: e.target.value };
                              setFormLineItems(updated);
                            }}
                            wrapperClassName="w-full"
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium hover:border-blue-400"
                            placeholder="Select make"
                          >
                            <option value="">Select make</option>
                            {INQUIRY_PREFERRED_MAKES.map((make) => (
                              <option key={make} value={make}>{make}</option>
                            ))}
                            {(item.brand || item.make) && !INQUIRY_PREFERRED_MAKES.includes(item.brand || item.make || '') && (
                              <option value={item.brand || item.make}>{item.brand || item.make}</option>
                            )}
                          </Select>
                        </td>
                        <td data-label="Qty" className="w-[144px] max-w-[144px] border-r border-slate-200 px-1.5 py-3.5 align-middle">
                          <div className="mx-auto flex w-full flex-col items-stretch gap-1">
                            <div className="flex w-full rounded border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-blue-500">
                            <input
                              id={`form-item-qty-${idx}`}
                              type="number"
                              required
                              min="0.001"
                              step="any"
                              value={item.quantity === 0 ? "" : item.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                const rawQ = val === "" ? 0 : parseFloat(val);
                                const safeQ =
                                  isNaN(rawQ) || rawQ < 0 ? 0 : rawQ;
                                const updated = [...formLineItems];
                                let currentItem = {
                                  ...updated[idx],
                                  quantity: safeQ,
                                };
                                if (normalizeUnit(currentItem.unit) === "MT") {
                                  currentItem.converted_mt = safeQ;
                                }
                                const calc = calculateLineItem({
                                  ...currentItem,
                                  amount: 0,
                                });
                                updated[idx] = {
                                  ...currentItem,
                                  amount: calc.amount,
                                  cgst_rate: calc.cgst_rate,
                                  cgst_amount: calc.cgst_amount,
                                  sgst_rate: calc.sgst_rate,
                                  sgst_amount: calc.sgst_amount,
                                  total_gst: calc.total_gst,
                                  final_amount: calc.final_amount,
                                };
                                setFormLineItems(updated);
                              }}
                              placeholder="0"
                              className="min-w-0 flex-1 rounded-l border-0 bg-transparent px-1 py-1.5 text-center font-mono text-xs font-bold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <select
                              value={normalizeUnit(item.unit) || "KG"}
                              onChange={(e) => {
                                const newUnit = e.target.value;
                                const updated = [...formLineItems];
                                const currentItem = {
                                  ...updated[idx],
                                  unit: newUnit,
                                };
                                delete currentItem.is_manual_mt;
                                if (newUnit === "MT") {
                                  currentItem.converted_mt =
                                    currentItem.quantity;
                                } else {
                                  delete currentItem.converted_mt;
                                }
                                const calc = calculateLineItem({
                                  ...currentItem,
                                  amount: 0,
                                });
                                updated[idx] = {
                                  ...currentItem,
                                  amount: calc.amount,
                                  cgst_rate: calc.cgst_rate,
                                  cgst_amount: calc.cgst_amount,
                                  sgst_rate: calc.sgst_rate,
                                  sgst_amount: calc.sgst_amount,
                                  total_gst: calc.total_gst,
                                  final_amount: calc.final_amount,
                                };
                                setFormLineItems(updated);
                              }}
                              className="w-14 shrink-0 rounded-r border-0 border-l border-slate-300 bg-slate-50 px-1 py-1.5 text-center text-[11px] font-bold text-slate-700 outline-none"
                            >
                              <option value="KG">KG</option>
                              <option value="MT">MT</option>
                              <option value="Nos">Nos</option>
                            </select>
                            </div>
                            {(() => {
                              const itemWeight = formatLineItemWeightMt(item);
                              const hasFormulaWeight =
                                itemWeight.canConvert &&
                                itemWeight.mt !== null &&
                                itemWeight.mt > 0;
                              const displayMt =
                                (item.is_manual_mt ||
                                  normalizeUnit(item.unit) === "MT") &&
                                item.converted_mt !== undefined &&
                                item.converted_mt !== null &&
                                item.converted_mt !== ""
                                  ? item.converted_mt
                                  : hasFormulaWeight && itemWeight.mt !== null
                                    ? itemWeight.mt
                                    : "";
                              const hasWeight =
                                (displayMt !== "" && Number(displayMt) > 0) ||
                                hasFormulaWeight;

                              return (
                                <div
                                  className={`flex w-full items-center justify-center gap-1 rounded px-1 py-0.5 text-[10px] ${
                                    hasWeight
                                      ? "bg-blue-50/80 text-blue-900"
                                      : "bg-slate-100 text-slate-400"
                                  }`}
                                  title="Weight in MT (Editable - Amount calculates as MT × Rate)"
                                >
                                  <span className="shrink-0 font-semibold">
                                    Wt
                                  </span>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={displayMt ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updated = [...formLineItems];
                                      const currentItem = { ...updated[idx] };

                                      if (val === "") {
                                        delete currentItem.converted_mt;
                                        delete currentItem.is_manual_mt;
                                      } else {
                                        const rawMt = parseFloat(val);
                                        const safeMt =
                                          isNaN(rawMt) || rawMt < 0 ? 0 : rawMt;
                                        currentItem.converted_mt = val;
                                        currentItem.is_manual_mt = true;
                                        if (
                                          normalizeUnit(currentItem.unit) ===
                                          "MT"
                                        ) {
                                          currentItem.quantity = safeMt;
                                        }
                                      }

                                      const calc = calculateLineItem({
                                        ...currentItem,
                                        amount: 0,
                                      });
                                      updated[idx] = {
                                        ...currentItem,
                                        amount: calc.amount,
                                        cgst_rate: calc.cgst_rate,
                                        cgst_amount: calc.cgst_amount,
                                        sgst_rate: calc.sgst_rate,
                                        sgst_amount: calc.sgst_amount,
                                        total_gst: calc.total_gst,
                                        final_amount: calc.final_amount,
                                      };
                                      setFormLineItems(updated);
                                    }}
                                    placeholder={
                                      hasFormulaWeight
                                        ? String(itemWeight.mt)
                                        : "0.000"
                                    }
                                    className="min-w-0 flex-1 bg-transparent text-center font-mono text-[10px] font-bold text-blue-900 outline-none placeholder:font-normal placeholder:text-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                  />
                                  <span className="select-none font-mono font-bold text-blue-700/80">
                                    MT
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                          {nosMtMissing(item) && (
                            <span className="text-[9px] text-red-600 font-normal block text-left mt-0.5 leading-snug max-w-[240px]">{NOS_MT_MISSING_MESSAGE}</span>
                          )}
                        </td>
                        <td className="px-2.5 py-3.5 border-r border-slate-200 font-bold font-mono min-w-[95px]">
                          <input
                            id={`form-item-rate-${idx}`}
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate === 0 ? "" : item.rate}
                            onChange={(e) => {
                              const val = e.target.value;
                              const rawR = val === "" ? 0 : parseFloat(val);
                              const safeR = isNaN(rawR) || rawR < 0 ? 0 : rawR;
                              const updated = [...formLineItems];
                              const currentItem = {
                                ...updated[idx],
                                rate: safeR,
                              };
                              const calc = calculateLineItem({
                                ...currentItem,
                                amount: 0,
                              });
                              updated[idx] = {
                                ...currentItem,
                                amount: calc.amount,
                                cgst_rate: calc.cgst_rate,
                                cgst_amount: calc.cgst_amount,
                                sgst_rate: calc.sgst_rate,
                                sgst_amount: calc.sgst_amount,
                                total_gst: calc.total_gst,
                                final_amount: calc.final_amount,
                              };
                              setFormLineItems(updated);
                            }}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal text-left text-slate-900"
                          />
                        </td>
                        <td className="px-2.5 py-3.5 border-r border-slate-200 min-w-[75px]">
                          {(() => {
                            const baseAmt = Number(item.amount) || 0;
                            const cgst =
                              item.cgst_amount !== undefined
                                ? Number(item.cgst_amount)
                                : Math.round(baseAmt * 0.09 * 100) / 100;
                            return (
                              <input
                                type="text"
                                readOnly
                                tabIndex={-1}
                                value={formatIndianCurrency(cgst, true)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-xs font-mono text-slate-900 text-right cursor-default select-all outline-none"
                              />
                            );
                          })()}
                        </td>
                        <td className="px-2.5 py-3.5 border-r border-slate-200 min-w-[75px]">
                          {(() => {
                            const baseAmt = Number(item.amount) || 0;
                            const sgst =
                              item.sgst_amount !== undefined
                                ? Number(item.sgst_amount)
                                : Math.round(baseAmt * 0.09 * 100) / 100;
                            return (
                              <input
                                type="text"
                                readOnly
                                tabIndex={-1}
                                value={formatIndianCurrency(sgst, true)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-xs font-mono text-slate-900 text-right cursor-default select-all outline-none"
                              />
                            );
                          })()}
                        </td>
                        <td className="px-3 py-3.5 text-left font-bold text-slate-900 font-mono border-r border-slate-200 min-w-[100px]">
                          {(() => {
                            const baseAmt = Number(item.amount) || 0;
                            const cgst =
                              item.cgst_amount !== undefined
                                ? Number(item.cgst_amount)
                                : Math.round(baseAmt * 0.09 * 100) / 100;
                            const sgst =
                              item.sgst_amount !== undefined
                                ? Number(item.sgst_amount)
                                : Math.round(baseAmt * 0.09 * 100) / 100;
                            const finalAmt =
                              item.final_amount !== undefined &&
                              item.final_amount > 0
                                ? Number(item.final_amount)
                                : Math.round((baseAmt + cgst + sgst) * 100) /
                                  100;
                            return (
                              <input
                                id={`form-item-amount-${idx}`}
                                type="number"
                                min="0"
                                step="any"
                                value={finalAmt === 0 ? "" : finalAmt}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const rawA = val === "" ? 0 : parseFloat(val);
                                  const safeFinal =
                                    isNaN(rawA) || rawA < 0 ? 0 : rawA;
                                  const safeBase =
                                    Math.round((safeFinal / 1.18) * 100) / 100;
                                  const cgstA =
                                    Math.round(safeBase * 0.09 * 100) / 100;
                                  const sgstA =
                                    Math.round(safeBase * 0.09 * 100) / 100;
                                  const updated = [...formLineItems];
                                  updated[idx] = {
                                    ...updated[idx],
                                    amount: safeBase,
                                    isManualAmount: true,
                                    cgst_rate: 9,
                                    cgst_amount: cgstA,
                                    sgst_rate: 9,
                                    sgst_amount: sgstA,
                                    total_gst:
                                      Math.round((cgstA + sgstA) * 100) / 100,
                                    final_amount: safeFinal,
                                  };
                                  setFormLineItems(updated);
                                }}
                                placeholder="0"
                                className="w-full min-w-[95px] px-2.5 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs text-left font-mono text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                              />
                            );
                          })()}
                        </td>
                        <td className="px-2 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {formLineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = formLineItems.filter(
                                    (_, i) => i !== idx,
                                  );
                                  setFormLineItems(updated);
                                }}
                                className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                                title="Remove line item"
                              >
                                <Minus size={15} />
                              </button>
                            )}
                            {idx === formLineItems.length - 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [
                                    ...formLineItems,
                                    {
                                      sku_text: "",
                                      dimensions: "",
                                      brand: formLineItems[idx]?.brand || formLineItems[0]?.brand || "",
                                      make: formLineItems[idx]?.make || formLineItems[0]?.make || "",
                                      hsn_code: "",
                                      quantity: 0,
                                      unit: "MT",
                                      rate: 0,
                                      amount: 0,
                                      cgst_rate: 9,
                                      cgst_amount: 0,
                                      sgst_rate: 9,
                                      sgst_amount: 0,
                                      total_gst: 0,
                                      final_amount: 0,
                                    },
                                  ];
                                  setFormLineItems(updated);
                                }}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center"
                                title="Add line item"
                              >
                                <Plus size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Standard Quotation Pricing Breakdown Layout */}
                {(() => {
                  const subtotal = formLineItems.reduce(
                    (sum, item) => sum + (Number(item.amount) || 0),
                    0,
                  );
                  const qBreakdown = calculateQuotationBreakdown(
                    subtotal,
                    formLineItems,
                  );

                  const totalTonnage = calculateTotalTonnageMt(formLineItems);
                  const formattedItemsInTotal = totalTonnage.formattedText;

                  return (
                    <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4">
                      <div className="text-xs text-slate-700 pt-1">
                        <span className="font-bold text-slate-900">
                          Items in Total ={" "}
                        </span>
                        <span className="font-mono text-slate-900 font-bold">
                          {formattedItemsInTotal}
                        </span>
                      </div>

                      <div className="w-full sm:w-64 space-y-1 text-xs text-slate-700">
                        <div className="flex justify-between items-center py-0.5">
                          <span className="font-medium text-slate-600">
                            Sub Total
                          </span>
                          <span className="font-mono text-slate-900 font-medium">
                            {qBreakdown.formattedSubtotal}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <span className="font-medium text-slate-600">
                            CGST (9%)
                          </span>
                          <span className="font-mono text-slate-900 font-medium">
                            {qBreakdown.formattedCGST}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <span className="font-medium text-slate-600">
                            SGST (9%)
                          </span>
                          <span className="font-mono text-slate-900 font-medium">
                            {qBreakdown.formattedSGST}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <span className="font-medium text-slate-600">
                            Rounding
                          </span>
                          <span className="font-mono text-slate-900 font-medium">
                            {qBreakdown.formattedRounding}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-300 font-black text-slate-950 text-sm">
                          <span className="font-bold">Total</span>
                          <span className="font-mono text-base font-black text-slate-950">
                            {qBreakdown.formattedGrandTotal}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Delivery Location{" "}
                    <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    id="form-delivery-location"
                    type="text"
                    required
                    placeholder="e.g. Gat No / Plot No PAP V :- 149/2, Village Vasuli, Chakan, Pune, Maharashtra - 410501"
                    value={formDeliveryLocation}
                    onChange={(e) => setFormDeliveryLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Terms{" "}
                    <span className="text-red-500 font-bold">*</span>
                  </label>
                  <Select
                    id="form-payment-terms"
                    required
                    value={formPaymentTerms}
                    onChange={(e) => setFormPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white cursor-pointer font-medium hover:border-blue-400"
                    placeholder="Select payment terms"
                  >
                    <option value="">Select payment terms</option>
                    {INQUIRY_PAYMENT_TERMS.map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                    {formPaymentTerms &&
                      !INQUIRY_PAYMENT_TERMS.includes(formPaymentTerms) && (
                        <option value={formPaymentTerms}>
                          {formPaymentTerms}
                        </option>
                      )}
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Additional Notes</label>
                <input
                  type="text"
                  placeholder="Special instructions, delivery timeline, or logistics notes"
                  value={formRequirement}
                  onChange={e => setFormRequirement(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelCreateInquiry}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    isExtractingPo ||
                    (formCustomerName.trim().length > 0 &&
                      !isCustomerInAssignedList(formCustomerName, rawCustomers))
                  }
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {submitting ? "Saving Inquiry..." : "Save Inquiry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AddAssignedCustomerDialog
        open={showAddCustomer}
        assignPhone={effectivePhone || employee?.phone || ""}
        seed={{
          companyName: formCustomerName.trim(),
          contactPerson: String(
            formExtractedJsonRef.current?.contact_person ||
              formExtractedJsonRef.current?.contact_name ||
              formExtractedJsonRef.current?.customer?.contact_person ||
              "",
          ).trim(),
          mobile: formPhone.trim(),
          deliveryLocation: (
            formDeliveryLocation.trim() ||
            String(
              formExtractedJsonRef.current?.delivery_location ||
                formExtractedJsonRef.current?.customer_address ||
                formExtractedJsonRef.current?.address ||
                "",
            )
          ).trim(),
          gstin: String(
            formExtractedJsonRef.current?.customer_gst ||
              formExtractedJsonRef.current?.gstin ||
              formExtractedJsonRef.current?.gst ||
              "",
          ).trim(),
        }}
        onClose={() => setShowAddCustomer(false)}
        onSaved={(saved) => {
          setFormCustomerName(saved.companyName);
          setFormPhone(saved.mobile);
          setFormDeliveryLocation(saved.deliveryLocation);
          setShowAddCustomer(false);
          queryClient.setQueryData<string[]>(
            ["customer-names-list", effectivePhone, activeRole, activeMode],
            (prev) => {
              const list = Array.isArray(prev) ? prev : [];
              if (
                list.some(
                  (c) =>
                    c.trim().toLowerCase() ===
                    saved.companyName.trim().toLowerCase(),
                )
              )
                return list;
              return [...list, saved.companyName].sort((a, b) =>
                a.localeCompare(b),
              );
            },
          );
          queryClient.invalidateQueries({ queryKey: ["customer-names-list"] });
        }}
      />

      {/* Pipeline Mark as Lost Modal */}
      {pipelineLostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Mark as Lost
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Please select a reason (required)
            </p>
            <div className="space-y-2 mb-4">
              {LOST_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="pipeline_reason"
                    value={reason}
                    checked={pipelineLostModal.reason === reason}
                    onChange={() =>
                      setPipelineLostModal((prev) =>
                        prev ? { ...prev, reason } : null,
                      )
                    }
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPipelineLostModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={!pipelineLostModal.reason}
                onClick={() =>
                  stageMutation.mutate({
                    id: pipelineLostModal.dealId,
                    stage: "lost",
                    reason: pipelineLostModal.reason,
                  })
                }
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inquiry & Audit Permanent Delete Confirmation Modal */}
      {confirmDeleteInquiry && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
        >
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-100">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Delete Inquiry Permanently?
                </h3>
                <p className="text-xs text-slate-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5 mb-5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Inquiry Ref:</span>
                <span className="font-mono font-bold text-indigo-600">
                  #{confirmDeleteInquiry.id
                    ? `INQ-${confirmDeleteInquiry.id.substring(0, 6).toUpperCase()}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Customer / Company:</span>
                <span className="font-bold text-slate-900 truncate max-w-[200px]">
                  {(confirmDeleteInquiry as any).company_name ||
                    confirmDeleteInquiry.customer_name ||
                    confirmDeleteInquiry.sender_name ||
                    confirmDeleteInquiry.sender_phone ||
                    "N/A"}
                </span>
              </div>
              {confirmDeleteInquiry.status && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <span className="capitalize font-semibold text-slate-700">
                    {confirmDeleteInquiry.status}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-red-600 pt-2 border-t border-slate-200">
                All line items, pricing, linked deals, orders, and audit history tied to this inquiry will be permanently deleted from the database.
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={deleteInquiryMutation.isPending}
                onClick={() => setConfirmDeleteInquiry(null)}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteInquiryMutation.isPending}
                onClick={() => {
                  if (!guardAction('inquiries.delete')) return;
                  deleteInquiryMutation.mutate(confirmDeleteInquiry.id);
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleteInquiryMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Yes, Delete Inquiry</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Permanent Delete Deal Confirmation Modal */}
      {confirmDeleteDeal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-100">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Delete Deal Permanently?
                </h3>
                <p className="text-xs text-slate-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5 mb-5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Customer:</span>
                <span className="font-bold text-slate-900">
                  {confirmDeleteDeal.customer_name || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Inquiry Ref:</span>
                <span className="font-mono font-bold text-indigo-600">
                  #
                  {confirmDeleteDeal.deal_number
                    ? confirmDeleteDeal.deal_number.replace(
                        /^#?(?:DEAL|INQ)-/i,
                        "INQ-",
                      )
                    : confirmDeleteDeal.id
                      ? `INQ-${confirmDeleteDeal.id.substring(0, 6).toUpperCase()}`
                      : "INQ"}
                </span>
              </div>
              {confirmDeleteDeal.total_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">
                    Deal Amount:
                  </span>
                  <span className="font-bold text-emerald-600">
                    ₹
                    {Number(confirmDeleteDeal.total_amount).toLocaleString(
                      "en-IN",
                    )}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-red-600 pt-2 border-t border-slate-200">
                All line items, payment tracking records, and logs tied to this
                deal will be permanently removed from the database and
                dashboard.
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteDeal(null)}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteDealMutation.isPending}
                onClick={() => {
                  if (!guardAction('inquiries.delete')) return;
                  deleteDealMutation.mutate(confirmDeleteDeal.id);
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleteDealMutation.isPending
                  ? "Deleting..."
                  : "Yes, Delete Deal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loss Modal - Exact Match to img2 */}
      {lostModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <div className="bg-white rounded-xl p-6 w-[360px] max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Mark as Lost
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Please select a reason (required)
            </p>
            <div className="space-y-2.5 mb-5">
              {LOST_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700 select-none"
                >
                  <input
                    type="radio"
                    name="inquiry_loss_reason"
                    value={reason}
                    checked={lostModal.reason === reason}
                    onChange={() =>
                      setLostModal((prev) =>
                        prev ? { ...prev, reason } : null,
                      )
                    }
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setLostModal(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!lostModal.reason}
                onClick={handleConfirmLost}
                className="flex-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-all shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Won Modal - Prompt for PO Number before converting to confirmed order */}
      {wonModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <div className="bg-white rounded-2xl p-6 w-[420px] max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Mark Inquiry as Won
                </h3>
                <p className="text-xs text-slate-500">
                  Confirm the generated system PO before creating the Order
                </p>
              </div>
            </div>

            {/* Context Details Card */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Customer:</span>
                <span className="font-bold text-slate-900 truncate max-w-[200px]">
                  {wonModal.companyName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">
                  Inquiry Reference:
                </span>
                <span className="font-mono font-bold text-blue-600">
                  {wonModal.dealCode}
                </span>
              </div>
            </div>

            {/* Form Inputs */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmWon();
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  System PO Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="EM/PO/1"
                  value={wonModal.poNumber}
                  onChange={(e) => {
                    wonPoDirtyRef.current = true;
                    setWonModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            poNumber: e.target.value,
                            poConflict: null,
                          }
                        : null,
                    );
                  }}
                  className={`w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    wonModal.poConflict
                      ? "border-rose-400 bg-rose-50"
                      : "border-slate-300"
                  }`}
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Generated automatically and editable before confirmation.
                </p>
                {wonModal.checkingPo && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Checking availability…
                  </p>
                )}
                {wonModal.poConflict && (
                  <p className="mt-1 text-[10px] font-semibold text-rose-600">
                    {wonModal.poConflict}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reference PO{" "}
                  <span className="text-[10px] font-medium text-slate-400">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Customer PO from document/text"
                  value={wonModal.referencePoNumber}
                  onChange={(e) =>
                    setWonModal((previous) =>
                      previous
                        ? { ...previous, referencePoNumber: e.target.value }
                        : null,
                    )
                  }
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PO Date
                </label>
                <input
                  type="date"
                  value={wonModal.poDate}
                  onChange={(e) =>
                    setWonModal((prev) =>
                      prev ? { ...prev, poDate: e.target.value } : null,
                    )
                  }
                  className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelWon}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !wonModal.poNumber.trim() ||
                    !!wonModal.poConflict ||
                    !!wonModal.checkingPo
                  }
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <CheckCircle size={14} />
                  Confirm &amp; Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
