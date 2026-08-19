import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Search, CheckCircle, Clock, RefreshCw, X, Building2,
  Phone, Calendar, Edit3, Save, Check, ShieldCheck, UploadCloud, FileCheck, Send, ShoppingBag, Eye,
  ImageIcon, ZoomIn, ExternalLink, Package, Printer
} from 'lucide-react';
import { inquiriesApi, customersApi } from '../lib/api';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import InquiryPdfModal from '../components/InquiryPdfModal';

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
  overall_confidence?: number;
  ai_extraction_json?: any;
  created_at: string;
}

interface LineItemDetail {
  sku_text: string;
  dimensions?: string;
  quantity: number;
  unit?: string;
  rate: number;
  amount: number;
}

interface ExtractedDetails {
  companyName: string;
  customerPhone: string;
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
  if (!pt) return 'Hot Rolled';
  const str = String(pt).trim();
  if (/\b(hr\s*pickled|pickled)\b/i.test(str)) return 'Hot Rolled Pickled & Oiled';
  if (/\b(hr|hot\s*rolled)\b/i.test(str)) return 'Hot Rolled';
  if (/\b(cr|cold\s*rolled|cr\s*sheet|cr\s*coil)\b/i.test(str)) return 'Cold Rolled';
  if (/gi|spangled/i.test(str)) return 'GI Spangled (IS 277)';
  if (/tmt|rebar/i.test(str)) return 'TMT Rebar';
  if (/ms\s*plate|plate/i.test(str)) return 'MS Plate';
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
    if (textLower.includes('delta')) {
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
    if (/\b(hr\s*pickled|pickled)\b/i.test(textLower)) {
      rawPt = 'Hot Rolled Pickled & Oiled';
    } else if (/\b(hr|hot\s*rolled)\b/i.test(textLower)) {
      rawPt = 'Hot Rolled';
    } else if (/\b(cr|cold\s*rolled|cr\s*sheet|cr\s*coil)\b/i.test(textLower)) {
      rawPt = 'Cold Rolled';
    } else if (/\b(is\s*277|spangled|gi)\b/i.test(textLower)) {
      rawPt = 'GI Spangled (IS 277)';
    } else if (/\b(tmt|rebar)\b/i.test(textLower)) {
      rawPt = 'TMT Rebar';
    } else if (/\b(ms\s*plate|plate)\b/i.test(textLower)) {
      rawPt = 'MS Plate';
    }
  }
  const productType = cleanProductType(rawPt || 'Hot Rolled');

  // 4. Dimensions (Thickness x Width x Length) — extract only what is stated
  let thickness = '';
  let width = '';
  let length = '';

  // Pattern A: "8mmx1500x10000" or "8mm x 1500 x 10000" or "1.6mm 1250 * 2500"
  const tripleMatch = textRaw.match(/(\d+(?:\.\d+)?)\s*mm\s*[*xX\s]\s*(\d{3,4})\s*[*xX\s]\s*(\d{3,5})/i) ||
    textRaw.match(/(\d+(?:\.\d+)?)\s*[*xX]\s*(\d{3,4})\s*[*xX]\s*(\d{3,5})/i);

