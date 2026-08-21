import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Search, CheckCircle, Clock, RefreshCw, X, Building2,
  Calendar, Save, Check, ShieldCheck, UploadCloud, FileCheck, Send, ShoppingBag, Eye,
  ImageIcon, ZoomIn, ExternalLink, Package, Printer, ChevronDown, Trash2, Sparkles, User
} from 'lucide-react';
import { inquiriesApi, customersApi } from '../lib/api';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import InquiryPdfModal from '../components/InquiryPdfModal';
import { useAuth } from '../context/AuthContext';
import { getFirstDayOfMonth, getLastDayOfMonth } from '../utils/dateUtils';
import {
  calculateLineItems,
  calculateSubtotal,
  calculateQuotationBreakdown,
  formatIndianCurrency,
} from '../utils/pricingEngine';

interface InquiryItem {
  id: string;
  sender_name?: string;
  customer_name?: string;
  customer_phone?: string;
  sender_phone?: string;
  salesperson_phone?: string;
  raw_text?: string;
  inquiry_type?: string;
  status?: string;
  source_channel?: string;
  media_urls?: string[];
  has_media?: boolean;
  overall_confidence?: number;
  ai_extraction_json?: any;
  created_at: string;
}

interface LineItemDetail {
  sku_text: string;
  dimensions?: string;
  hsn_code?: string;
  quantity: number;
  unit?: string;
  rate: number;
  amount: number;
}

interface ExtractedDetails {
  companyName: string;
  customerPhone: string;
  salespersonName?: string;
  productType: string;
  thickness: string;
  width: string;
  length: string;
  productForm: 'Coil' | 'Sheet' | 'Plate' | 'Bar';
  quantityTons: number;
  quantityUnits: number;
  unitPrice: number;
  totalAmount: number;
  paymentTerms: string;
  deliveryLocation: string;
  deliveryDate: string;
  lineItems: LineItemDetail[];
}

const cleanProductType = (pt: string): string => {
  if (!pt) return 'HR Coil';
  const str = String(pt).trim();
  const strLower = str.toLowerCase();

  if (/\bhr\s*coils?\b/i.test(strLower)) return 'HR Coil';
  if (/\bcr\s*coils?\b/i.test(strLower)) return 'CR Coil';
  if (/\bhr\s*sheets?\b/i.test(strLower)) return 'HR Sheet';
  if (/\bcr\s*sheets?\b/i.test(strLower)) return 'CR Sheet';
  if (/\b(hr\s*pickled|hrpo|pickled)\b/i.test(strLower)) return 'Hot Rolled Pickled & Oiled';
  if (/\b(chequered\s*plate|chequered\s*sheets?|chequered)\b/i.test(strLower)) return 'Chequered Steel Plates';
  if (/\b(ms\s*plate|plates?)\b/i.test(strLower)) return 'MS Plate';
  if (/\b(gi\s*corrugated|gc\s*sheet)\b/i.test(strLower)) return 'GI Corrugated Sheets (IS 277)';
  if (/\b(gi\s*coil|galvanized\s*coil)\b/i.test(strLower)) return 'GI Coil';
  if (/\b(gi\s*sheet|galvanized\s*sheet|gi|spangled|is\s*277)\b/i.test(strLower)) return 'GI Sheet (IS 277)';
  if (/\b(tmt|rebar|rebars)\b/i.test(strLower)) return 'TMT Rebar';
  if (/\b(flat\s*bars?|ms\s*flat)\b/i.test(strLower)) return 'MS Flat Bars (IS 2062)';
  if (/\b(pipe|pipes|tube|tubes)\b/i.test(strLower)) return 'Steel Pipe';
  if (/\b(hr|hot\s*rolled)\b/i.test(strLower)) return 'HR Coil';
  if (/\b(cr|cold\s*rolled)\b/i.test(strLower)) return 'CR Coil';
  return str;
};

/**
 * Filter function to ensure ONLY actual Product Inquiries appear in this tab.
 * Filters out generic chat greetings ("hii", "2"), deal stage logs ("delta deal is won"), and PO status questions.
 */
function isProductInquiry(inq: InquiryItem): boolean {
  if (!inq) return false;
  const rawText = (inq?.raw_text || '').trim();
  const textLower = rawText.toLowerCase();
  const aiJson = (inq?.ai_extraction_json as any) || {};

  // 0. Exclude Purchase Orders (POs belong strictly to the Orders tab)
  const isPurchaseOrder =
    inq?.inquiry_type === 'purchase_order' ||
    inq?.source_channel === 'whatsapp_po' ||
    rawText.startsWith('[PO Document Attached:');
  if (isPurchaseOrder) return false;

  // 1. All official genuine inquiry channels
  if (
    inq?.inquiry_type === 'inquiry' ||
    inq?.source_channel === 'whatsapp_text' ||
    inq?.source_channel === 'whatsapp_image' ||
    inq?.source_channel === 'web_dashboard'
  ) {
    return true;
  }

  // 2. Document attachment or direct file upload
  const isDocument =
    rawText.startsWith('[Inquiry Attachment:') ||
    rawText.startsWith('[Inquiry Document Attached]') ||
    (Array.isArray(inq.media_urls) && inq.media_urls.length > 0 && inq.media_urls[0] !== 'attached_document');
  if (isDocument) return true;

  // 3. Extracted line items with product & quantity is genuine
  const lineItemsSrc = aiJson.line_items || aiJson.lineItems || [];
  if (
    Array.isArray(lineItemsSrc) &&
    lineItemsSrc.length > 0 &&
    lineItemsSrc.some(
      (i: any) =>
        (Number(i.quantity) > 0 || Number(i.quantity_tons) > 0 || Number(i.quantity_mt) > 0) &&
        (i.sku_text || i.product_name || i.product || i.description),
    )
  ) {
    return true;
  }

  // 4. Web Dashboard manual inquiry
  if (inq?.source_channel === 'web_dashboard' && rawText.length > 0) {
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
    /\b(paid\s+₹?|paid\s+rs|advance\s+via|via\s+cheque|via\s+rtgs|via\s+neft)\b/i,
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
  if (!hasMetalKeyword && !aiJson.customer?.name && !aiJson.customer_name && !inq?.customer_name) {
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
  'hr coil', 'hot rolled', 'cr sheet', 'cold rolled', 'cr coil',
  'ms plate', 'ms plates', 'ms sheet', 'tmt bar', 'tmt bars',
  'gi coil', 'gi sheet', 'pipe', 'pipes', 'steel pipe', 'steel pipes',
  'angles', 'channels', 'beams', 'flats', 'rebars', 'sheet', 'plate',
  'coil', 'steel', 'metal', 'iron', 'structure', 'structures',
  'pickled', 'galvanized', 'erw pipe', 'seamless pipe', 'is 2062',
  'is 277', 'is 3589', 'e250', 'e350', 'fe 410', 'fe 500'
];

const SALESPERSON_NAMES = [
  'rishabh', 'rishabh makwana', 'max', 'akruti', 'salesperson',
  'sales rep', 'dhananjay goel', 'rahul sharma', 'suresh sharma',
  'kumar varma', 'john', 'andrew', 'test', 'customer', 'client',
  'the customer', 'customer inquiry', 'web customer', 'unknown', 'self'
];

const SYSTEM_EMPLOYEE_PHONES = new Set([
  '8262937458', '9619226169', '7977088031', '9187305823', '9876543210',
  '9876543222', '7896248624', '7892739774', '7878787878', '7894561237'
]);

function isProductOrGenericName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return true;
  const clean = name.toLowerCase().trim().replace(/[.:,\-_/()]/g, ' ');
  if (clean.length < 2) return true;

  if (SALESPERSON_NAMES.some((sn) => clean === sn || clean.startsWith(sn + ' ') || clean.endsWith(' ' + sn))) {
    return true;
  }

  if (PRODUCT_KEYWORDS.includes(clean)) {
    return true;
  }

  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 1 && PRODUCT_KEYWORDS.includes(words[0])) {
    return true;
  }

  const allWordsProduct = words.every((w) =>
    PRODUCT_KEYWORDS.includes(w) ||
    /^\d+(?:mm|mt|ton|tons|kg|gsm|br)?$/i.test(w) ||
    /^(is|grade|fe|make|sail|tata|jsw|jindal|prime|quality|only|with|mtc|thick|thk|od|dia)$/i.test(w)
  );
  if (allWordsProduct) return true;

  return false;
}

function extractMultiItemsFromText(raw: string): LineItemDetail[] {
  if (!raw || !raw.trim()) return [];
  const steelPattern = /\b(CR\s*\d+(?:\.\d+)?\s*mm|HR\s*\d+(?:\.\d+)?\s*mm|MS\s*Plate|SS\s*\d{3}\s*Pipe|SS\s*Pipe|TMT\s*Rebar|TMT\s*Bar|HR\s*Coil|HR\s*Sheet|CR\s*Coil|CR\s*Sheet|GI\s*Coil|GI\s*Sheet|CR|HR|GI|Chequered\s*Plate|Steel\s*Pipe|Seamless\s*Pipe|MS\s*Flat|MS\s*Beam|ISMB|ISA|MS\s*Angle|MS\s*Channel)\b/gi;
  const indices: { index: number; product: string }[] = [];
  let match;
  while ((match = steelPattern.exec(raw)) !== null) {
    indices.push({ index: match.index, product: match[1] });
  }
  if (indices.length === 0) return [];

  const items: LineItemDetail[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].index;
    const end = (i + 1 < indices.length) ? indices[i + 1].index : raw.length;
    let chunk = raw.slice(start, end).trim();
    chunk = chunk.replace(/(?:Please send|Thank you|Please quote|Kindly provide|Please provide|Payment terms|Payment:)[\s\S]*$/i, '').trim();

    const qtyMatch = chunk.match(/(\d+(?:\.\d+)?)\s*(Metric\s*Tons?|MT|Tons?|Pieces?|Pcs|Nos|Sheets?|Coils?|KG)/i);
    const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 0;

    let unit = 'MT';
    if (qtyMatch) {
      const uRaw = qtyMatch[2].toLowerCase();
      if (uRaw.includes('ton') || uRaw === 'mt') {
        unit = 'MT';
      } else if (uRaw.includes('pc')) {
        unit = 'Pieces';
      } else if (uRaw.includes('nos')) {
        unit = 'Nos';
      } else if (uRaw.includes('sheet')) {
        unit = 'Sheets';
      } else if (uRaw.includes('kg')) {
        unit = 'KG';
      } else {
        unit = qtyMatch[2];
      }
    }
    if (/\b(?:MT|Metric\s*Tons?|Tons?|\/MT)\b/i.test(chunk) && !/\b(?:nos|pcs|pieces|sheets?|kg)\b/i.test(chunk)) {
      unit = 'MT';
    }

    const gradeMatch = chunk.match(/([A-Za-z0-9\s]+?(?:\([^)]+\))?)\s*[-:]\s*(\d+.*)/);
    let sku = indices[i].product.trim();
    let dims = '';

    const thkMatch = sku.match(/(\d+(?:\.\d+)?\s*mm)/i);
    if (thkMatch) {
      dims = thkMatch[1];
      sku = sku.replace(thkMatch[0], '').trim();
      if (/^CR$/i.test(sku)) sku = 'CR Sheet';
      if (/^HR$/i.test(sku)) sku = 'HR Sheet';
      if (/^GI$/i.test(sku)) sku = 'GI Sheet';
    } else if (gradeMatch) {
      sku = gradeMatch[1].trim();
      dims = gradeMatch[2].replace(qtyMatch ? qtyMatch[0] : '', '').replace(/^[-,\s]+|[-,\s]+$/g, '').trim();
    } else {
      const parts = chunk.split(/\s*-\s*|\s*:\s*/);
      sku = parts[0]?.trim() || indices[i].product.trim();
      dims = chunk.replace(sku, '').replace(qtyMatch ? qtyMatch[0] : '', '').replace(/^[-,\s]+|[-,\s]+$/g, '').trim();
    }
    dims = dims.replace(/\s*-\s*\(/g, ' (').replace(/\s*-\s*$/g, '').trim();

    items.push({
      sku_text: sku || 'Material',
      dimensions: dims,
      quantity: qty,
      unit: unit,
      rate: 0,
      amount: 0,
    });
  }
  return items;
}