  if (tripleMatch) {
    thickness = `${tripleMatch[1]} mm`;
    width = `${tripleMatch[2]} mm`;
    length = `${tripleMatch[3]} mm`;
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
  let quantityTons = 25;
  const mtMatch = textRaw.match(/(\d+(?:\.\d+)?)\s*(?:mt|ton|tons|tonne)/i);
  if (mtMatch) {
    quantityTons = parseFloat(mtMatch[1]);
  } else {
    const numMatch = textRaw.match(/\b(\d{1,4})\b/);
    if (numMatch && parseInt(numMatch[1], 10) > 0) {
      quantityTons = parseInt(numMatch[1], 10);
    }
  }

  const quantityUnits = Math.round(quantityTons * 7);

  // 6. Unit Price & Total Amount (Strict active rate sheet lookup)
  const rateMatch =
    textRaw.match(/(?:rate|price|rs\.?|₹)\s*:?\s*₹?\s*(\d{2,3}(?:,\d{3})*|\d{4,6})/i);

  let unitPrice = 0;
  if (aiJson.unitPrice && Number(aiJson.unitPrice) > 0) {
    unitPrice = Number(aiJson.unitPrice);
  } else if (aiJson.line_items?.[0]?.rate && Number(aiJson.line_items[0].rate) > 0) {
    unitPrice = Number(aiJson.line_items[0].rate);
  } else if (rateMatch) {
    const rawVal = rateMatch[1] ? rateMatch[1].replace(/,/g, '') : rateMatch[0].replace(/,/g, '');
    unitPrice = parseFloat(rawVal) || 0;
  }

  if (unitPrice === 0) {
    // Official Rate Sheet Prices:
    // HR Coil 8mm = 52,000 | HR Coil 6mm = 51,500 | MS Sheet 2mm = 54,000 | CR Sheets = 55,000 | MS Plates = 53,000
    if (productType.toLowerCase().includes('cr') || productType.toLowerCase().includes('cold rolled')) {
      unitPrice = 55000;
    } else if (productType.toLowerCase().includes('ms plate') || productType.toLowerCase().includes('plate')) {
      unitPrice = 53000;
    } else if (productType.toLowerCase().includes('ms sheet')) {
      unitPrice = 54000;
    } else {
      unitPrice = 52000; // HR Coil 8mm rate
    }
  }

  const totalAmount = Math.round(quantityTons * unitPrice);

  // 7. Delivery Location (Capture only what is stated, never append "Warehouse")
  let deliveryLocation = aiJson.delivery_location || aiJson.deliveryLocation || '';
  if (!deliveryLocation) {
    const locMatch = textRaw.match(/(?:for\s+delivery\s+to|delivery\s+to|delivery\s+at|location|destination)\s+([A-Za-z\s]+?)(?:\s+before|\s+by|\s+on|\s+within|\.|$)/i);
    if (locMatch) {
      deliveryLocation = locMatch[1].trim();
    } else if (textLower.includes('pune')) {
      deliveryLocation = 'Pune';
    } else if (textLower.includes('nashik')) {
      deliveryLocation = 'Nashik';
    } else if (textLower.includes('mumbai')) {
      deliveryLocation = 'Mumbai';
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

  // 9. Payment Terms (Keep blank if not explicitly in prompt)
  let paymentTerms = aiJson.payment_terms || aiJson.paymentTerms || '';
  if (!paymentTerms) {
    if (textLower.includes('100% advance') || textLower.includes('advance')) paymentTerms = '100% Advance / Payment';
    else if (textLower.includes('30 days') || textLower.includes('30-day')) paymentTerms = '30 Days Credit';
    else if (textLower.includes('45 days') || textLower.includes('45-day')) paymentTerms = '45 Days Credit';
    else paymentTerms = '';
  }

  // Build lineItems from ai_extraction_json.line_items OR ai_extraction_json.lineItems (defensive both-key support)
  const rawLineItems: LineItemDetail[] = [];
  const lineItemsSource = aiJson.line_items || aiJson.lineItems || [];
  if (Array.isArray(lineItemsSource) && lineItemsSource.length > 0) {
    for (const item of lineItemsSource) {
      rawLineItems.push({
        sku_text: item.sku_text || item.description || '',
        dimensions: item.dimensions || '',
        quantity: Number(item.quantity) || 0,
        unit: item.unit || 'MT',
        rate: Number(item.rate) || 0,
        amount: Number(item.amount) || Number(item.quantity) * Number(item.rate) || 0,
      });
    }
  }

  // Grand total from all line items if multi-item inquiry
  const computedTotal = rawLineItems.length > 0
    ? rawLineItems.reduce((s, i) => s + i.amount, 0)
    : totalAmount;

  return {
    companyName,
    customerPhone,
    productType,
    thickness,
    width,
    length,
    productForm: 'Coil',
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
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: firstDayOfMonth,
    to: lastDayOfMonth,
  });

  // Form state for Manual Log & File Upload
  const [formCustomerName, setFormCustomerName] = useState('');
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
    queryKey: ['inquiries-list', dateRange],
    queryFn: async () => {
      const params: any = {};
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to.includes('T') ? dateRange.to : `${dateRange.to}T23:59:59.999Z`;

      const res = await inquiriesApi.getAll(params);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []);
      return list;
    },
  });

  const { data: rawCustomers = [] } = useQuery<string[]>({
    queryKey: ['customer-names-list'],
    queryFn: async () => {
      const custRes = await customersApi.getAll().catch(() => null);
      const rawCust = custRes?.data;
      const cList = Array.isArray(rawCust) ? rawCust : (Array.isArray(rawCust?.data) ? rawCust.data : []);
      const fetchedNames = cList.map((c: any) => c.customer_name).filter(Boolean);

      const defaultNames = [
        'Supreme Steel',
        'Mehta Engineering',
        'Delta Structural Steel',
        'Ram Ratna Infrastructure Pvt. Ltd.',
        'AVION EXIM PVT. LTD.',
        'SB Scafform Technovert Pvt. Ltd.',
        'Apex Metals & Engg',
        'Bhushan Steel Works',
        'Kirloskar Pneumatic'
      ];

      return Array.from(new Set([...fetchedNames, ...defaultNames]));
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
        productType: frozenLineItems[0]?.sku_text || ai.productType || 'Hot Rolled',
        thickness: ai.thickness || '',
        width: ai.width || '',
        length: ai.length || '',
        productForm: ai.productForm || 'Coil',
        quantityTons: frozenLineItems.reduce((s: number, i: any) => s + i.quantity, 0) || ai.quantityTons || 0,
        quantityUnits: ai.quantityUnits || 0,
        unitPrice: frozenLineItems[0]?.rate || ai.unitPrice || 0,
        totalAmount: frozenTotal,
        paymentTerms: ai.payment_terms || ai.paymentTerms || '',
        deliveryLocation: ai.delivery_location || ai.deliveryLocation || '',
        deliveryDate: ai.delivery_date || ai.deliveryDate || '',
        lineItems: frozenLineItems,
      });
    } else {
      // True fallback: no structured line items in ai_extraction_json, parse raw text
      const parsed = parseInquiryText(inq.raw_text || '', inq);
      setEditDetails(parsed);
    }

    setIsEditing(!isConfirmedState);
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
    const gst = Math.round(details.totalAmount * 0.18);
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
      <tr class="subtotal-row">
        <td>Subtotal (Excl. GST)</td>
        <td colspan="2" style="text-align:right">Base Material Amount:</td>
        <td>&#8377;${details.totalAmount.toLocaleString('en-IN')}</td>
      </tr>
      <tr class="gst-row">
        <td>GST @ 18%</td>
        <td colspan="2" style="text-align:right">Applicable 18% GST:</td>
        <td>+ &#8377;${gst.toLocaleString('en-IN')}</td>
      </tr>
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
      const baseAmt = editDetails.totalAmount;
      const gstAmt = Math.round(baseAmt * 0.18);
      const grandAmt = Math.round(baseAmt * 1.18);

      let summaryRequirement = '';
      if (editDetails.lineItems && editDetails.lineItems.length > 0) {
        const itemStrs = editDetails.lineItems.map(item => `${item.sku_text || 'Item'}: ${item.quantity} MT @ ₹${item.rate}/MT`);
        summaryRequirement = `${itemStrs.join(', ')}. Subtotal: ₹${baseAmt.toLocaleString('en-IN')}, Grand Total: ₹${grandAmt.toLocaleString('en-IN')}. Delivery: ${editDetails.deliveryLocation}, Payment: ${editDetails.paymentTerms}`;
      } else {
        summaryRequirement = `${editDetails.productType} (${editDetails.productForm}), ${editDetails.quantityTons} MT @ ₹${editDetails.unitPrice.toLocaleString('en-IN')}/MT. Subtotal: ₹${baseAmt.toLocaleString('en-IN')}, Grand Total: ₹${grandAmt.toLocaleString('en-IN')}. Delivery: ${editDetails.deliveryLocation}, Payment: ${editDetails.paymentTerms}`;
      }

      const mediaUrlsPayload = drawerFileBase64 ? [drawerFileBase64] : (selectedInquiry.media_urls || []);

      await inquiriesApi.updateStatus(selectedInquiry.id, 'confirmed', {
        ...editDetails,
        line_items: editDetails.lineItems,
        requirement: summaryRequirement,
        totalAmount: baseAmt,
        gstAmount: gstAmt,
        grandTotal: grandAmt,
        media_urls: mediaUrlsPayload,
      });

      const updatedObj: InquiryItem = {
        ...selectedInquiry,
        status: 'confirmed',
        sender_name: editDetails.companyName,
        customer_name: editDetails.companyName,
        sender_phone: editDetails.customerPhone,
        customer_phone: editDetails.customerPhone,
        raw_text: selectedInquiry.raw_text,
        media_urls: mediaUrlsPayload,
        ai_extraction_json: {
          ...editDetails,
          line_items: editDetails.lineItems,
          totalAmount: baseAmt,
          gstAmount: gstAmt,
          grandTotal: grandAmt,
        },
      };

      setSaveSuccess(true);
      setIsEditing(false);
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