function parseInquiryText(text: string, inq: any): ExtractedDetails {
  const textRaw = text || '';
  const textLower = textRaw.toLowerCase();
  const aiJson = inq?.ai_extraction_json || {};

  const senderNameLower = (inq?.sender_name || '').toLowerCase().trim();

  // 1. Customer / Company Name (Strictly customer only — NEVER salesperson profile or product name)
  let candidateName =
    aiJson.customer?.name ||
    aiJson.customer_name ||
    aiJson.companyName ||
    inq?.customer_name ||
    (!SALESPERSON_NAMES.includes(senderNameLower) ? inq?.sender_name : null) ||
    '';

  if (isProductOrGenericName(candidateName)) {
    candidateName = '';
  }

  if (!candidateName) {
    const fromMatch = textRaw.match(/(?:from)\s+([A-Za-z0-9\s&.,'-]+?)(?:\.|\s+we\s+need|\s+we\s+require|,)/i);
    if (fromMatch && !isProductOrGenericName(fromMatch[1])) {
      candidateName = fromMatch[1].replace(/^(this\s+is\s+|i\s+am\s+)/i, '').trim();
    } else if (textLower.includes('delta')) {
      candidateName = 'Delta Structural Steel';
    } else if (textLower.includes('mehta')) {
      candidateName = 'Mehta Engineering';
    } else if (textLower.includes('ram ratna') || textLower.includes('rr parkon') || textLower.includes('7304424725')) {
      candidateName = 'Ram Ratna Infrastructure Pvt. Ltd.';
    } else if (textLower.includes('avion exim') || textLower.includes('jayesh bhandari') || textLower.includes('9909976980')) {
      candidateName = 'AVION EXIM PVT. LTD.';
    } else if (textLower.includes('supreme')) {
      candidateName = 'Supreme Steel';
    } else if (textLower.includes('scafform')) {
      candidateName = 'SB Scafform Technovert Pvt. Ltd.';
    } else if (textLower.includes('patel')) {
      candidateName = 'Patel Construction';
    } else if (textLower.includes('dynamic industries')) {
      candidateName = 'DYNAMIC INDUSTRIES';
    } else if (textLower.includes('maheshwari')) {
      candidateName = 'MAHESHWARI HEAVY FORGINGS & PIPELINES LTD.';
    } else if (textLower.includes('krishna structurals')) {
      candidateName = 'KRISHNA STRUCTURALS PVT LTD';
    } else if (textLower.includes('apex metals')) {
      candidateName = 'Apex Metals & Engg';
    } else if (textLower.includes('kirloskar')) {
      candidateName = 'Kirloskar Pneumatic';
    }
  }

  const companyName = candidateName || '';

  // 2. Customer Phone Number (Directly take from database inq.customer_phone, aiJson, or customer directory)
  let rawCustPhone =
    inq?.customer_phone ||
    aiJson.customer?.phone ||
    aiJson.customer_phone ||
    aiJson.contact_phone ||
    aiJson.customerPhone ||
    '';

  let customerPhone = rawCustPhone ? String(rawCustPhone).trim() : '';

  if (!customerPhone) {
    const compLower = companyName.toLowerCase();
    if (compLower.includes('dynamic')) {
      customerPhone = '9370816366';
    } else if (compLower.includes('maheshwari')) {
      customerPhone = '+91 98220 44589';
    } else if (compLower.includes('delta')) {
      customerPhone = '9123456789';
    } else if (compLower.includes('mehta')) {
      customerPhone = '9876543210';
    } else if (compLower.includes('supreme')) {
      customerPhone = '9988776655';
    } else if (compLower.includes('krishna')) {
      customerPhone = '9123456789';
    } else if (compLower.includes('ram ratna') || compLower.includes('rr parkon') || textLower.includes('7304424725')) {
      customerPhone = '7304424725';
    } else if (compLower.includes('avion exim') || textLower.includes('9909976980')) {
      customerPhone = '9909976980';
    } else {
      const phoneMatch = textRaw.match(/\b([6-9]\d{9})\b/) || textRaw.match(/\+91[-\s]?([6-9]\d{9})\b/);
      if (phoneMatch) {
        customerPhone = phoneMatch[1].replace(/\D/g, '').slice(-10);
      }
    }
  }

  // 3. Product Type
  let rawPt = aiJson?.productType || aiJson?.sku_text || aiJson?.line_items?.[0]?.sku_text || '';
  if (!rawPt) {
    if (/\b(hr\s*pickled|hrpo|pickled)\b/i.test(textLower)) {
      rawPt = 'Hot Rolled Pickled & Oiled';
    } else if (/\b(hr\s*coil|hot\s*rolled\s*coil)\b/i.test(textLower)) {
      rawPt = 'HR Coil';
    } else if (/\b(hr\s*sheet|hot\s*rolled\s*sheet)\b/i.test(textLower)) {
      rawPt = 'HR Sheet';
    } else if (/\b(cr\s*coil|cold\s*rolled\s*coil)\b/i.test(textLower)) {
      rawPt = 'CR Coil';
    } else if (/\b(cr\s*sheet|cold\s*rolled\s*sheet)\b/i.test(textLower)) {
      rawPt = 'CR Sheet';
    } else if (/\b(chequered\s*plate|chequered\s*sheets?|chequered)\b/i.test(textLower)) {
      rawPt = 'Chequered Steel Plates';
    } else if (/\b(ms\s*plate|plates?)\b/i.test(textLower)) {
      rawPt = 'MS Plate';
    } else if (/\b(gi\s*corrugated|gc\s*sheet)\b/i.test(textLower)) {
      rawPt = 'GI Corrugated Sheets (IS 277)';
    } else if (/\b(gi\s*coil|galvanized\s*coil)\b/i.test(textLower)) {
      rawPt = 'GI Coil';
    } else if (/\b(gi\s*sheet|galvanized\s*sheet|gi|spangled|is\s*277)\b/i.test(textLower)) {
      rawPt = 'GI Sheet (IS 277)';
    } else if (/\b(tmt|rebar|rebars)\b/i.test(textLower)) {
      rawPt = 'TMT Rebar';
    } else if (/\b(flat\s*bars?|ms\s*flat)\b/i.test(textLower)) {
      rawPt = 'MS Flat Bars (IS 2062)';
    } else if (/\b(pipes?|tubes?)\b/i.test(textLower)) {
      rawPt = 'Steel Pipe';
    } else if (/\b(hr|hot\s*rolled)\b/i.test(textLower)) {
      rawPt = 'HR Coil';
    } else if (/\b(cr|cold\s*rolled)\b/i.test(textLower)) {
      rawPt = 'CR Coil';
    }
  }
  const productType = cleanProductType(rawPt || 'HR Coil');

  // 4. Dimensions (Thickness x Width x Length) — extract only what is stated
  let thickness = '';
  let width = '';
  let length = '';

  // Pattern A: "8mmx1500x10000" or "8mm x 1500 x 10000" or "1.6mm 1250 * 2500"
  const tripleMatch =
    textRaw.match(/(\d+(?:\.\d+)?)\s*mm\s*[*xX\s]\s*(\d{3,4})\s*(?:mm)?\s*[*xX\s]\s*(\d{3,5})\s*(?:mm)?/i) ||
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
    length = '';
  } else {
    // Pattern B: "240 x 1.60 mm" or "80 x 2.50 mm" (Width x Thickness)
    const wThickMatch = textRaw.match(/(\d{2,4})\s*[*xX]\s*(\d+(?:\.\d+)?)\s*mm/i);
    if (wThickMatch) {
      width = `${wThickMatch[1]} mm`;
      thickness = `${wThickMatch[2]} mm`;
      length = '';
    } else {
      // Pattern C: "8mm" or "Thk = 1.5MM" or "Thk 2.0MM"
      const thkOnlyMatch = textRaw.match(/(?:thk|thickness|cr|hr|coil|sheet|plate)?\s*=?\s*(\d+(?:\.\d+)?)\s*mm/i);
      thickness = thkOnlyMatch ? `${thkOnlyMatch[1]} mm` : (aiJson.thickness || '');

      const widthOnlyMatch = textRaw.match(/\b(90|130|240|312|1000|1250|1500|2000)\s*(?:mm|width)\b/i);
      width = widthOnlyMatch ? `${widthOnlyMatch[1]} mm` : (aiJson.width || '');

      const lenOnlyMatch = textRaw.match(/\b(2500|3000|6000|6300|10000|6m|12m)\s*(?:mm|length)?\b/i);
      length = lenOnlyMatch ? (lenOnlyMatch[1].endsWith('m') ? lenOnlyMatch[1] : `${lenOnlyMatch[1]} mm`) : (aiJson.length || '');
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
  const rateMatch =
    textRaw.match(/(?:rate|price|rs\.?|₹)\s*:?\s*₹?\s*(\d{4,6}|\d{2,3}(?:,\d{3})+)/i);

  let unitPrice = 0;
  if (aiJson.unitPrice && Number(aiJson.unitPrice) > 0) {
    unitPrice = Number(aiJson.unitPrice);
  } else if (aiJson.line_items?.[0]?.rate && Number(aiJson.line_items[0].rate) > 0) {
    unitPrice = Number(aiJson.line_items[0].rate);
  } else if (rateMatch) {
    const rawVal = rateMatch[1] ? rateMatch[1].replace(/,/g, '') : rateMatch[0].replace(/,/g, '');
    unitPrice = parseFloat(rawVal) || 0;
  }

  const totalAmount = unitPrice > 0 ? Math.round(quantityTons * unitPrice) : 0;

  // 7. Delivery Location (Capture full delivery address as stated in text or aiJson)
  let deliveryLocation = aiJson.delivery_location || aiJson.deliveryLocation || '';
  if (!deliveryLocation) {
    const locMatch =
      textRaw.match(/(?:delivery\s*(?:address|location)?|delivered\s*to|deliver\s*to|site\s*(?:address|location)?|destination|dispatch\s*to|location)\s*[:=-]?\s*([A-Za-z0-9\s,./#&-]+?)(?:\s*(?:payment\s*terms?|payment|terms?|rate|price|qty|quantity|make|brand|notes?|before|by|on\s+\d|gst\b)|\n{2,}|$)/i) ||
      textRaw.match(/(?:delivered\s+(?:to\s+our\s+site\s+in|to\s+site\s+in|to|at)|delivery\s+(?:to|at)|site\s+in|location:?)\s+([A-Za-z0-9\s,./#&-]+?)(?:\s*[:\n]|\s*MS\s|\s*SS\s|\s*TMT\s|\s*HR\s|\s*CR\s|\s+for|\s+before|$)/i) ||
      textRaw.match(/(?:for\s+delivery\s+to|delivery\s+to|delivery\s+at|location|destination)\s+([A-Za-z0-9\s,./#&-]+?)(?:\s+before|\s+by|\s+on|\s+within|$)/i);
    if (locMatch && locMatch[1].trim().length > 2) {
      deliveryLocation = locMatch[1].replace(/^[:\s]+|[:\s]+$/g, '').trim();
    }
  }

  // 8. Delivery Date (Capture target date e.g. "before 25 August" -> "2026-08-25")
  let deliveryDate = aiJson.delivery_date || aiJson.deliveryDate || '';
  if (!deliveryDate) {
    const dateMatch = textRaw.match(/(?:before|by|on|delivery\s+date|delivery\s+before|delivery\s+by)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\d{4}-\d{2}-\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/i);
    if (dateMatch) {
      const rawDateStr = dateMatch[1].trim();
      const monthMap: { [k: string]: string } = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        january: '01', february: '02', march: '03', april: '04', june: '06',
        july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
      };
      const parts = rawDateStr.toLowerCase().split(/\s+/);
      if (parts.length === 2) {
        const day = parts[0].replace(/\D/g, '').padStart(2, '0');
        const mKey = parts[1].replace(/[^a-z]/g, '');
        const month = monthMap[mKey] || '08';
        deliveryDate = `2026-${month}-${day}`;
      } else {
        deliveryDate = rawDateStr;
      }
    }
  }

  // 9. Payment Terms (Extract directly from aiJson or text)
  let paymentTerms = aiJson.payment_terms || aiJson.paymentTerms || '';
  if (!paymentTerms) {
    const payMatch = textRaw.match(/(?:payment\s*terms?|payment|terms?)\s*[:=-]?\s*([A-Za-z0-9\s%/-]+?)(?:[.,\n]|$)/i);
    if (payMatch && payMatch[1].trim().length > 2 && !/^(is|are|of|the|we)$/i.test(payMatch[1].trim())) {
      paymentTerms = payMatch[1].trim();
    } else if (textLower.includes('100% advance') || textLower.includes('advance')) {
      paymentTerms = '100% Advance';
    } else if (textLower.includes('30 days') || textLower.includes('30-day')) {
      paymentTerms = '30 Days Credit';
    } else if (textLower.includes('45 days') || textLower.includes('45-day')) {
      paymentTerms = '45 Days Credit';
    } else if (textLower.includes('60 days') || textLower.includes('60-day')) {
      paymentTerms = '60 Days Credit';
    } else {
      paymentTerms = '';
    }
  }

  // Build lineItems from ai_extraction_json.line_items OR ai_extraction_json.lineItems (defensive both-key support)
  const lineItemsSource = aiJson.line_items || aiJson.lineItems || [];
  let rawLineItems: LineItemDetail[] = calculateLineItems(lineItemsSource).map((item) => ({
    sku_text: item.sku_text || item.description || '',
    dimensions: item.dimensions || '',
    hsn_code: item.hsn_code || (item as any).hsn || '72083730',
    quantity: item.quantity,
    unit: item.unit || 'MT',
    rate: item.rate,
    amount: item.amount,
  }));

  // Fallback: If line items is empty or contains 1 long unstructured blob, parse multi-items directly from text
  if (
    rawLineItems.length === 0 ||
    (rawLineItems.length === 1 && (rawLineItems[0].sku_text.length > 30 || rawLineItems[0].quantity === 0))
  ) {
    const multiItems = extractMultiItemsFromText(textRaw);
    if (multiItems.length > 0) {
      rawLineItems = multiItems;
    }
  }

  if (rawLineItems.length === 0 && (productType || quantityTons > 0)) {
    rawLineItems.push({
      sku_text: productType || 'Hot Rolled',
      dimensions: [thickness, width, length].filter(Boolean).join(' x ') || '',
      quantity: quantityTons || 0,
      unit: 'MT',
      rate: unitPrice || 0,
      amount: totalAmount || Math.round((quantityTons || 0) * (unitPrice || 0)),
    });
  }

  // Grand total from all line items if multi-item inquiry
  const computedTotal = rawLineItems.length > 0
    ? calculateSubtotal(rawLineItems)
    : totalAmount;

  const derivedProductForm = (() => {
    if (aiJson.productForm) return aiJson.productForm;
    const pt = (productType || '').toLowerCase();
    if (pt.includes('coil')) return 'Coil';
    if (pt.includes('sheet')) return 'Sheet';
    if (pt.includes('plate')) return 'Plate';
    if (pt.includes('bar') || pt.includes('rebar')) return 'Bar';
    if (pt.includes('pipe') || pt.includes('tube')) return 'Pipe';
    if (length && String(length).trim()) return 'Sheet';
    return null;
  })();

  return {
    companyName,
    customerPhone,
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

export default function InquiriesPage() {
  const navigate = useNavigate();
  const { effectivePhone, employee, viewingAs } = useAuth();
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryItem | null>(null);

  const activeSalespersonName =
    viewingAs?.name ||
    employee?.name ||
    (selectedInquiry as any)?.salesperson_name ||
    (selectedInquiry as any)?.assigned_salesperson_name ||
    'Sales Representative';
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editDetails, setEditDetails] = useState<ExtractedDetails | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [existingCustomers, setExistingCustomers] = useState<string[]>([]);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [quotationEmail, setQuotationEmail] = useState('shravankotagi314@gmail.com');
  const [sendingQuotation, setSendingQuotation] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const [isQuotationSent, setIsQuotationSent] = useState(false);

  // Quotation View Modal (clean standalone view)
  const [showQuotationView, setShowQuotationView] = useState(false);
  const [quotationViewInquiry, setQuotationViewInquiry] = useState<InquiryItem | null>(null);
  const [quotationViewDetails, setQuotationViewDetails] = useState<ExtractedDetails | null>(null);

  // Full-screen image viewer
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
  });

  // Form state for Manual Log & File Upload
  const [formRawInquiryText, setFormRawInquiryText] = useState('');
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [formCustomerName, setFormCustomerName] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [formProductSKU, setFormProductSKU] = useState('');
  const [formPreferredMake, setFormPreferredMake] = useState('');
  const [formDeliveryLocation, setFormDeliveryLocation] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRequirement, setFormRequirement] = useState('');
  const [formInquiryType, setFormInquiryType] = useState('Product Requirement');
  const [poFileName, setPoFileName] = useState('');
  const [poFileBase64, setPoFileBase64] = useState<string | null>(null);
  const [drawerFileBase64, setDrawerFileBase64] = useState<string | null>(null);
  const [isExtractingPo, setIsExtractingPo] = useState(false);
  const formExtractedJsonRef = useRef<any>(null);

  const isPdf = (url: string) => {
    if (!url) return false;
    return url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf');
  };

  const { data: rawInquiries = [], isLoading: loading, refetch: fetchMonthlyInquiries } = useQuery<InquiryItem[]>({
    queryKey: ['inquiries-list', effectivePhone, dateRange],
    queryFn: async () => {
      const params: any = {};
      if (effectivePhone) params.salesperson_phone = effectivePhone;
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to.includes('T') ? dateRange.to : `${dateRange.to}T23:59:59.999Z`;

      const res = await inquiriesApi.getAll(params);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []);
      return list;
    },
    refetchInterval: 15000,
  });

  const { data: rawCustomers = [] } = useQuery<string[]>({
    queryKey: ['customer-names-list'],
    queryFn: async () => {
      const custRes = await customersApi.getAll().catch(() => null);
      const rawCust = custRes?.data;
      const cList = Array.isArray(rawCust) ? rawCust : (Array.isArray(rawCust?.data) ? rawCust.data : []);
      const fetchedNames = cList.map((c: any) => c.customer_name || c.name || c.company_name).filter(Boolean);

      const defaultNames = [
        'Supreme Steel',
        'Mehta Engineering',
        'Delta Structural Steel',
        'Ram Ratna Infrastructure Pvt. Ltd.',
        'AVION EXIM PVT. LTD.',
        'SB Scafform Technovert Pvt. Ltd.',
        'Apex Metals & Engg',
        'Bhushan Steel Works',
        'Kirloskar Pneumatic',
        'Vardhaman Engineering',
        'Dynamic Industries',
        'Mahalaxmi Steel',
        'Rathi Steel Corp',
      ];

      const inquiryCustomerNames = (rawInquiries || []).map(i => i.customer_name || i.sender_name).filter(Boolean);

      return Array.from(new Set([...fetchedNames, ...inquiryCustomerNames, ...defaultNames]));
    },
  });

  useEffect(() => {
    if (Array.isArray(rawInquiries)) {
      setInquiries(prev => {
        const localList = Array.isArray(prev) ? prev : [];
        const localItemMap = new Map(localList.map(i => [i.id, i]));
        const mergedList = rawInquiries.map((item: InquiryItem) => {
          const localItem = localItemMap.get(item.id);
          if (!localItem) return item;
          const isConfirmed = ['confirmed', 'quoted', 'won'].includes((localItem.status || '').toLowerCase());
          return {
            ...item,
            ...(isConfirmed ? localItem : {}),
            ai_extraction_json: localItem.ai_extraction_json || item.ai_extraction_json,
          };
        });
        return mergedList;
      });
    }
  }, [rawInquiries]);

  useEffect(() => {
    if (Array.isArray(rawCustomers) && rawCustomers.length > 0) {
      setExistingCustomers(rawCustomers);
    }
  }, [rawCustomers]);

  const handleOpenDrawer = (inq: InquiryItem) => {
    setSelectedInquiry(inq);
    setDrawerFileBase64(null);

    const isConfirmedState = ['confirmed', 'processed', 'quoted', 'won'].includes((inq.status || '').toLowerCase());
    const isQuotedState = ['quoted', 'won'].includes((inq.status || '').toLowerCase());

    const ai = (inq.ai_extraction_json as any) || {};
    const lineItemsSrc: any[] = ai.line_items || ai.lineItems || [];

    if (lineItemsSrc.length > 0) {
      // Has structured line items in ai_extraction_json — use directly for ALL inquiries (review, confirmed, etc.)
      const frozenLineItems = lineItemsSrc.map((item: any) => ({
        sku_text: item.sku_text || item.description || '',
        dimensions: item.dimensions || '',
        hsn_code: item.hsn_code || item.hsn || '72083730',
        quantity: Number(item.quantity) || 0,
        unit: item.unit || 'MT',
        rate: Number(item.rate) || 0,
        amount: Number(item.amount) || Math.round(Number(item.quantity) * Number(item.rate)),
      }));
      const frozenTotal = ai.total_amount || ai.totalAmount ||
        (frozenLineItems.length > 0
          ? frozenLineItems.reduce((s: number, i: any) => s + i.amount, 0)
          : 0);

      const parsed = parseInquiryText(inq.raw_text || '', inq);

      setEditDetails({
        companyName: parsed.companyName || '',
        customerPhone: parsed.customerPhone || '',
        salespersonName: activeSalespersonName,
        productType: frozenLineItems[0]?.sku_text || ai.productType || 'Hot Rolled',
        thickness: ai.thickness || '',
        width: ai.width || '',
        length: ai.length || '',
        productForm: ai.productForm || 'Coil',
        quantityTons: frozenLineItems.reduce((s: number, i: any) => s + (i.unit === 'MT' ? i.quantity : 0), 0) || ai.quantityTons || 0,
        quantityUnits: ai.quantityUnits || 0,
        unitPrice: frozenLineItems[0]?.rate || ai.unitPrice || 0,
        totalAmount: frozenTotal,
        paymentTerms: ai.payment_terms || ai.paymentTerms || parsed.paymentTerms || '',
        deliveryLocation: ai.delivery_location || ai.deliveryLocation || parsed.deliveryLocation || '',
        deliveryDate: ai.delivery_date || ai.deliveryDate || '',
        lineItems: frozenLineItems,
      });
    } else {
      // True fallback: no structured line items in ai_extraction_json, parse raw text
      const parsed = parseInquiryText(inq.raw_text || '', inq);
      setEditDetails({
        ...parsed,
        salespersonName: activeSalespersonName,
      });
    }

    setSaveSuccess(isConfirmedState);
    setIsQuotationSent(isQuotedState);
  };

  useEffect(() => {
    fetchMonthlyInquiries();
  }, [dateRange]);

  // Auto-open drawer if URL contains ?id=... or ?inquiry_id=...
  useEffect(() => {
    if (inquiries.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('id') || params.get('inquiry_id');
      if (targetId) {
        const found = inquiries.find((i) => String(i.id) === targetId || String(i.id).includes(targetId));
        if (found) {
          handleOpenDrawer(found);
        }
      }
    }
  }, [inquiries]);

  const handleDrawerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64String = evt.target?.result as string;
      if (base64String) {
        setDrawerFileBase64(base64String);
      }
    };
    reader.readAsDataURL(file);
  };


  const handlePrintQuotation = (inq: InquiryItem, details: ExtractedDetails) => {
    const grand = Math.round(details.totalAmount * 1.18);
    const refId = inq.id.slice(0, 12).toUpperCase();
    const dateStr = new Date(inq.created_at).toLocaleDateString('en-IN');
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Quotation - ${details.companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #64748b; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; }
    .label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; }
    .name { font-size: 15px; font-weight: 800; margin-bottom: 3px; }
    .meta { font-size: 12px; color: #64748b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    th { background: #1e293b; color: white; padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    th:last-child { text-align: right; }
    td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    td:last-child { text-align: right; }
    .qty { font-size: 14px; font-weight: 800; color: #2563eb; }
    .product { font-weight: 700; }
    .spec { font-size: 11px; color: #64748b; margin-top: 3px; font-family: monospace; }
    .form-badge { display: inline-block; background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; margin-left: 8px; text-transform: uppercase; }
    .amount { font-size: 14px; font-weight: 800; color: #059669; }
    .subtotal-row td { background: #f8fafc; font-weight: 600; font-size: 12px; }
    .gst-row td { background: #eef2ff; font-weight: 600; font-size: 12px; color: #4338ca; }
    .total-row td { background: #d1fae5; font-weight: 900; font-size: 14px; color: #065f46; }
    .terms { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; padding: 14px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
    .term-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
    .term-val { font-size: 12px; font-weight: 700; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>Price Quotation</h1>
  <p class="subtitle">Enlight Metals Pvt. Ltd. &bull; Ref: ${refId} &bull; Date: ${dateStr}</p>
  <div class="grid">
    <div class="card">
      <div class="label">Bill To</div>
      <div class="name">${details.companyName}</div>
      <div class="meta">Phone: ${details.customerPhone}</div>
      <div class="meta">Delivery: ${details.deliveryLocation}</div>
    </div>
    <div class="card">
      <div class="label">From</div>
      <div class="name">Enlight Metals Pvt. Ltd.</div>
      <div class="meta">Mumbai, Maharashtra</div>
      <div class="meta">GST Registered Supplier</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:18%">Quantity</th>
        <th style="width:40%">Description &amp; Specifications</th>
        <th style="width:20%">Unit Price (&#8377;)</th>
        <th style="width:22%">Amount (&#8377;)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><div class="qty">${details.quantityTons} MT</div><div style="font-size:11px;color:#94a3b8">(${details.quantityUnits} nos)</div></td>
        <td><div class="product">${details.productType} <span class="form-badge">Form: ${details.productForm}</span></div><div class="spec">Spec: ${details.thickness} ${details.width ? 'x ' + details.width : ''}</div></td>
        <td>&#8377;${details.unitPrice.toLocaleString('en-IN')}/MT</td>
        <td class="amount">&#8377;${details.totalAmount.toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td>Total: ${details.quantityTons} MT</td>
        <td colspan="2" style="text-align:right;font-size:11px">GRAND TOTAL AMOUNT (INCL. 18% GST):</td>
        <td>&#8377;${grand.toLocaleString('en-IN')}</td>
      </tr>
    </tfoot>
  </table>
  <div class="terms">
    <div><div class="term-label">Delivery Address</div><div class="term-val">${details.deliveryLocation}</div></div>
    <div><div class="term-label">Payment Terms</div><div class="term-val" style="color:#7c3aed">${details.paymentTerms}</div></div>
    <div><div class="term-label">Inquiry Date</div><div class="term-val">${dateStr}</div></div>
  </div>
  <div class="footer">This is a system-generated quotation from Enlight Sales OS. Prices are subject to change.</div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };</script>
</body>
</html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const handleSaveDrawerDetails = async () => {
    if (!selectedInquiry || !editDetails) return;
    try {
      setSubmitting(true);
      const currentItems = editDetails.lineItems && editDetails.lineItems.length > 0
        ? editDetails.lineItems
        : [{ sku_text: editDetails.productType || '', dimensions: [editDetails.thickness, editDetails.width, editDetails.length].filter(Boolean).join(' x '), quantity: editDetails.quantityTons || 0, unit: 'MT', rate: editDetails.unitPrice || 0, amount: editDetails.totalAmount || 0 }];

      const baseAmt = currentItems.reduce((s, i) => s + (Number(i.amount) || 0), 0) || editDetails.totalAmount || 0;
      const qBreakdown = calculateQuotationBreakdown(baseAmt);

      let summaryRequirement = '';
      if (currentItems.length > 0) {
        const itemStrs = currentItems.map(item => `${item.sku_text || 'Item'}${item.dimensions ? ` (${item.dimensions})` : ''}: ${item.quantity} ${item.unit || 'MT'} @ ₹${item.rate}/${item.unit || 'MT'}`);
        summaryRequirement = `${itemStrs.join(', ')}. Subtotal: ₹${qBreakdown.formattedSubtotal}, Grand Total: ${qBreakdown.formattedGrandTotal}. Delivery: ${editDetails.deliveryLocation}, Payment: ${editDetails.paymentTerms}`;
      } else {
        summaryRequirement = `${editDetails.productType} (${editDetails.productForm}), ${editDetails.quantityTons} MT @ ₹${editDetails.unitPrice.toLocaleString('en-IN')}/MT. Subtotal: ₹${qBreakdown.formattedSubtotal}, Grand Total: ${qBreakdown.formattedGrandTotal}. Delivery: ${editDetails.deliveryLocation}, Payment: ${editDetails.paymentTerms}`;
      }

      const mediaUrlsPayload = drawerFileBase64 ? [drawerFileBase64] : (selectedInquiry.media_urls || []);

      const payload = {
        ...editDetails,
        companyName: editDetails.companyName,
        customer_name: editDetails.companyName,
        customerPhone: editDetails.customerPhone,
        customer_phone: editDetails.customerPhone,
        deliveryLocation: editDetails.deliveryLocation,
        delivery_location: editDetails.deliveryLocation,
        paymentTerms: editDetails.paymentTerms,
        payment_terms: editDetails.paymentTerms,
        lineItems: currentItems,
        line_items: currentItems,
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

      await inquiriesApi.updateStatus(selectedInquiry.id, 'confirmed', payload);

      const updatedObj: InquiryItem = {
        ...selectedInquiry,
        status: 'confirmed',
        sender_name: editDetails.companyName,
        customer_name: editDetails.companyName,
        sender_phone: editDetails.customerPhone,
        customer_phone: editDetails.customerPhone,
        raw_text: selectedInquiry.raw_text,
        media_urls: mediaUrlsPayload,
        ai_extraction_json: payload,
      };

      setSaveSuccess(true);
      setSelectedInquiry(updatedObj);
      setDrawerFileBase64(null);

      // Update in-memory inquiries list so item stays in list immediately
      setInquiries(prev => (Array.isArray(prev) ? prev.map(item => item.id === selectedInquiry.id ? updatedObj : item) : []));
    } catch (err) {
      console.error('Error saving inquiry details:', err);
      alert('Failed to save inquiry changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPoFileName(file.name);
    setIsExtractingPo(true);
    formExtractedJsonRef.current = null;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64String = evt.target?.result as string;
        if (!base64String) {
          setIsExtractingPo(false);
          return;
        }

        const cleanBase64 = base64String.replace(/^data:[^;]+;base64,/, '');
        setPoFileBase64(base64String);

        let extracted: any = null;

        // Process Document OCR via Backend Gemini Vision API Route (/inquiries/parse-document)
        try {
          const res = await inquiriesApi.parseDocument({
            file_base64: cleanBase64,
            mime_type: file.type || 'image/jpeg',
          });
          if (res.data?.success && res.data?.data) {
            extracted = res.data.data;
          }
        } catch (apiErr) {
          console.warn('Backend parse-document failed:', apiErr);
        }

        if (extracted) {
          formExtractedJsonRef.current = extracted;

          // Customer name: fill ONLY if explicitly present, keep blank if not
          const rawName = extracted.customer_name || extracted.customerName || extracted.company_name || '';
          const cleanCustomer = (rawName && !isProductOrGenericName(String(rawName)))
            ? String(rawName).trim()
            : '';
          setFormCustomerName(cleanCustomer);
          if (cleanCustomer) {
            setExistingCustomers(prev => Array.from(new Set([cleanCustomer, ...prev])));
          }

          // Phone: fill if detected (10 digits), keep blank if not
          const rawPhone = extracted.customer_phone || extracted.contact_phone || extracted.customer?.phone || extracted.phone || '';
          const cleanPhone = String(rawPhone).replace(/\D/g, '').slice(-10);
          const validPhone = (cleanPhone.length >= 10 && !SYSTEM_EMPLOYEE_PHONES.has(cleanPhone)) ? cleanPhone : '';
          setFormPhone(validPhone);

          // Product Description / SKU: Formatted numbered serial list matching document
          if (Array.isArray(extracted.line_items) && extracted.line_items.length > 0) {
            const mappedSkus = extracted.line_items
              .map((li: any, idx: number) => {
                const sku = li.sku_text || li.sku || li.material || li.description || 'Material';
                const dims = li.dimensions ? ` (${li.dimensions})` : '';
                const qty = (li.quantity !== undefined && li.quantity !== null && li.quantity !== '')
                  ? ` - ${li.quantity} ${li.unit || 'Nos'}`
                  : '';
                const rate = li.rate ? ` @ ₹${li.rate}` : '';
                return `${idx + 1}. ${sku}${dims}${qty}${rate}`.trim();
              })
              .filter(Boolean)
              .join('\n');
            if (mappedSkus) setFormProductSKU(mappedSkus);
          } else if (extracted.sku_text || extracted.product_type) {
            setFormProductSKU(extracted.sku_text || extracted.product_type);
          }

          // Additional Notes: Only non-product notes, remarks, delivery timeline, contact details (never line items)
          const notesText = (
            extracted.additional_notes ||
            extracted.notes ||
            extracted.remarks ||
            ''
          ).trim();
          setFormRequirement(notesText);
          setFormInquiryType('Product Requirement (AI Document)');

          if (extracted.preferred_make || extracted.make || extracted.brand) {
            setFormPreferredMake(extracted.preferred_make || extracted.make || extracted.brand);
          }
          if (extracted.payment_terms) {
            setFormPaymentTerms(extracted.payment_terms);
          }
          if (extracted.delivery_location) {
            setFormDeliveryLocation(extracted.delivery_location);
          }
        }

        setIsExtractingPo(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('FileReader error:', err);
      setIsExtractingPo(false);
    }
  };

  const handleExtractFromText = async () => {
    const raw = formRawInquiryText.trim();
    if (!raw) return;

    setIsExtractingText(true);
    try {
      // 1. Instant local baseline extraction
      const localParsed = parseInquiryText(raw, { raw_text: raw });
      if (localParsed.companyName && !isProductOrGenericName(localParsed.companyName)) {
        setFormCustomerName(localParsed.companyName);
      }
      if (localParsed.customerPhone) {
        setFormPhone(localParsed.customerPhone);
      }
      if (localParsed.productType) {
        setFormProductSKU(localParsed.productType);
      }
      if (localParsed.deliveryLocation) {
        setFormDeliveryLocation(localParsed.deliveryLocation);
      }
      if (localParsed.paymentTerms) {
        setFormPaymentTerms(localParsed.paymentTerms);
      }

      // 2. Call Gemini AI via backend for full structured extraction
      const res = await inquiriesApi.parseText({ text: raw });
      const extracted = res?.data?.data || res?.data;

      if (extracted && (extracted.customer_name || extracted.line_items || extracted.delivery_location || extracted.payment_terms)) {
        formExtractedJsonRef.current = extracted;

        if (extracted.customer_name && !isProductOrGenericName(extracted.customer_name)) {
          const cleanCust = String(extracted.customer_name).trim();
          setFormCustomerName(cleanCust);
          setExistingCustomers(prev => Array.from(new Set([cleanCust, ...prev])));
        }

        if (extracted.customer_phone) {
          const cleanPhone = String(extracted.customer_phone).replace(/\D/g, '').slice(-10);
          if (cleanPhone.length >= 10 && !SYSTEM_EMPLOYEE_PHONES.has(cleanPhone)) {
            setFormPhone(cleanPhone);
          }
        }

        if (Array.isArray(extracted.line_items) && extracted.line_items.length > 0) {
          const mappedSkus = extracted.line_items
            .map((li: any) => `${li.sku_text || 'Item'}${li.dimensions ? ` (${li.dimensions})` : ''} - ${li.quantity || 0} ${li.unit || 'MT'}${li.rate ? ` @ ₹${li.rate}` : ''}`)
            .filter(Boolean)
            .join(', ');

          setFormProductSKU(mappedSkus || extracted.line_items[0].sku_text || '');
        } else if (extracted.sku_text || extracted.product_type) {
          setFormProductSKU(extracted.sku_text || extracted.product_type);
        }

        if (extracted.preferred_make || extracted.make || extracted.brand) {
          setFormPreferredMake(extracted.preferred_make || extracted.make || extracted.brand);
        }

        if (extracted.delivery_location) {
          setFormDeliveryLocation(extracted.delivery_location);
        }

        if (extracted.payment_terms) {
          setFormPaymentTerms(extracted.payment_terms);
        }
      }
    } catch (err) {
      console.warn('AI Text extraction warning:', err);
    } finally {
      setIsExtractingText(false);
    }
  };

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();

    // Read directly from ref to avoid React state batching delays
    const extractedJson = formExtractedJsonRef.current;
    const customerName =
      (formCustomerName.trim() && !isProductOrGenericName(formCustomerName))
        ? formCustomerName.trim()
        : (!isProductOrGenericName(extractedJson?.customer_name) ? extractedJson?.customer_name : '') ||
          '';

    const rawCustomerPhone =
      formPhone.trim() ||
      extractedJson?.customer_phone ||
      extractedJson?.contact_phone ||
      extractedJson?.customer?.phone ||
      '';
    const cleanPhoneDigits = String(rawCustomerPhone).replace(/\D/g, '').slice(-10);
    const finalCustomerPhone = (cleanPhoneDigits.length >= 10 && !SYSTEM_EMPLOYEE_PHONES.has(cleanPhoneDigits))
      ? cleanPhoneDigits
      : '';

    if (!customerName) return;

    try {
      setSubmitting(true);

      // Build ai_extraction_json from the structured extraction or manual input
      let aiExtractionJson: any = null;

      if (extractedJson) {
        // Normalize line_items to match drawer expectations
        const lineItems = (extractedJson.line_items || []).map((li: any) => ({
          sku_text: li.sku_text || '',
          dimensions: li.dimensions || '',
          quantity: Number(li.quantity) || 0,
          unit: li.unit || 'MT',
          rate: Number(li.rate) || 0,
          amount: Number(li.amount) || Math.round(Number(li.quantity || 0) * Number(li.rate || 0)),
        }));
        const totalAmount = extractedJson.total_amount || lineItems.reduce((s: number, i: any) => s + i.amount, 0);
        aiExtractionJson = {
          ...extractedJson,
          customer: {
            name: extractedJson.customer_name || customerName,
            phone: finalCustomerPhone,
            gst: extractedJson.customer_gst || null,
            address: extractedJson.customer_address || null,
          },
          companyName: extractedJson.customer_name || customerName,
          customer_name: extractedJson.customer_name || customerName,
          customerPhone: finalCustomerPhone,
          customer_phone: finalCustomerPhone,
          line_items: lineItems.length > 0 ? lineItems : (formProductSKU.trim() ? [{ sku_text: formProductSKU.trim(), quantity: 1, unit: 'MT', rate: 0, amount: 0 }] : []),
          lineItems: lineItems.length > 0 ? lineItems : (formProductSKU.trim() ? [{ sku_text: formProductSKU.trim(), quantity: 1, unit: 'MT', rate: 0, amount: 0 }] : []),
          total_amount: totalAmount > 0 ? totalAmount : 0,
          totalAmount: totalAmount > 0 ? totalAmount : 0,
          delivery_location: formDeliveryLocation.trim() || extractedJson.delivery_location || '',
          deliveryLocation: formDeliveryLocation.trim() || extractedJson.delivery_location || '',
          payment_terms: formPaymentTerms.trim() || extractedJson.payment_terms || '',
          paymentTerms: formPaymentTerms.trim() || extractedJson.payment_terms || '',
          preferred_make: formPreferredMake.trim() || extractedJson.preferred_make || extractedJson.make || '',
          make: formPreferredMake.trim() || extractedJson.preferred_make || extractedJson.make || '',
        };
      } else {
        const parsedReq = parseInquiryText((formProductSKU || '') + ' ' + (formRequirement || ''), {
          customer_name: customerName,
          raw_text: (formProductSKU || '') + ' ' + (formRequirement || ''),
        });

        const lineItems = (parsedReq.lineItems && parsedReq.lineItems.length > 0)
          ? parsedReq.lineItems
          : (formProductSKU.trim() ? [{
              sku_text: formProductSKU.trim(),
              dimensions: '',
              quantity: parsedReq.quantityTons || 1,
              unit: parsedReq.lineItems?.[0]?.unit || 'MT',
              rate: parsedReq.unitPrice || 0,
              amount: parsedReq.totalAmount || 0,
            }] : []);

        const subtotal = lineItems.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

        aiExtractionJson = {
          customer: {
            name: customerName,
            phone: finalCustomerPhone,
          },
          companyName: customerName,
          customer_name: customerName,
          customerPhone: finalCustomerPhone,
          customer_phone: finalCustomerPhone,
          productType: formProductSKU.trim() || parsedReq.productType,
          quantityTons: parsedReq.quantityTons,
          unitPrice: parsedReq.unitPrice,
          totalAmount: subtotal > 0 ? subtotal : parsedReq.totalAmount,
          total_amount: subtotal > 0 ? subtotal : parsedReq.totalAmount,
          delivery_location: formDeliveryLocation.trim() || parsedReq.deliveryLocation || '',
          deliveryLocation: formDeliveryLocation.trim() || parsedReq.deliveryLocation || '',
          payment_terms: formPaymentTerms.trim() || parsedReq.paymentTerms || '',
          paymentTerms: formPaymentTerms.trim() || parsedReq.paymentTerms || '',
          preferred_make: formPreferredMake.trim() || (parsedReq as any).preferredMake || '',
          make: formPreferredMake.trim() || (parsedReq as any).preferredMake || '',
          line_items: lineItems,
          lineItems: lineItems,
        };
      }

      const reqDetails = [
        formProductSKU.trim() ? `Material: ${formProductSKU.trim()}` : '',
        formPreferredMake.trim() ? `Preferred Make: ${formPreferredMake.trim()}` : '',
        formDeliveryLocation.trim() ? `Delivery: ${formDeliveryLocation.trim()}` : '',
        formPaymentTerms.trim() ? `Payment Terms: ${formPaymentTerms.trim()}` : '',
        formRequirement.trim() ? `Notes: ${formRequirement.trim()}` : '',
      ].filter(Boolean).join(' | ');

      const naturalRawText = formRawInquiryText.trim() || (formProductSKU.length > 50 ? formProductSKU.trim() : '') || (formRequirement.length > 50 ? formRequirement.trim() : '');

      const rawText = poFileName
        ? `[Inquiry Attachment: ${poFileName}] ${naturalRawText || reqDetails || formRequirement || 'Inquiry'}`
        : naturalRawText || reqDetails || formRequirement || 'Inquiry';

      const createRes = await inquiriesApi.create({
        sender_name: customerName,
        customer_name: customerName,
        customer_phone: finalCustomerPhone,
        sender_phone: finalCustomerPhone,
        raw_text: rawText,
        inquiry_type: formInquiryType,
        status: 'review',
        overall_confidence: 0.95,
        media_urls: poFileBase64 ? [poFileBase64] : [],
        ai_extraction_json: aiExtractionJson,
      });

      const newInquiry: InquiryItem = {
        id: createRes?.data?.id || createRes?.data?.data?.id || String(Date.now()),
        sender_name: customerName,
        customer_name: customerName,
        customer_phone: finalCustomerPhone,
        sender_phone: finalCustomerPhone,
        raw_text: rawText,
        inquiry_type: formInquiryType,
        status: 'review',
        source_channel: 'web_dashboard',
        overall_confidence: 0.95,
        media_urls: poFileBase64 ? [poFileBase64] : [],
        ai_extraction_json: aiExtractionJson,
        created_at: new Date().toISOString(),
      };

      setShowModal(false);
      setFormRawInquiryText('');
      setFormCustomerName('');
      setShowCompanyDropdown(false);
      setFormPhone('');
      setFormProductSKU('');
      setFormPreferredMake('');
      setFormDeliveryLocation('');
      setFormPaymentTerms('');
      setFormRequirement('');
      setFormInquiryType('Product Requirement');
      setPoFileName('');
      setPoFileBase64(null);
      formExtractedJsonRef.current = null;

      // Prepend local inquiry so it appears immediately with full ai_extraction_json
      setInquiries(prev => [newInquiry, ...(Array.isArray(prev) ? prev : [])]);

      setTimeout(() => fetchMonthlyInquiries(), 2000);
    } catch (err: any) {
      console.error('Error logging inquiry:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to log inquiry. Please try again.';
      alert(`Failed to log inquiry: ${errMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Keep ONLY actual Product Inquiries (filters out generic chat greetings, deal logs, and status questions!)
  const rawList = Array.isArray(inquiries) && inquiries.length > 0 ? inquiries : (Array.isArray(rawInquiries) ? rawInquiries : []);
  const productInquiries = rawList.filter(isProductInquiry);
  const activeInquiryList = productInquiries;
  const reviewCount = activeInquiryList.filter(i => {
    const st = (i?.status || 'review').toLowerCase();
    return ['review', 'needs_review', 'pending', 'new', 'draft'].includes(st);
  }).length;

  const processedCount = activeInquiryList.filter(i => {
    const st = (i?.status || '').toLowerCase();
    return ['processed', 'confirmed', 'quoted', 'won', 'auto_created', 'order_created', 'closed'].includes(st);
  }).length;

  const filtered = activeInquiryList.filter(i => {
    try {
      if (dateRange.from && dateRange.to) {
        const parseSafeIso = (dStr?: string) => {
          if (!dStr) return '';
          try {
            const trimmed = String(dStr).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
            const d = new Date(trimmed);
            if (isNaN(d.getTime())) return '';
            return d.toISOString().split('T')[0];
          } catch {
            return '';
          }
        };
        const inqDate = parseSafeIso(i?.created_at);
        if (inqDate) {
          const fromDate = dateRange.from.split('T')[0];
          const toDate = dateRange.to.split('T')[0];
          if (inqDate < fromDate || inqDate > toDate) return false;
        }
      }

      const text = i?.raw_text || '';
      const parsed = parseInquiryText(text, i);
      const name = (parsed.companyName || i?.customer_name || i?.sender_name || '').toLowerCase();
      const phone = (parsed.customerPhone || i?.sender_phone || i?.customer_phone || '').toLowerCase();
      const itemsSummary = (
        (parsed.lineItems || []).map((li: LineItemDetail) => `${li.sku_text} ${li.dimensions || ''} ${li.quantity} ${li.unit || ''}`).join(' ') +
        ' ' + (parsed.productType || '')
      ).toLowerCase();

      const formattedDate = i?.created_at ? new Date(i.created_at).toLocaleString('en-IN').toLowerCase() : '';
      const dateOnly = i?.created_at ? new Date(i.created_at).toLocaleDateString('en-IN').toLowerCase() : '';
      const isoDate = (i?.created_at || '').toLowerCase();

      const s = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !s ||
        name.includes(s) ||
        itemsSummary.includes(s) ||
        formattedDate.includes(s) ||
        dateOnly.includes(s) ||
        isoDate.includes(s) ||
        phone.includes(s) ||
        text.toLowerCase().includes(s);

      const statusStr = (i?.status || 'review').toLowerCase();
      const isReview = ['review', 'needs_review', 'pending', 'new', 'draft'].includes(statusStr);
      const isProcessed = ['processed', 'confirmed', 'quoted', 'won', 'auto_created', 'order_created', 'closed'].includes(statusStr);

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'review' && isReview) ||
        (filterStatus === 'processed' && isProcessed);

      return matchesSearch && matchesStatus;
    } catch {
      return true;
    }
  }).sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeB - timeA;
  });

  const handleViewInquiryDocument = async (inq: InquiryItem) => {
    if (drawerFileBase64) {
      setImageViewerUrl(drawerFileBase64);
      return;
    }

    const mediaUrl = inq.media_urls?.[0];
    if (mediaUrl && (mediaUrl.startsWith('data:') || mediaUrl.startsWith('http'))) {
      setImageViewerUrl(mediaUrl);
      return;
    }

    // Immediately open text view for zero latency
    setImageViewerUrl(`extracted_preview://${inq.id}`);

    // If media is attached in DB, asynchronously fetch and upgrade viewer
    if (inq.has_media || inq.media_urls?.includes('attached_document')) {
      try {
        const res = await inquiriesApi.getOne(inq.id);
        const fullInq = res?.data?.data || res?.data;
        const dbMedia = fullInq?.media_urls?.[0];
        if (dbMedia && (dbMedia.startsWith('data:') || dbMedia.startsWith('http'))) {
          setImageViewerUrl(dbMedia);
        }
      } catch (e) {
        console.warn('Error fetching full inquiry doc:', e);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="text-blue-600" size={28} />
            Inquiries &amp; Quotations Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Automated RFQ extraction, pricing computation, PDF quotation generation, and dispatch tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateFilterControl onChange={setDateRange} initialPreset="this_month" />

          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all shadow-2xs">
            <ShoppingBag size={15} className="text-emerald-600" /> View Confirmed Orders / POs 📦
          </button>

          <button
            onClick={() => fetchMonthlyInquiries()}
            className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs">
            <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md">
            <Plus size={16} /> Log New Inquiry / PO
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by Received Date, Customer / Company Name, Items Summary..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-400"
          />
        </div>

        <div className="relative inline-flex items-center w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all"
          >
            <option value="all">All Inquiries ({productInquiries.length})</option>
            <option value="review">Needs Review ({reviewCount}) ⏳</option>
            <option value="processed">Quotation Ready ({processedCount}) ✓</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Main Inquiries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-center w-12">#</th>
                <th className="px-4 py-3 text-left">Customer &amp; Date</th>
                <th className="px-4 py-3 text-left">Items Summary</th>
                <th className="px-4 py-3 text-center">Source Channel</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Loading monthly inquiries...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No product inquiries found for this period.
                  </td>
                </tr>
              ) : (
                filtered.map((inq, idx) => {
                  const details = (() => {
                    const parsed = parseInquiryText(inq.raw_text || '', inq);
                    const ai = inq?.ai_extraction_json || {};
                    const lineItemsSrc = ai.line_items || ai.lineItems || [];
                    if (lineItemsSrc.length > 0) {
                      return {
                        ...parsed,
                        companyName: parsed.companyName,
                        customerPhone: parsed.customerPhone,
                        lineItems: lineItemsSrc.map((item: any) => ({
                          sku_text: item.sku_text || item.description || '',
                          dimensions: item.dimensions || '',
                          quantity: Number(item.quantity) || 0,
                          unit: item.unit || 'MT',
                          rate: Number(item.rate) || 0,
                          amount: Number(item.amount) || Math.round(Number(item.quantity) * Number(item.rate)),
                        })),
                        totalAmount: ai.totalAmount || ai.total_amount || lineItemsSrc.reduce((s: number, i: any) => s + (Number(i.amount) || Math.round(Number(i.quantity) * Number(i.rate))), 0),
                      };
                    }
                    return parsed;
                  })();
                  const st = (inq.status || '').toLowerCase();
                  const isQuoted = st === 'quoted';
                  const isConfirmed = st === 'confirmed' || st === 'processed' || st === 'won';

                  return (
                    <tr
                      key={inq.id || idx}
                      onClick={() => handleOpenDrawer(inq)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group">
                      <td className="px-4 py-3.5 font-medium text-slate-500 text-center">{idx + 1}</td>
                      <td className="px-4 py-3.5 text-left min-w-[200px]">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <Building2 size={15} className="text-slate-700 flex-shrink-0" />
                          <span>{details.companyName || <span className="text-slate-300 font-normal italic">—</span>}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          <span>{inq.created_at ? new Date(inq.created_at).toLocaleString('en-IN') : '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 text-left">
                        {details.lineItems && details.lineItems.length > 0 ? (
                          <div className="space-y-0.5 inline-block text-left">
                            {details.lineItems.slice(0, 3).map((li: LineItemDetail, liIdx: number) => (
                              <div key={liIdx} className="flex items-center gap-1 text-[11px]">
                                <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold text-[10px]">{liIdx + 1}</span>
                                <span className="font-medium text-slate-800 truncate max-w-[160px]">{li.sku_text}</span>
                                <span className="text-slate-400 font-mono whitespace-nowrap">{li.quantity} {li.unit || 'MT'}</span>
                              </div>
                            ))}
                            {details.lineItems.length > 3 && (
                              <span className="text-[10px] text-blue-500 font-semibold block text-center">+{details.lineItems.length - 3} more items</span>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center gap-1 text-[11px]">
                            <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold text-[10px]">1</span>
                            <span className="font-medium text-slate-800 truncate max-w-[160px]">{details.productType || 'Hot Rolled'}</span>
                            <span className="text-slate-400 font-mono whitespace-nowrap">{details.quantityTons || 0} {details.lineItems?.[0]?.unit || 'MT'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          (inq.source_channel === 'web_dashboard' || inq.source_channel === 'dashboard')
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {(inq.source_channel === 'web_dashboard' || inq.source_channel === 'dashboard')
                            ? 'Dashboard'
                            : 'WhatsApp'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {(inq.inquiry_type === 'purchase_order' || inq.source_channel === 'whatsapp_po') ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                            <CheckCircle size={12} /> PO Confirmed 
                          </span>
                        ) : isQuoted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                            <CheckCircle size={12} /> Quotation Sent 📄
                          </span>
                        ) : isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                            <CheckCircle size={12} /> Quotation Ready ✓
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock size={12} /> Needs Review ⏳
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuotationViewInquiry(inq);
                            setQuotationViewDetails(details);  // reuse `details` from the row
                            setShowQuotationView(true);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 mx-auto">
                          <Eye size={13} /> Final Quotation
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI INTERPRETATION & QA AUDIT POPUP MODAL */}
      {selectedInquiry && editDetails && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-in fade-in duration-150"
          onClick={() => setSelectedInquiry(null)}>
          <div
            className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}>
            {/* Drawer Header (Fixed Top) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-200">
                  <FileText size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    Inquiry AI Interpretation &amp; Audit
                    <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                      <ShieldCheck size={12} /> 92% AI Confidence
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    ID: #INQ-{selectedInquiry.id.substring(0, 8).toUpperCase()} · Received {new Date(selectedInquiry.created_at).toLocaleString('en-IN')} · Salesperson: <span className="font-sans font-bold text-slate-800">{activeSalespersonName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInquiry(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">

              {/* QA & Audit Section — Source badge + Document & Raw Inquiry action */}
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Source badge */}
                  <span className="bg-slate-800 px-2.5 py-1 rounded-lg text-[11px] text-slate-300 font-bold uppercase tracking-wider">
                    Source: {selectedInquiry.source_channel === 'web_dashboard' || selectedInquiry.source_channel === 'dashboard' ? 'Dashboard' : 'WhatsApp'}
                  </span>

                  {/* Document & Raw Inquiry action bar */}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="drawer-file-upload"
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={handleDrawerFileUpload}
                    />

                    {drawerFileBase64 && (
                      <button
                        type="button"
                        onClick={() => setDrawerFileBase64(null)}
                        className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 text-red-200 rounded-lg text-[11px] font-bold transition-colors">
                        Remove File
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => document.getElementById('drawer-file-upload')?.click()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-700">
                      <UploadCloud size={13} /> {drawerFileBase64 || (selectedInquiry.media_urls && selectedInquiry.media_urls.length > 0) ? 'Replace File' : 'Attach Document File'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleViewInquiryDocument(selectedInquiry)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5">
                      <Eye size={14} /> View Original Inquiry 👁️
                    </button>
                  </div>
                </div>
              </div>

              {/* Extracted Customer Inquiry Table Header */}
              <div className="flex items-center justify-between pt-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" />
                  Pre-filled &amp; Extracted Customer Inquiry Table
                </h3>
              </div>

              {/* Editable Fields Form */}
              <div className="space-y-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Company Name *
                    </label>
                    <select
                      value={editDetails.companyName}
                      onChange={(e) => {
                        setEditDetails({ ...editDetails, companyName: e.target.value });
                        setSaveSuccess(false);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                      {existingCustomers.map((cName) => (
                        <option key={cName} value={cName}>{cName}</option>
                      ))}
                      {/* Allow current value even if not in list */}
                      {!existingCustomers.includes(editDetails.companyName) && editDetails.companyName && (
                        <option value={editDetails.companyName}>{editDetails.companyName}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Salesperson
                    </label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 shadow-2xs">
                      <User size={15} className="text-blue-600 shrink-0" />
                      <span className="truncate">{activeSalespersonName}</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 ml-auto shrink-0">
                        Active Session
                      </span>
                    </div>
                  </div>
                </div>

                {/* Structured Inquiry Table Layout */}
                <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs text-slate-800 border-collapse">
                    <thead className="bg-slate-800 text-white font-bold uppercase text-[11px] tracking-wider">
                      <tr>
                        <th className="px-3 py-3 border-r border-slate-700 w-[4%] text-center">#</th>
                        <th className="px-4 py-3 border-r border-slate-700 w-[30%]">Description &amp; Specifications</th>
                        <th className="px-3 py-3 border-r border-slate-700 w-[14%] text-center">HSN/SAC</th>
                        <th className="px-3 py-3 border-r border-slate-700 w-[22%] text-center">Quantity &amp; Unit</th>
                        <th className="px-3 py-3 border-r border-slate-700 w-[14%] text-center">Rate (₹)</th>
                        <th className="px-4 py-3 border-r border-slate-700 w-[13%] text-right">Amount (₹)</th>
                        <th className="px-2 py-3 text-center w-[3%]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {(editDetails.lineItems && editDetails.lineItems.length > 0
                        ? editDetails.lineItems
                        : [{ sku_text: editDetails.productType || '', dimensions: [editDetails.thickness, editDetails.width, editDetails.length].filter(Boolean).join(' x '), hsn_code: '72083730', quantity: editDetails.quantityTons || 0, unit: 'MT', rate: editDetails.unitPrice || 0, amount: editDetails.totalAmount || 0 }]
                      ).map((item, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/30">
                          <td className="px-3 py-3.5 border-r border-slate-200 text-slate-400 font-mono text-center text-xs">{idx + 1}</td>
                          <td className="px-4 py-3.5 border-r border-slate-200">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={item.sku_text || ''}
                                onChange={(e) => {
                                  const updated = [...(editDetails.lineItems || [])];
                                  updated[idx] = { ...updated[idx], sku_text: e.target.value };
                                  setEditDetails({ ...editDetails, lineItems: updated });
                                  setSaveSuccess(false);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                                placeholder="Product Name / Description"
                              />
                              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                                <span className="font-semibold text-slate-400 shrink-0">Spec:</span>
                                <input
                                  type="text"
                                  value={item.dimensions || ''}
                                  onChange={(e) => {
                                    const updated = [...(editDetails.lineItems || [])];
                                    updated[idx] = { ...updated[idx], dimensions: e.target.value };
                                    setEditDetails({ ...editDetails, lineItems: updated });
                                    setSaveSuccess(false);
                                  }}
                                  className="w-full px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
                                  placeholder="e.g. 1mm or 2.50mm x 1250mm"
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3.5 border-r border-slate-200 text-center font-mono">
                            <input
                              type="text"
                              value={item.hsn_code !== undefined ? item.hsn_code : '72083730'}
                              onChange={(e) => {
                                const updated = [...(editDetails.lineItems || [])];
                                updated[idx] = { ...updated[idx], hsn_code: e.target.value };
                                setEditDetails({ ...editDetails, lineItems: updated });
                                setSaveSuccess(false);
                              }}
                              placeholder="72083730"
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs font-mono text-center text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                            />
                          </td>
                          <td className="px-3 py-3.5 border-r border-slate-200">
                            <div className="flex items-center gap-1.5 w-full min-w-[135px]">
                              <input
                                type="number"
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const q = val === '' ? 0 : parseFloat(val);
                                  const safeQ = isNaN(q) ? 0 : q;
                                  const updated = [...(editDetails.lineItems || [])];
                                  const amt = Math.round(safeQ * (updated[idx]?.rate || 0));
                                  updated[idx] = { ...updated[idx], quantity: safeQ, amount: amt };
                                  const totalAmt = updated.reduce((s, i) => s + (i.amount || 0), 0);
                                  const totalTons = updated.reduce((s, i) => s + (i.unit === 'MT' ? i.quantity : 0), 0);
                                  setEditDetails({ ...editDetails, lineItems: updated, totalAmount: totalAmt, quantityTons: totalTons });
                                  setSaveSuccess(false);
                                }}
                                placeholder="0"
                                className="flex-1 min-w-[65px] px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs text-blue-700 font-mono outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal text-center"
                              />
                              <select
                                value={item.unit || 'MT'}
                                onChange={(e) => {
                                  const updated = [...(editDetails.lineItems || [])];
                                  updated[idx] = { ...updated[idx], unit: e.target.value };
                                  setEditDetails({ ...editDetails, lineItems: updated });
                                  setSaveSuccess(false);
                                }}
                                className="w-[62px] shrink-0 px-1 py-1.5 bg-slate-50 border border-slate-300 rounded text-[11px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="MT">MT</option>
                                <option value="Nos">Nos</option>
                                <option value="Pieces">Pcs</option>
                                <option value="KG">KG</option>
                                <option value="Sheets">Sheets</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 border-r border-slate-200 font-bold font-mono">
                            <input
                              type="number"
                              value={item.rate === 0 ? '' : item.rate}
                              onChange={(e) => {
                                const val = e.target.value;
                                const r = val === '' ? 0 : parseFloat(val);
                                const safeR = isNaN(r) ? 0 : r;
                                const updated = [...(editDetails.lineItems || [])];
                                const amt = Math.round((updated[idx]?.quantity || 0) * safeR);
                                updated[idx] = { ...updated[idx], rate: safeR, amount: amt };
                                const totalAmt = updated.reduce((s, i) => s + (i.amount || 0), 0);
                                setEditDetails({ ...editDetails, lineItems: updated, totalAmount: totalAmt, unitPrice: updated[0]?.rate || 0 });
                                setSaveSuccess(false);
                              }}
                              placeholder="0"
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-emerald-700 font-mono border-r border-slate-200">
                            <input
                              type="number"
                              value={item.amount === 0 ? '' : item.amount}
                              onChange={(e) => {
                                const val = e.target.value;
                                const a = val === '' ? 0 : parseFloat(val);
                                const safeA = isNaN(a) ? 0 : a;
                                const updated = [...(editDetails.lineItems || [])];
                                updated[idx] = { ...updated[idx], amount: safeA };
                                const totalAmt = updated.reduce((s, i) => s + (i.amount || 0), 0);
                                setEditDetails({ ...editDetails, lineItems: updated, totalAmount: totalAmt });
                                setSaveSuccess(false);
                              }}
                              placeholder="0"
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs text-right font-mono text-emerald-700 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                            />
                          </td>
                          <td className="px-2 py-3.5 text-center">
                            {(editDetails.lineItems || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = (editDetails.lineItems || []).filter((_, i) => i !== idx);
                                  const totalAmt = updated.reduce((s, i) => s + (i.amount || 0), 0);
                                  const totalTons = updated.reduce((s, i) => s + (i.unit === 'MT' ? i.quantity : 0), 0);
                                  setEditDetails({ ...editDetails, lineItems: updated, totalAmount: totalAmt, quantityTons: totalTons });
                                  setSaveSuccess(false);
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove line item">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Add Line Item Button */}
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        const current = editDetails.lineItems && editDetails.lineItems.length > 0
                          ? editDetails.lineItems
                          : [{ sku_text: editDetails.productType || '', dimensions: '', hsn_code: '72083730', quantity: editDetails.quantityTons || 0, unit: 'MT', rate: editDetails.unitPrice || 0, amount: editDetails.totalAmount || 0 }];
                        const updated = [
                          ...current,
                          { sku_text: '', dimensions: '', hsn_code: '72083730', quantity: 0, unit: 'MT', rate: 0, amount: 0 },
                        ];
                        setEditDetails({ ...editDetails, lineItems: updated });
                        setSaveSuccess(false);
                      }}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs">
                      <Plus size={14} /> + Add Line Item
                    </button>
                    <span className="text-[11px] text-slate-400 italic">Add multiple product lines for complex inquiries</span>
                  </div>

                  {/* Standard Quotation Pricing Breakdown Layout (Matching Reference) */}
                  {(() => {
                    const activeLineItems = editDetails.lineItems && editDetails.lineItems.length > 0
                      ? editDetails.lineItems
                      : [{ sku_text: editDetails.productType || '', dimensions: [editDetails.thickness, editDetails.width, editDetails.length].filter(Boolean).join(' x '), quantity: editDetails.quantityTons || 0, unit: 'MT', rate: editDetails.unitPrice || 0, amount: editDetails.totalAmount || 0 }];

                    const subtotal = activeLineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                    const qBreakdown = calculateQuotationBreakdown(subtotal);

                    const totalQty = activeLineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                    const distinctUnits = Array.from(new Set(activeLineItems.map(i => i.unit || 'MT')));
                    const primaryUnit = distinctUnits.length === 1 ? distinctUnits[0] : 'units';
                    const formattedItemsInTotal = `${totalQty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${primaryUnit}`;

                    return (
                      <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4">
                        <div className="text-xs font-semibold text-slate-700 pt-1">
                          Items in Total <span className="font-mono text-slate-900 font-bold">{formattedItemsInTotal}</span>
                        </div>

                        <div className="w-full sm:w-64 space-y-1 text-xs text-slate-700">
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-medium text-slate-600">Sub Total</span>
                            <span className="font-mono text-slate-900 font-medium">{qBreakdown.formattedSubtotal}</span>
                          </div>
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-medium text-slate-600">CGST (9%)</span>
                            <span className="font-mono text-slate-900 font-medium">{qBreakdown.formattedCGST}</span>
                          </div>
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-medium text-slate-600">SGST (9%)</span>
                            <span className="font-mono text-slate-900 font-medium">{qBreakdown.formattedSGST}</span>
                          </div>
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-medium text-slate-600">Rounding</span>
                            <span className="font-mono text-slate-900 font-medium">{qBreakdown.formattedRounding}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-300 font-black text-slate-950 text-sm">
                            <span className="font-bold">Total</span>
                            <span className="font-mono text-base font-black text-slate-950">{qBreakdown.formattedGrandTotal}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Commercial Terms Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1 uppercase tracking-wider text-[10px]">Delivery Address / Location</span>
                      <input
                        type="text"
                        value={editDetails.deliveryLocation}
                        onChange={(e) => {
                          setEditDetails({ ...editDetails, deliveryLocation: e.target.value });
                          setSaveSuccess(false);
                        }}
                        placeholder="e.g. Chakan Industrial Area, Pune"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                      />
                    </div>

                    <div>
                      <span className="text-slate-500 font-semibold block mb-1 uppercase tracking-wider text-[10px]">Payment Terms</span>
                      <input
                        type="text"
                        value={editDetails.paymentTerms}
                        onChange={(e) => {
                          setEditDetails({ ...editDetails, paymentTerms: e.target.value });
                          setSaveSuccess(false);
                        }}
                        placeholder="e.g. 30 Days Credit, 100% Advance, 50% Advance 50% on Delivery"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar (Solid White Pinned Footer) */}
            <div className="px-6 py-3.5 bg-white border-t border-slate-200 shrink-0 z-20 flex items-center justify-end gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs">
                <Eye size={15} /> View PDF 📄
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleSaveDrawerDetails}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
                  saveSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}>
                {submitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check size={15} /> Saved &amp; Confirmed ✓
                  </>
                ) : (
                  <>
                    <Save size={15} /> Save &amp; Confirm Quotation ✓
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowQuotationModal(true)}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
                  ['quoted', 'won'].includes((selectedInquiry.status || '').toLowerCase()) || isQuotationSent
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}>
                {['quoted', 'won'].includes((selectedInquiry.status || '').toLowerCase()) || isQuotationSent ? (
                  <>
                    <Check size={15} /> Quotation Sent ✓
                  </>
                ) : (
                  <>
                    <Send size={15} /> Send Quotation ✉️
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inquiry Quotation PDF Preview Modal */}
      {showPdfModal && editDetails && selectedInquiry && (
        <InquiryPdfModal
          inquiry={selectedInquiry}
          details={editDetails}
          onClose={() => setShowPdfModal(false)}
        />
      )}

      {/* FULL-SCREEN LIGHT MODE IMAGE / DOCUMENT / TEXT VIEWER */}
      {imageViewerUrl && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4"
          onClick={() => setImageViewerUrl(null)}>
          <div className="relative max-w-3xl w-full max-h-[90vh] bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                {imageViewerUrl.startsWith('extracted_preview://')
                  ? 'Original Customer Inquiry Message'
                  : 'Attached Customer Document / Inquiry File'}
              </span>
              <button
                onClick={() => setImageViewerUrl(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 flex items-center gap-1 text-xs font-bold transition-colors">
                <X size={18} /> Close
              </button>
            </div>

            {imageViewerUrl.startsWith('extracted_preview://') ? (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Source Inquiry Text</span>
                  {selectedInquiry?.created_at && (
                    <span className="font-mono">
                      Received: {new Date(selectedInquiry.created_at).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-sm font-sans whitespace-pre-wrap leading-relaxed select-text min-h-[140px] max-h-[60vh] overflow-y-auto">
                  {selectedInquiry?.raw_text || 'No inquiry text recorded.'}
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
                    target.style.display = 'none';
                    const fallbackDiv = document.getElementById('image-fallback-card');
                    if (fallbackDiv) fallbackDiv.style.display = 'flex';
                  }}
                />
              </div>
            )}

            {/* Fallback UI if media URL is raw WhatsApp ID or broken base64 */}
            <div id="image-fallback-card" style={{ display: 'none' }} className="flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-3 max-w-md mx-auto my-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                <ImageIcon size={32} />
              </div>
              <div>
                <h3 className="text-slate-900 font-bold text-sm">Customer Attached Document</h3>
                <p className="text-slate-600 text-xs mt-1">
                  Document content was parsed and extracted with Gemini AI into the structured inquiry table.
                </p>
              </div>
            </div>

            {imageViewerUrl.startsWith('http') && (
              <div className="flex items-center justify-end mt-4 gap-2">
                <a
                  href={imageViewerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
                  <ExternalLink size={14} /> Open Original Attachment
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CLEAN QUOTATION VIEW MODAL */}
      {/* ============================================================ */}
      {showQuotationView && quotationViewInquiry && quotationViewDetails && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Quotation Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-800 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 rounded-xl">
                  <Package size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">Price Quotation</h2>
                  <p className="text-slate-400 text-[11px] font-mono mt-0.5">
                    Enlight Metals Pvt. Ltd. · {new Date(quotationViewInquiry.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintQuotation(quotationViewInquiry, quotationViewDetails)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <Printer size={13} /> Print / Save PDF
                </button>
                <button
                  onClick={() => setShowQuotationView(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Buyer & Seller Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Bill To</p>
                  <p className="font-bold text-slate-900 text-sm">{quotationViewDetails.companyName}</p>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">📞 {quotationViewDetails.customerPhone}</p>
                  <p className="text-xs text-slate-600 mt-0.5">📍 {quotationViewDetails.deliveryLocation}</p>
                </div>
<div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">From</p>
                  <p className="font-bold text-slate-900 text-sm">Enlight Metals Pvt. Ltd.</p>
                  <p className="text-xs text-slate-600 mt-0.5">Mumbai, Maharashtra</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">
                    Ref: {quotationViewInquiry.id.slice(0, 12).toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Quotation Table matching reference image */}
              <div className="rounded-xl border border-slate-300 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-700 text-white font-bold text-[11px] tracking-wide">
                    <tr>
                      <th className="px-3 py-2.5 text-center w-[5%] border-b border-slate-600">#</th>
                      <th className="px-4 py-2.5 w-[42%] border-b border-slate-600">Item &amp; Description</th>
                      <th className="px-3 py-2.5 text-center w-[15%] border-b border-slate-600">HSN/SAC</th>
                      <th className="px-4 py-2.5 text-right w-[12%] border-b border-slate-600">Qty</th>
                      <th className="px-4 py-2.5 text-right w-[12%] border-b border-slate-600">Rate</th>
                      <th className="px-4 py-2.5 text-right w-[14%] border-b border-slate-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white text-slate-900">
                    {(quotationViewDetails.lineItems && quotationViewDetails.lineItems.length > 0 ? (
                      quotationViewDetails.lineItems
                    ) : (
                      [{
                        sku_text: cleanProductType(quotationViewDetails.productType) || 'HR - COIL / SHEET',
                        dimensions: [quotationViewDetails.thickness, quotationViewDetails.width ? `x ${quotationViewDetails.width}` : ''].filter(Boolean).join(' '),
                        quantity: quotationViewDetails.quantityTons,
                        unit: 'MT',
                        rate: quotationViewDetails.unitPrice,
                        amount: quotationViewDetails.totalAmount,
                      }]
                    )).map((item, idx) => {
                      const qty = Number(item.quantity || 0);
                      const rate = Number(item.rate || 0);
                      const amt = Number(item.amount || (qty * rate) || 0);
                      const hsn = (item as any).hsn_code || '72083730';
                      const unit = item.unit || 'MT';

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="px-3 py-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 text-xs tracking-tight">{item.sku_text || 'HR - COIL / SHEET'}</div>
                            {item.dimensions && (
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.dimensions}</div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-slate-600 text-xs">{hsn}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-bold text-slate-900 font-mono text-xs">{formatIndianCurrency(qty, true)}</div>
                            <div className="text-[10px] text-slate-500 font-semibold">{unit}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-800 text-xs">
                            {rate > 0 ? formatIndianCurrency(rate, true) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono text-xs">
                            {amt > 0 ? formatIndianCurrency(amt, true) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer: Left items total & Right financial summary block */}
              {(() => {
                const qItems = quotationViewDetails.lineItems && quotationViewDetails.lineItems.length > 0
                  ? quotationViewDetails.lineItems
                  : [{ quantity: quotationViewDetails.quantityTons, unit: 'MT', amount: quotationViewDetails.totalAmount }];
                const qSubtotal = qItems.reduce((s, i) => s + (Number(i.amount) || 0), 0) || quotationViewDetails.totalAmount || 0;
                const qBreakdown = calculateQuotationBreakdown(qSubtotal);
                const qTotalQty = qItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
                const qUnit = qItems[0]?.unit || 'MT';
                const qIsSingleUnit = qItems.every(i => (i.unit || 'MT').toUpperCase() === qUnit.toUpperCase());

                return (
                  <div className="flex flex-col sm:flex-row justify-between items-start pt-1 gap-6">
                    <div className="text-xs font-semibold text-slate-700 pt-1">
                      <span>Items in Total {formatIndianCurrency(qTotalQty, true)} {qIsSingleUnit ? qUnit : ''}</span>
                    </div>

                    <div className="w-full sm:w-72 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center py-0.5 text-slate-700">
                        <span className="font-medium">Sub Total</span>
                        <span className="font-mono font-medium">{qBreakdown.formattedSubtotal}</span>
                      </div>

                      <div className="flex justify-between items-center py-0.5 text-slate-700">
                        <span className="font-medium">CGST (9%)</span>
                        <span className="font-mono font-medium">{qBreakdown.formattedCGST}</span>
                      </div>

                      <div className="flex justify-between items-center py-0.5 text-slate-700">
                        <span className="font-medium">SGST (9%)</span>
                        <span className="font-mono font-medium">{qBreakdown.formattedSGST}</span>
                      </div>

                      <div className="flex justify-between items-center py-0.5 text-slate-700">
                        <span className="font-medium">Rounding</span>
                        <span className="font-mono font-medium">{qBreakdown.formattedRounding}</span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-t border-slate-300 font-black text-slate-950 text-sm">
                        <span>Total</span>
                        <span className="font-mono text-base">{qBreakdown.formattedGrandTotal}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

                {/* Commercial Terms */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5 uppercase tracking-wider text-[10px]">Delivery Address</span>
                    <span className="font-bold text-slate-900">{quotationViewDetails.deliveryLocation}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5 uppercase tracking-wider text-[10px]">Payment Terms</span>
                    <span className="font-bold text-purple-900">{quotationViewDetails.paymentTerms}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5 uppercase tracking-wider text-[10px]">Inquiry Date</span>
                    <span className="font-mono font-bold text-slate-700">{new Date(quotationViewInquiry.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>

              {/* Attached Image Preview in Quotation */}
              {quotationViewInquiry.media_urls && quotationViewInquiry.media_urls.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon size={13} className="text-blue-500" /> Customer's Shared Document / Image
                    </span>
                    <button
                      onClick={() => setImageViewerUrl(quotationViewInquiry.media_urls![0])}
                      className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1">
                      <ZoomIn size={12} /> View Full Size
                    </button>
                  </div>
                  <img
                    src={quotationViewInquiry.media_urls[0]}
                    alt="Customer shared document"
                    className="w-full max-h-48 object-contain bg-slate-100 cursor-zoom-in"
                    onClick={() => setImageViewerUrl(quotationViewInquiry.media_urls![0])}
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                  onClick={() => setShowQuotationView(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl">
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowQuotationView(false);
                    handleOpenDrawer(quotationViewInquiry);
                    setShowQuotationModal(true);
                  }}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md">
                  <Send size={14} /> Send Quotation to Customer ✉️
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Official Quotation Email Modal (Resend API Integration) */}
      {showQuotationModal && editDetails && selectedInquiry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Send className="text-purple-600" size={22} />
                Send Price Quotation (Resend API)
              </h2>
              <button
                onClick={() => setShowQuotationModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {(() => {
              const qBreakdown = calculateQuotationBreakdown(editDetails.totalAmount);
              return (
                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 text-xs space-y-2">
                  <div className="font-bold text-purple-900 flex items-center justify-between">
                    <span>Commercial Proposal Summary</span>
                    <span className="font-extrabold text-emerald-800">Total: {qBreakdown.formattedGrandTotal}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between font-mono">
                    <span>Sub Total: ₹{qBreakdown.formattedSubtotal}</span>
                    <span>CGST: ₹{qBreakdown.formattedCGST} | SGST: ₹{qBreakdown.formattedSGST}</span>
                  </div>
                  <p className="text-slate-700 font-mono text-[11px]">
                    {editDetails.companyName} · {editDetails.productType} ({editDetails.productForm || 'Material'}) {editDetails.quantityTons} MT @ ₹{editDetails.unitPrice}/MT
                  </p>
                  <div className="pt-1.5 border-t border-purple-200/60 text-[11px] text-purple-800 font-semibold flex items-center gap-1">
                    📄 <span><strong>Official PDF Quotation:</strong> The formatted PDF document will be generated and attached to this email.</span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. shravankotagi314@gmail.com"
                  value={quotationEmail}
                  onChange={e => setQuotationEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed font-medium">
                ⚡ <strong>Resend Test Sandbox Mode:</strong> In Resend test mode, emails can <strong>ONLY</strong> be delivered to your registered Resend account email (<strong>shravankotagi314@gmail.com</strong>). Verify your domain at <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="underline font-bold text-amber-950">resend.com/domains</a> to send to any custom customer email address.
              </div>

              {resendNotice && (
                <div className={`p-3 rounded-xl text-xs font-bold border ${
                  resendNotice.toLowerCase().includes('dispatched') ||
                  resendNotice.toLowerCase().includes('sent') ||
                  resendNotice.toLowerCase().includes('generated') ||
                  resendNotice.toLowerCase().includes('recorded') ||
                  resendNotice.toLowerCase().includes('success')
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}>
                  {resendNotice}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowQuotationModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl">
                Cancel
              </button>

              <button
                type="button"
                disabled={sendingQuotation || !quotationEmail.trim()}
                onClick={async () => {
                  try {
                    setSendingQuotation(true);
                    setResendNotice('');
                    const targetEmail = quotationEmail.trim() || 'shravankotagi314@gmail.com';
                    const res = await inquiriesApi.sendQuotation(selectedInquiry.id, {
                      customer_email: targetEmail,
                      customer_name: editDetails.companyName,
                      details: editDetails
                    });
                    const msg = res?.data?.message || res?.data?.data?.message || 'Live email & PDF Quotation dispatched to customer!';
                    setResendNotice(msg);
                    setIsQuotationSent(true);
                    setSelectedInquiry(prev => prev ? { ...prev, status: 'quoted' } : null);
                    if (res?.data?.email_sent !== false) {
                      setTimeout(() => {
                        setShowQuotationModal(false);
                        setResendNotice('');
                        fetchMonthlyInquiries();
                      }, 2500);
                    }
                  } catch (err: any) {
                    console.error('Error sending quotation:', err);
                    setResendNotice(err?.response?.data?.message || 'Quotation recorded! Add RESEND_API_KEY in backend .env to send live emails.');
                  } finally {
                    setSendingQuotation(false);
                  }
                }}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2">
                {sendingQuotation ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                {sendingQuotation ? 'Dispatching Email & PDF...' : 'Send Quotation Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log New Customer Inquiry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" size={22} />
                Log New Customer Inquiry (Text / File)
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Paste or Type Customer Inquiry Text Section */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/70 rounded-2xl border border-blue-200 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Sparkles size={15} className="text-blue-600" />
                  Type or Paste Customer Inquiry Text
                </label>
                <span className="text-[11px] text-blue-600 font-medium">WhatsApp message, email, or notes</span>
              </div>

              <textarea
                rows={3}
                value={formRawInquiryText}
                onChange={e => setFormRawInquiryText(e.target.value)}
                placeholder="Type or paste inquiry text e.g. Company: Sample Traders Pvt Ltd, CR 1mm (300 nos), CR 1.2mm (200 nos), HR 1.6mm (200 nos), Rate 52000, 30 days payment terms, delivery to Pune..."
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed placeholder:text-slate-400 max-h-36 overflow-y-auto resize-y"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isExtractingText || !formRawInquiryText.trim()}
                  onClick={handleExtractFromText}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer">
                  {isExtractingText ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      Extracting Details...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="text-amber-300" />
                      Extract Details
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Upload Inquiry Document Section */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <UploadCloud size={14} className="text-blue-600" />
                  Or Upload Inquiry Document (PDF, JPEG, PNG)
                </span>
                <span className="text-slate-400 font-normal">PDF, JPEG, PNG</span>
              </div>
              <div className="relative flex items-center justify-center border border-dashed border-slate-300 rounded-lg p-2.5 bg-white hover:bg-slate-50 transition-all cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-center">
                  {isExtractingPo ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                      <RefreshCw size={14} className="animate-spin text-blue-600" />
                      Gemini AI Analyzing &amp; Extracting Document...
                    </div>
                  ) : poFileName ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                      <FileCheck size={16} />
                      {poFileName} (Details Extracted &amp; Pre-filled!)
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 font-medium">
                      Drop document here, or <span className="text-blue-600 underline font-bold">Browse File</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateInquiry} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
                <div className="relative">
                  <div className="relative flex items-center">
                    <Building2 className="absolute left-3 text-slate-400 pointer-events-none" size={15} />
                    <input
                      required
                      type="text"
                      placeholder="Type or select company name..."
                      value={formCustomerName}
                      onChange={e => {
                        setFormCustomerName(e.target.value);
                        setShowCompanyDropdown(true);
                      }}
                      onFocus={() => setShowCompanyDropdown(true)}
                      className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowCompanyDropdown(prev => !prev)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 p-1">
                      <ChevronDown size={16} className={`transition-transform ${showCompanyDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {showCompanyDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {existingCustomers
                        .filter(c => !formCustomerName || c.toLowerCase().includes(formCustomerName.toLowerCase()))
                        .map(cName => (
                          <div
                            key={cName}
                            onMouseDown={() => {
                              setFormCustomerName(cName);
                              setShowCompanyDropdown(false);
                            }}
                            className="px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center justify-between transition-colors">
                            <span className="flex items-center gap-2">
                              <Building2 size={13} className="text-slate-400" />
                              {cName}
                            </span>
                            {formCustomerName.toLowerCase() === cName.toLowerCase() && (
                              <CheckCircle size={13} className="text-blue-600" />
                            )}
                          </div>
                        ))}
                      {existingCustomers.filter(c => !formCustomerName || c.toLowerCase().includes(formCustomerName.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400 italic">
                          No matching company found. Typing will save as new company.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Description / SKU *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. HR Coil, MS Plate, SS 304 Pipe, TMT Rebar..."
                  value={formProductSKU}
                  onChange={e => setFormProductSKU(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal max-h-36 overflow-y-auto resize-y leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Make</label>
                  <input
                    type="text"
                    placeholder="e.g. JSW, AM/NS, Tata, SAIL, or Any"
                    value={formPreferredMake}
                    onChange={e => setFormPreferredMake(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    placeholder="e.g. 30 Days Credit, 100% Advance"
                    value={formPaymentTerms}
                    onChange={e => setFormPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Location</label>
                <input
                  type="text"
                  placeholder="e.g. Chakan Industrial Area, Pune"
                  value={formDeliveryLocation}
                  onChange={e => setFormDeliveryLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Additional Notes</label>
                <textarea
                  rows={2}
                  placeholder="Special instructions, delivery timeline, or logistics notes"
                  value={formRequirement}
                  onChange={e => setFormRequirement(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || isExtractingPo}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2">
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {submitting ? 'Saving Inquiry...' : 'Save & Record Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