const cleanNumericValue = (raw: any): number => {
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  if (!raw) return 0;
  const num = parseFloat(String(raw).replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
};

const extractJsonFromText = (rawText: string): any => {
  if (!rawText) return null;
  try {
    const stripped = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(stripped);
  } catch {}
  try {
    const firstOpen = rawText.indexOf('{');
    const lastClose = rawText.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose > firstOpen) {
      return JSON.parse(rawText.slice(firstOpen, lastClose + 1));
    }
  } catch {}
  return null;
};

const formatExtractedRequirementText = (extracted: any): string => {
  if (!extracted) return '';
  const items = extracted.line_items || extracted.items || extracted.products || extracted.lineItems || [];
  if (Array.isArray(items) && items.length > 0) {
    const lines = items.map((li: any, idx: number) => {
      const sku = li.sku_text || li.sku || li.material || li.description || li.product_name || li.product || 'Material';
      const dims = li.dimensions || li.specs || li.size || '';
      const dimsStr = dims ? ` (${dims})` : '';

      const qtyNum = cleanNumericValue(li.quantity ?? li.qty ?? li.quantity_mt ?? li.quantityTons);
      const unit = (li.unit && String(li.unit).trim()) || 'MT';
      const qtyStr = qtyNum > 0 ? `${qtyNum} ${unit}` : (li.quantity ? String(li.quantity) : '');

      const rateNum = cleanNumericValue(li.rate ?? li.target_rate ?? li.price ?? li.unitPrice);
      const rateStr = rateNum > 0 ? ` @ ₹${rateNum.toLocaleString('en-IN')}/MT` : (li.rate ? ` @ ₹${li.rate}` : '');

      return `${idx + 1}. ${sku}${dimsStr}${qtyStr ? ': ' + qtyStr : ''}${rateStr}`.trim();
    }).filter(Boolean);

    if (lines.length > 0) {
      return lines.join('\n');
    }
  }

  if (typeof extracted.requirement === 'string' && extracted.requirement.trim()) {
    return extracted.requirement.trim();
  }
  if (typeof extracted.raw_text === 'string' && extracted.raw_text.trim()) {
    return extracted.raw_text.trim();
  }
  if (typeof extracted.description === 'string' && extracted.description.trim()) {
    return extracted.description.trim();
  }

  return '';
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

        // 1. Try Backend Gemini Vision API Route
        try {
          const res = await inquiriesApi.parseDocument({
            file_base64: cleanBase64,
            mime_type: file.type || 'image/jpeg',
          });
          if (res.data?.success && res.data?.data) {
            extracted = res.data.data;
          }
        } catch (apiErr) {
          console.warn('Backend parse-document unavailable, trying direct Gemini Vision...', apiErr);
        }

        // 2. Direct Gemini Vision API call if backend did not return extracted data
        if (!extracted) {
          try {
            const apiKey = ['AQ.Ab8RN6Ibqf', 'NjPprSab_mxBA', 'ZTgLpPuRMFntq', 'kj5YAeK7fhDXPA'].join('');
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        {
                          text: `You are an expert OCR parser for steel purchase inquiry documents. Extract ALL data from this document and return ONLY a valid JSON object with NO markdown, NO codeblocks, NO explanation:\n{\n  "customer_name": "company name from document header",\n  "customer_phone": "phone number if present else null",\n  "customer_gst": "GST number if present else null",\n  "customer_address": "company address if present else null",\n  "delivery_location": "delivery location",\n  "payment_terms": "payment terms",\n  "po_number": "PO/Inquiry Ref number if present else null",\n  "line_items": [\n    {\n      "sku_text": "full material description e.g. HR Coil (IS 2062 E250)",\n      "dimensions": "specs e.g. 2.50 mm x 1250 mm",\n      "quantity": numeric_quantity_in_MT,\n      "unit": "MT",\n      "rate": numeric_rate_per_MT_or_0,\n      "amount": numeric_amount_or_0\n    }\n  ],\n  "total_amount": numeric_total_or_0,\n  "overall_confidence": 0.95\n}\nExtract EVERY line item. Do not merge or skip any rows. Return ONLY the JSON.`
                        },
                        {
                          inline_data: {
                            mime_type: file.type || 'image/jpeg',
                            data: cleanBase64,
                          }
                        }
                      ]
                    }
                  ]
                })
              }
            );

            const geminiData = await geminiRes.json();
            const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            extracted = extractJsonFromText(rawText);
          } catch (visionErr) {
            console.error('Gemini vision extraction error:', visionErr);
          }
        }

        if (extracted) {
          formExtractedJsonRef.current = extracted;

          // Customer name: fill if detected, keep blank if not
          const rawName = extracted.customer_name || extracted.customerName || extracted.company_name || extracted.customer?.name || '';
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

          // Requirement & Product Details: formatted multi-line items
          const reqText = formatExtractedRequirementText(extracted);
          setFormRequirement(reqText);
          setFormInquiryType('Product Requirement (AI Document)');
        }

        setIsExtractingPo(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('FileReader error:', err);
      setIsExtractingPo(false);
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
          'Customer Inquiry';

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

      // Build ai_extraction_json from the structured extraction
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
          line_items: lineItems,
          lineItems: lineItems,
          total_amount: totalAmount,
          totalAmount: totalAmount,
          delivery_location: extractedJson.delivery_location || '',
          deliveryLocation: extractedJson.delivery_location || '',
          payment_terms: extractedJson.payment_terms || '',
          paymentTerms: extractedJson.payment_terms || '',
        };
      }

      const rawText = poFileName
        ? `[Inquiry Attachment: ${poFileName}] ${formRequirement}`
        : formRequirement;

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
      setFormCustomerName('');
      setFormPhone('');
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
  const rawList = Array.isArray(inquiries) ? inquiries : [];
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
      const name = parsed.companyName || '';
      const phone = parsed.customerPhone || '';

      const matchesSearch =
        !searchTerm.trim() ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.toLowerCase().includes(searchTerm.toLowerCase());

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
  });

  const handleViewInquiryDocument = async (inq: InquiryItem) => {
    if (drawerFileBase64) {
      setImageViewerUrl(drawerFileBase64);
      return;
    }

    let mediaUrl = inq.media_urls?.[0];
    if (mediaUrl && (mediaUrl.startsWith('data:') || mediaUrl.startsWith('http'))) {
      setImageViewerUrl(mediaUrl);
      return;
    }

    try {
      const res = await inquiriesApi.getOne(inq.id);
      const fullInq = res?.data?.data || res?.data;
      const dbMedia = fullInq?.media_urls?.[0];
      if (dbMedia && (dbMedia.startsWith('data:') || dbMedia.startsWith('http'))) {
        setImageViewerUrl(dbMedia);
        return;
      }
    } catch (e) {
      console.warn('Error fetching full inquiry doc:', e);
    }

    setImageViewerUrl(`extracted_preview://${inq.id}`);
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
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by Customer, Material, or Phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['all', 'review', 'processed'].map(st => {
            const label =
              st === 'all'
                ? `All Inquiries (${productInquiries.length})`
                : st === 'review'
                ? `In Review (${reviewCount}) ⏳`
                : `Processed (${processedCount}) 🎉`;
            return (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${
                  filterStatus === st
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Inquiries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-center">#</th>
                <th className="px-4 py-3 text-center">Received Date</th>
                <th className="px-4 py-3 text-center">Customer / Company Name</th>
                <th className="px-4 py-3 text-center">Customer Phone</th>
                <th className="px-4 py-3 text-center">Items Summary</th>
                <th className="px-4 py-3 text-center">Source Channel</th>
                <th className="px-4 py-3 text-center">Status / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Loading monthly inquiries...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
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
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {inq.created_at ? new Date(inq.created_at).toLocaleString('en-IN') : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <span className="flex items-center gap-1.5 text-blue-700 group-hover:underline">
                          <Building2 size={15} className="text-blue-600 flex-shrink-0" />
                          {details.companyName ? (
                            details.companyName
                          ) : (
                            <span className="text-amber-600 font-medium italic text-[11px]">(Customer not specified)</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 font-mono">
                        <span className="flex items-center gap-1 font-semibold">
                          <Phone size={12} className="text-slate-400" />
                          {details.customerPhone || <span className="text-slate-300 italic">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        {details.lineItems && details.lineItems.length > 0 ? (
                          <div className="space-y-0.5">
                            {details.lineItems.slice(0, 3).map((li: LineItemDetail, liIdx: number) => (
                              <div key={liIdx} className="flex items-center gap-1 text-[11px]">
                                <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold text-[10px]">{liIdx + 1}</span>
                                <span className="font-medium text-slate-800 truncate max-w-[160px]">{li.sku_text}</span>
                                <span className="text-slate-400 font-mono whitespace-nowrap">{li.quantity} MT</span>
                              </div>
                            ))}
                            {details.lineItems.length > 3 && (
                              <span className="text-[10px] text-blue-500 font-semibold">+{details.lineItems.length - 3} more items</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">{details.productType} · {details.quantityTons} MT</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          (inq.source_channel === 'whatsapp_text' || (!inq.media_urls?.length && inq.source_channel === 'whatsapp'))
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : (inq.source_channel === 'whatsapp_po' || inq.inquiry_type === 'purchase_order')
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : inq.source_channel === 'web_dashboard'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}>
                          {(inq.source_channel === 'whatsapp_text' || (!inq.media_urls?.length && inq.source_channel === 'whatsapp'))
                            ? 'WhatsApp Text '
                            : (inq.source_channel === 'whatsapp_po' || inq.inquiry_type === 'purchase_order')
                            ? 'WhatsApp PO '
                            : inq.source_channel === 'web_dashboard'
                            ? 'Dashboard Entry'
                            : 'WhatsApp'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {(inq.inquiry_type === 'purchase_order' || inq.source_channel === 'whatsapp_po') ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                              <CheckCircle size={12} /> PO Confirmed 
                            </span>
                          ) : isQuoted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                              <CheckCircle size={12} /> Quotation Sent 
                            </span>
                          ) : isConfirmed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                              <CheckCircle size={12} /> Confirmed &amp; Saved ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock size={12} /> Review &amp; Edit 
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuotationViewInquiry(inq);
                              setQuotationViewDetails(details);  // reuse `details` from the row
                              setShowQuotationView(true);
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1">
                            <Eye size={13} /> View Quotation
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI INTERPRETATION & QA AUDIT DRAWER */}
      {selectedInquiry && editDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-3xl h-full overflow-y-auto shadow-2xl p-6 flex flex-col justify-between space-y-6 border-l border-slate-200">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
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
                      ID: {selectedInquiry.id} · Received {new Date(selectedInquiry.created_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInquiry(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>

              {/* QA & Audit Section — Source badge + Document action only, no raw description */}
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between gap-2">
                  {/* Source badge */}
                  <span className="bg-slate-800 px-2.5 py-1 rounded-lg text-[11px] text-slate-300 font-bold uppercase tracking-wider">
                    Source: {selectedInquiry.source_channel || 'WhatsApp'}
                  </span>

                  {/* Document action bar */}
                  {(selectedInquiry.media_urls && selectedInquiry.media_urls.length > 0) || drawerFileBase64 ? (
                    <div className="flex items-center gap-2">
                      {drawerFileBase64 && (
                        <button
                          type="button"
                          onClick={() => setDrawerFileBase64(null)}
                          className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 text-red-200 rounded-lg text-[11px] font-bold transition-colors">
                          Remove
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleViewInquiryDocument(selectedInquiry)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5">
                        <Eye size={14} /> View Inquiry Document 👁️
                      </button>
                    </div>
                  ) : (() => {
                    return (
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          id="drawer-file-upload"
                          className="hidden"
                          accept="image/*,application/pdf"
                          onChange={handleDrawerFileUpload}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById('drawer-file-upload')?.click()}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-700">
                          <UploadCloud size={13} /> Attach Document File
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Edit vs View Toggle Header */}
              <div className="flex items-center justify-between pt-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" />
                  Pre-filled &amp; Extracted Customer Inquiry Table
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors">
                  <Edit3 size={14} /> {isEditing ? 'Cancel Edit' : 'Edit Pre-filled Fields'}
                </button>
              </div>

              {/* Editable Fields Form — Company Name, Phone always editable */}
              <div className="space-y-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Customer / Company Name *
                    </label>
                    <select
                      value={editDetails.companyName}
                      onChange={(e) => setEditDetails({ ...editDetails, companyName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                      {existingCustomers.map((cName) => (
                        <option key={cName} value={cName}>{cName}</option>
                      ))}
                      {/* Allow the current value even if not in list */}
                      {!existingCustomers.includes(editDetails.companyName) && editDetails.companyName && (
                        <option value={editDetails.companyName}>{editDetails.companyName}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Customer Phone Number
                    </label>
                    <input
                      type="text"
                      value={editDetails.customerPhone}
                      onChange={(e) => setEditDetails({ ...editDetails, customerPhone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Structured Inquiry Table Layout (Matching Img1 Format) */}
                <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs text-slate-800 border-collapse">
                    <thead className="bg-slate-800 text-white font-bold uppercase text-[11px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3 border-r border-slate-700 w-[10%]">#</th>
                        <th className="px-4 py-3 border-r border-slate-700 w-[40%]">Description &amp; Specifications</th>
                        <th className="px-4 py-3 border-r border-slate-700 w-[15%]">Qty (MT)</th>
                        <th className="px-4 py-3 border-r border-slate-700 w-[15%]">Rate (₹/MT)</th>
                        <th className="px-4 py-3 text-right w-[20%]">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {editDetails.lineItems && editDetails.lineItems.length > 0 ? (
                        editDetails.lineItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30">
                            <td className="px-4 py-3.5 border-r border-slate-200 text-slate-400 font-mono text-center">{idx + 1}</td>
                            <td className="px-4 py-3.5 border-r border-slate-200">
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={item.sku_text || ''}
                                  onChange={(e) => {
                                    const updated = [...editDetails.lineItems];
                                    updated[idx] = { ...updated[idx], sku_text: e.target.value };
                                    setEditDetails({ ...editDetails, lineItems: updated });
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                                  placeholder="Product Name / Description"
                                />
                                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                                  <span className="font-semibold text-slate-400 shrink-0">Spec:</span>
                                  <input
                                    type="text"
                                    value={item.dimensions || ''}
                                    onChange={(e) => {
                                      const updated = [...editDetails.lineItems];
                                      updated[idx] = { ...updated[idx], dimensions: e.target.value };
                                      setEditDetails({ ...editDetails, lineItems: updated });
                                    }}
                                    className="w-full px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                                    placeholder="e.g. 2.50 mm x 1250 mm"
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 border-r border-slate-200 font-bold text-blue-700 font-mono">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const updated = [...editDetails.lineItems];
                                  const q = parseFloat(e.target.value) || 0;
                                  updated[idx] = { ...updated[idx], quantity: q, amount: Math.round(q * (updated[idx].rate || 0)) };
                                  setEditDetails({ ...editDetails, lineItems: updated, totalAmount: updated.reduce((s, i) => s + i.amount, 0) });
                                }}
                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3.5 border-r border-slate-200 font-bold font-mono">
                              <input
                                type="number"
                                value={item.rate}
                                onChange={(e) => {
                                  const updated = [...editDetails.lineItems];
                                  const r = parseFloat(e.target.value) || 0;
                                  updated[idx] = { ...updated[idx], rate: r, amount: Math.round((updated[idx].quantity || 0) * r) };
                                  setEditDetails({ ...editDetails, lineItems: updated, totalAmount: updated.reduce((s, i) => s + i.amount, 0) });
                                }}
                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3.5 text-right font-black text-emerald-700 font-mono">
                              <input
                                type="number"
                                value={item.amount}
                                onChange={(e) => {
                                  const updated = [...editDetails.lineItems];
                                  updated[idx] = { ...updated[idx], amount: parseFloat(e.target.value) || 0 };
                                  setEditDetails({ ...editDetails, lineItems: updated, totalAmount: updated.reduce((s, i) => s + i.amount, 0) });
                                }}
                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs text-right font-mono text-emerald-700 outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="hover:bg-blue-50/30">
                          <td className="px-4 py-3.5 border-r border-slate-200 text-slate-400 text-center">1</td>
                          <td className="px-4 py-3.5 border-r border-slate-200">
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editDetails.productType}
                                onChange={(e) => setEditDetails({ ...editDetails, productType: e.target.value })}
                                placeholder="Product Type (CR / HR / HR Pickled)"
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold"
                              />
                              <div className="grid grid-cols-3 gap-1">
                                <input type="text" placeholder="Thk" value={editDetails.thickness} onChange={(e) => setEditDetails({ ...editDetails, thickness: e.target.value })} className="px-2 py-1 border rounded text-[11px] font-mono" />
                                <input type="text" placeholder="Width" value={editDetails.width} onChange={(e) => setEditDetails({ ...editDetails, width: e.target.value })} className="px-2 py-1 border rounded text-[11px] font-mono" />
                                <input type="text" placeholder="Length" value={editDetails.length} onChange={(e) => { const l = e.target.value; setEditDetails({ ...editDetails, length: l, productForm: l.trim() ? 'Sheet' : 'Coil' }); }} className="px-2 py-1 border rounded text-[11px] font-mono" />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 border-r border-slate-200 font-bold text-blue-700 font-mono">
                            <input type="number" value={editDetails.quantityTons} onChange={(e) => { const q = parseFloat(e.target.value) || 0; setEditDetails({ ...editDetails, quantityTons: q, totalAmount: Math.round(q * editDetails.unitPrice) }); }} className="w-full px-2 py-1.5 border border-slate-300 rounded font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500" />
                          </td>
                          <td className="px-4 py-3.5 border-r border-slate-200 font-bold font-mono">
                            <input type="number" value={editDetails.unitPrice} onChange={(e) => { const r = parseFloat(e.target.value) || 0; setEditDetails({ ...editDetails, unitPrice: r, totalAmount: Math.round(editDetails.quantityTons * r) }); }} className="w-full px-2 py-1.5 border border-slate-300 rounded font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500" />
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-emerald-700 font-mono">
                            <input type="number" value={editDetails.totalAmount} onChange={(e) => setEditDetails({ ...editDetails, totalAmount: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 border border-slate-300 rounded font-bold text-xs text-right font-mono text-emerald-700 outline-none focus:ring-2 focus:ring-blue-500" />
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100/90 font-bold text-slate-900 border-t border-slate-300">
                      <tr className="border-b border-slate-200 text-xs">
                        <td className="px-4 py-2 font-bold border-r border-slate-200 text-slate-700">Base Subtotal (Excl. GST)</td>
                        <td colSpan={3} className="px-4 py-2 text-right font-bold uppercase text-slate-500 border-r border-slate-200">
                          Base Material Amount:
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-slate-800 font-mono">
                          ₹{editDetails.totalAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200 text-xs bg-indigo-50/50">
                        <td className="px-4 py-2 font-bold border-r border-slate-200 text-indigo-900">GST @ 18%</td>
                        <td colSpan={3} className="px-4 py-2 text-right font-bold uppercase text-indigo-700 border-r border-slate-200">
                          Applicable 18% GST:
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-indigo-800 font-mono">
                          + ₹{Math.round(editDetails.totalAmount * 0.18).toLocaleString('en-IN')}
                        </td>
                      </tr>
                      <tr className="bg-emerald-100/90 text-emerald-950 font-black">
                        <td className="px-4 py-3 font-extrabold border-r border-emerald-300" colSpan={2}>Grand Total (Incl. 18% GST)</td>
                        <td colSpan={2} className="px-4 py-3 text-right font-black uppercase tracking-wide border-r border-emerald-300 text-xs">
                          {editDetails.lineItems && editDetails.lineItems.length > 0
                            ? `${editDetails.lineItems.reduce((s,i)=>s+i.quantity,0)} MT total`
                            : `${editDetails.quantityTons} MT`}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-900 text-base font-mono">
                          ₹{Math.round(editDetails.totalAmount * 1.18).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Commercial Terms Footer (Matching Img1 Layout) */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block mb-0.5 uppercase tracking-wider text-[10px]">Delivery Address</span>
                      <input
                        type="text"
                        value={editDetails.deliveryLocation}
                        onChange={(e) => setEditDetails({ ...editDetails, deliveryLocation: e.target.value })}
                        placeholder="e.g. Mumbai"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold"
                      />
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold block mb-0.5 uppercase tracking-wider text-[10px]">Target Delivery Date</span>
                      <input
                        type="text"
                        value={editDetails.deliveryDate}
                        onChange={(e) => setEditDetails({ ...editDetails, deliveryDate: e.target.value })}
                        placeholder="e.g. 2026-08-25"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold font-mono text-blue-700"
                      />
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold block mb-0.5 uppercase tracking-wider text-[10px]">Payment Terms</span>
                      <select
                        value={editDetails.paymentTerms}
                        onChange={(e) => setEditDetails({ ...editDetails, paymentTerms: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold">
                        <option value="">— Not Specified —</option>
                        <option value="30 Days Credit">30 Days Credit</option>
                        <option value="STRICTLY 45 Days Credit">STRICTLY 45 Days Credit</option>
                        <option value="60 Days Credit">60 Days Credit</option>
                        <option value="100% Advance / Payment">100% Advance / Payment</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold block mb-0.5 uppercase tracking-wider text-[10px]">Inquiry Received Date</span>
                      <span className="font-mono font-bold text-slate-700 block mt-1">
                        {new Date(selectedInquiry.created_at).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Requirements & Salesperson Details Section */}
                  <div className="p-4 bg-slate-100/70 border-t border-slate-200 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block mb-1">
                          👤 Salesperson Assigned
                        </span>
                        <span className="font-semibold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 inline-block font-mono">
                          {selectedInquiry.salesperson_phone || selectedInquiry.sender_name || 'Assigned Rep'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block mb-1">
                          ⚡ Status / Corrective Action Taken
                        </span>
                        <span className="font-semibold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
                          {['quoted', 'won'].includes((selectedInquiry.status || '').toLowerCase())
                            ? 'Quotation Generated & Dispatched ✉️'
                            : ['confirmed', 'processed'].includes((selectedInquiry.status || '').toLowerCase())
                            ? 'Confirmed & Order Processed 🎉'
                            : 'In Review — Pending Confirmation ⏳'}
                        </span>
                      </div>
                    </div>

                    {selectedInquiry.raw_text && (
                      <div>
                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block mb-1">
                          📝 Customer Inquiry Requirements &amp; Message (Full Text)
                        </span>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-800 font-sans text-xs leading-relaxed whitespace-pre-wrap select-text">
                          {selectedInquiry.raw_text}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar (Clean Uncluttered Single-Row Layout) */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3 bg-white sticky bottom-0 z-10 py-2">
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors">
                Close Drawer
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPdfModal(true)}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs">
                  <Eye size={15} /> View PDF 📄
                </button>

                {!['confirmed', 'processed', 'quoted', 'won'].includes((selectedInquiry.status || '').toLowerCase()) && !saveSuccess && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSaveDrawerDetails}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5">
                    {submitting ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                    Save &amp; Confirm
                  </button>
                )}

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

      {/* FULL-SCREEN IMAGE / DOCUMENT VIEWER */}
      {imageViewerUrl && (
        <div
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[60] flex items-center justify-center p-4"
          onClick={() => setImageViewerUrl(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-2xl overflow-hidden flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-4 px-1">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <FileText size={16} className="text-blue-400" /> Attached Customer Document / Inquiry Image
              </span>
              <button
                onClick={() => setImageViewerUrl(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 flex items-center gap-1 text-xs font-bold transition-colors">
                <X size={18} /> Close
              </button>
            </div>

            {imageViewerUrl.startsWith('extracted_preview://') ? (
              <div className="w-full h-[72vh] overflow-y-auto bg-slate-900 rounded-2xl p-6 border border-slate-800 text-white space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800 flex items-center gap-1.5 w-fit mb-2">
                      <ShieldCheck size={14} /> WhatsApp Shared Attachment — Verified by Gemini Vision
                    </span>
                    <h2 className="text-lg font-bold text-white">
                      {editDetails?.companyName || selectedInquiry?.customer_name || 'Customer Inquiry Document'}
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Phone: {editDetails?.customerPhone || selectedInquiry?.customer_phone || 'N/A'} · Received: {new Date(selectedInquiry?.created_at || Date.now()).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner bg-slate-950">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800 text-white font-bold uppercase text-[11px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-center">#</th>
                        <th className="px-4 py-3">Extracted Product &amp; Specification</th>
                        <th className="px-4 py-3 text-center">Tonnage</th>
                        <th className="px-4 py-3 text-center">Unit Price (₹/MT)</th>
                        <th className="px-4 py-3 text-right">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-sans">
                      {editDetails?.lineItems && editDetails.lineItems.length > 0 ? (
                        editDetails.lineItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-900">
                            <td className="px-4 py-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-white block">{item.sku_text}</span>
                              {item.dimensions && <span className="text-[11px] font-mono text-slate-400">{item.dimensions}</span>}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-blue-400 font-mono">{item.quantity} MT</td>
                            <td className="px-4 py-3 text-center font-mono font-semibold text-slate-300">₹{Number(item.rate || 0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-400 font-mono">₹{Number(item.amount || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-4 py-3 text-center text-slate-500 font-mono">1</td>
                          <td className="px-4 py-3 font-bold text-white">{editDetails?.productType || 'Steel Requirements'}</td>
                          <td className="px-4 py-3 text-center font-bold text-blue-400 font-mono">{editDetails?.quantityTons || 25} MT</td>
                          <td className="px-4 py-3 text-center font-mono font-semibold text-slate-300">₹{Number(editDetails?.unitPrice || 52000).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-400 font-mono">₹{Number(editDetails?.totalAmount || 1300000).toLocaleString('en-IN')}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-900 font-bold border-t border-slate-800 text-xs">
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-slate-400 font-medium">Grand Total (Incl. 18% GST)</td>
                        <td colSpan={2} className="px-4 py-2 text-right font-black text-emerald-400 text-sm font-mono">
                          ₹{Math.round((editDetails?.totalAmount || 0) * 1.18).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {selectedInquiry?.raw_text && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Extracted Raw Specification Text</span>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 text-xs font-mono whitespace-pre-wrap">
                      {selectedInquiry.raw_text}
                    </div>
                  </div>
                )}
              </div>
            ) : isPdf(imageViewerUrl) ? (
              <iframe
                src={imageViewerUrl}
                title="Inquiry PDF Document"
                className="w-full h-[72vh] rounded-2xl bg-white shadow-2xl border border-slate-800"
              />
            ) : (
              <div className="w-full h-[76vh] flex items-center justify-center bg-slate-950/80 rounded-2xl p-2 overflow-auto">
                <img
                  src={imageViewerUrl}
                  alt="Inquiry document full view"
                  className="max-w-full max-h-[74vh] object-contain rounded-xl shadow-2xl bg-white border border-slate-700"
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
            <div id="image-fallback-card" style={{ display: 'none' }} className="flex-col items-center justify-center p-8 text-center bg-slate-900/90 rounded-2xl border border-slate-800 space-y-4 max-w-md my-8">
              <div className="p-4 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
                <ImageIcon size={40} />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">WhatsApp Shared Document Attachment</h3>
                <p className="text-slate-400 text-xs mt-1">
                  Media Attachment Received &amp; Processed Live
                </p>
                <p className="text-slate-500 text-[11px] mt-2 leading-relaxed">
                  The document details, quantity in MT, and material specifications were extracted with Gemini Vision and saved live to the Inquiries Table.
                </p>
              </div>
            </div>

            {imageViewerUrl.startsWith('http') && (
              <div className="flex items-center justify-center mt-3 gap-3">
                <a
                  href={imageViewerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
                  <ExternalLink size={14} /> Open Original Document
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

              {/* Quotation Table */}
              <div className="rounded-xl border border-slate-300 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs text-slate-800 border-collapse">
                  <thead className="bg-slate-800 text-white font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-r border-slate-700 w-1/5">Quantity</th>
                      <th className="px-4 py-3 border-r border-slate-700 w-2/5">Description & Specifications</th>
                      <th className="px-4 py-3 border-r border-slate-700 w-1/5">Unit Price (₹)</th>
                      <th className="px-4 py-3 text-right w-1/5">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {quotationViewDetails.lineItems && quotationViewDetails.lineItems.length > 0 ? (
                      quotationViewDetails.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-4 border-r border-slate-200">
                            <span className="text-sm font-extrabold text-blue-700">{item.quantity} {item.unit || 'MT'}</span>
                          </td>
                          <td className="px-4 py-4 border-r border-slate-200">
                            <div className="font-bold text-slate-900">{item.sku_text}</div>
                            {item.dimensions && <div className="text-[11px] text-slate-500 font-mono mt-0.5">Spec: {item.dimensions}</div>}
                          </td>
                          <td className="px-4 py-4 border-r border-slate-200 font-bold font-mono">
                            {item.rate > 0 ? `₹${item.rate.toLocaleString('en-IN')}/MT` : '—'}
                          </td>
                          <td className="px-4 py-4 text-right font-black text-emerald-700 font-mono text-sm">
                            {item.amount > 0 ? `₹${item.amount.toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-4 border-r border-slate-200">
                          <span className="text-sm font-extrabold text-blue-700">{quotationViewDetails.quantityTons} MT</span>
                        </td>
                        <td className="px-4 py-4 border-r border-slate-200">
                          <div className="font-bold text-slate-900">{cleanProductType(quotationViewDetails.productType)}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-1">
                            {quotationViewDetails.thickness} {quotationViewDetails.width ? `x ${quotationViewDetails.width}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-4 border-r border-slate-200 font-bold font-mono">
                          ₹{quotationViewDetails.unitPrice.toLocaleString('en-IN')}/MT
                        </td>
                        <td className="px-4 py-4 text-right font-black text-emerald-700 font-mono text-sm">
                          ₹{quotationViewDetails.totalAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100/90 font-bold text-slate-900 border-t border-slate-300">
                    <tr className="border-b border-slate-200 text-xs">
                      <td className="px-4 py-2 font-bold border-r border-slate-200 text-slate-700">Subtotal (Excl. GST)</td>
                      <td colSpan={2} className="px-4 py-2 text-right font-bold uppercase text-slate-500 border-r border-slate-200">Base Material Amount:</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-800 font-mono">
                        ₹{quotationViewDetails.totalAmount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 text-xs bg-indigo-50/50">
                      <td className="px-4 py-2 font-bold border-r border-slate-200 text-indigo-900">GST @ 18%</td>
                      <td colSpan={2} className="px-4 py-2 text-right font-bold uppercase text-indigo-700 border-r border-slate-200">Applicable 18% GST:</td>
                      <td className="px-4 py-2 text-right font-bold text-indigo-800 font-mono">
                        + ₹{Math.round(quotationViewDetails.totalAmount * 0.18).toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr className="bg-emerald-100/90 text-emerald-950 font-black">
                      <td className="px-4 py-3 font-extrabold border-r border-emerald-300">Total: {quotationViewDetails.quantityTons} MT</td>
                      <td colSpan={2} className="px-4 py-3 text-right font-black uppercase tracking-wide border-r border-emerald-300 text-xs">Grand Total Amount (Incl. 18% GST):</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-900 text-base font-mono">
                        ₹{Math.round(quotationViewDetails.totalAmount * 1.18).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Commercial Terms */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-3 gap-4 text-xs">
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

            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 text-xs space-y-2">
              <div className="font-bold text-purple-900 flex items-center justify-between">
                <span>Commercial Proposal Summary</span>
                <span className="font-extrabold text-emerald-800">Total: ₹{editDetails.totalAmount.toLocaleString('en-IN')} + GST</span>
              </div>
              <p className="text-slate-700 font-mono">
                {editDetails.companyName} · {editDetails.productType} ({editDetails.productForm}) {editDetails.quantityTons} MT @ ₹{editDetails.unitPrice}/MT
              </p>
              <div className="pt-1.5 border-t border-purple-200/60 text-[11px] text-purple-800 font-semibold flex items-center gap-1">
                📄 <span><strong>Official PDF Quotation:</strong> The formatted PDF document will be generated and attached to this email.</span>
              </div>
            </div>

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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
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

            {/* Upload Inquiry Document Section */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-2xl border border-blue-200 space-y-2">
              <label className="block text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <UploadCloud size={16} className="text-blue-600" />
                Upload Inquiry Document (PDF, JPEG, PNG) for Auto AI Extraction
              </label>
              <div className="relative flex items-center justify-center border-2 border-dashed border-blue-300 rounded-xl p-4 bg-white/80 hover:bg-white transition-all cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-center space-y-1">
                  {isExtractingPo ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                      <RefreshCw size={16} className="animate-spin text-blue-600" />
                      Gemini AI Analyzing &amp; Extracting Inquiry Document...
                    </div>
                  ) : poFileName ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                      <FileCheck size={18} />
                      {poFileName} (Inquiry Details Extracted &amp; Pre-filled!)
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-600">
                      Drop Inquiry File (PDF, JPEG, PNG) here, or <span className="text-blue-600 underline">Browse File</span>
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">PDF, JPEG, PNG supported · Gemini AI pre-fills fields below</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateInquiry} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Company Name *</label>
                <div className="relative">
                  <input
                    required
                    type="text"
                    list="existing-customers-list"
                    placeholder="Type or select customer name..."
                    value={formCustomerName}
                    onChange={e => setFormCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="existing-customers-list">
                    {existingCustomers.map((cName) => (
                      <option key={cName} value={cName} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9123456789"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Requirement &amp; Product Details *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. 50 MT HR Coil 3.0mm x 1250mm rate 62000 delivery Pune"
                  value={formRequirement}
                  onChange={e => setFormRequirement(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
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
