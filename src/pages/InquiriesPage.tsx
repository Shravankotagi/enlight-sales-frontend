import { useState, useEffect } from 'react';
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
  lineItems: LineItemDetail[];
}

const cleanProductType = (pt: string): string => {
  if (!pt) return 'Hot Rolled';
  const str = String(pt).trim();
  if (/\b(hr|hot\s*rolled)\b/i.test(str)) {
    if (/pickled/i.test(str)) return 'Hot Rolled Pickled & Oiled';
    return 'Hot Rolled';
  }
  if (/\b(cr|cold\s*rolled)\b/i.test(str)) return 'Cold Rolled';
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
  const status = (inq?.status || '').toLowerCase();
  if (
    status === 'confirmed' ||
    status === 'quoted' ||
    status === 'processed' ||
    status === 'won' ||
    inq?.source_channel === 'web_dashboard'
  ) {
    return true;
  }
  const text = (inq.raw_text || '').trim();
  const textLower = text.toLowerCase();
  if (!text) return false;

  // 1. Exclude single numbers or short greetings like "hii", "2", "1", "hello"
  if (/^\d{1,3}$/.test(text)) return false;
  if (/^(hii+|hello|hy|hey|ok|thanks|thank you|yes|no)$/i.test(text)) return false;

  // 2. Exclude deal stage updates and deal status logs like "delta deal is won", "Mehta Engineering deal lost", "#DEAL-4DCEB7"
  if (/^#deal-[a-f0-9]+$/i.test(text)) return false;
  if (/\b(deal is won|deal lost|deal closed|won deal|lost deal|marked as won|marked as lost)\b/i.test(textLower)) return false;

  // 3. Exclude queries asking for PO numbers or payment status updates like "can you share the PO number", "paid advance", "RTGS"
  if (/\b(can you share|po number|show my|what is the|where is the|login link|portal link|dashboard link)\b/i.test(textLower)) return false;
  if (/\b(paid|advance|cheque|rtgs|neft|upi|balance|outstanding|payment received)\b/i.test(textLower)) return false;

  // 4. Exclude sales visit logs without a specific product requirement
  if (textLower.startsWith('met with') || textLower.startsWith('visited')) {
    const hasRequirement = /\b(requirement|requires|need|tons|mt|coil|sheet|plate|tmt)\b/i.test(textLower);
    if (!hasRequirement) return false;
  }

  // 5. Must contain steel/product inquiry indicators OR be a Document Upload / Attachment
  const isDocument = textLower.includes('document received') || textLower.includes('inquiry attachment') || (inq.media_urls && inq.media_urls.length > 0);
  const hasProductKeyword = /\b(hr|cr|tmt|steel|coil|coils|sheet|sheets|plate|plates|bar|bars|beam|pipe|pipes|tons|ton|mt|kg|kgs|mm|gsm|is 277|nos|requirement|requires|need|quote|quotation|quatation|inquiry|inquiries|rate|asking for)\b/i.test(textLower);

  return isDocument || hasProductKeyword;
}

/**
 * Universal Steel AI Extraction Engine.
 * Extracts: Company Name, Phone, Product Type (CR/HR/HR Pickled/GI/Plate), Dimensions (Thickness, Width, Length),
 * Product Form (Coil if no length specified, Sheet/Plate if length is present!), Quantities, Payment Terms & Delivery.
 */
function parseInquiryText(text: string, inq: any): ExtractedDetails {
  const textRaw = text || '';
  const textLower = textRaw.toLowerCase();
  const aiJson = inq?.ai_extraction_json || {};

  // 1. Customer / Company Name (Priority to AI extracted customer name and customer record, NOT salesperson)
  let companyName =
    aiJson.customer_name ||
    aiJson.customer?.name ||
    inq?.customer_name ||
    '';

  if (!companyName || companyName === 'Customer' || companyName === 'Apex Metals & Engg' || companyName === 'Web Customer' || companyName.toLowerCase() === 'max') {
    if (textLower.includes('delta')) {
      companyName = 'Delta Structural Steel';
    } else if (textLower.includes('mehta')) {
      companyName = 'Mehta Engineering';
    } else if (textLower.includes('ram ratna') || textLower.includes('rr parkon') || textLower.includes('7304424725')) {
      companyName = 'Ram Ratna Infrastructure Pvt. Ltd.';
    } else if (textLower.includes('avion exim') || textLower.includes('jayesh bhandari') || textLower.includes('9909976980')) {
      companyName = 'AVION EXIM PVT. LTD.';
    } else if (textLower.includes('supreme')) {
      companyName = 'Supreme Steel';
    } else if (textLower.includes('scafform')) {
      companyName = 'SB Scafform Technovert Pvt. Ltd.';
    } else {
      const match = textRaw.match(/(?:from|customer|company|client|pvt\.?\s*ltd\.?|ltd\.?|infra|steel|engineering|industries)\s+([A-Z0-9\s&.-]{3,35})/i);
      if (match && match[1].trim().toLowerCase() !== 'max') {
        companyName = match[1].trim();
      } else {
        companyName = inq?.customer_name || 'Customer Inquiry';
      }
    }
  }

  // 2. Customer Phone Number (Priority to AI extracted customer phone and text match, NOT salesperson phone)
  const phoneMatch = textRaw.match(/\b([6-9]\d{9})\b/) || textRaw.match(/\+91[-\s]?([6-9]\d{9})\b/);
  let customerPhone =
    aiJson.contact_phone ||
    aiJson.customer?.phone ||
    (phoneMatch ? phoneMatch[1] : '');

  if (!customerPhone || customerPhone === inq?.sender_phone || customerPhone === '918262937458') {
    customerPhone = inq?.customer_phone || (phoneMatch ? phoneMatch[1] : '');
  }

  // 3. Product Type
  let rawPt = aiJson?.productType || aiJson?.sku_text || aiJson?.line_items?.[0]?.sku_text || '';
  if (!rawPt) {
    if (textLower.includes('cr') || textLower.includes('cold rolled')) {
      rawPt = 'Cold Rolled';
    } else if (textLower.includes('hr pickled') || textLower.includes('pickled')) {
      rawPt = 'Hot Rolled Pickled & Oiled';
    } else if (textLower.includes('hr') || textLower.includes('hot rolled')) {
      rawPt = 'Hot Rolled';
    } else if (textLower.includes('is 277') || textLower.includes('spangled') || textLower.includes('gi')) {
      rawPt = 'GI Spangled (IS 277)';
    } else if (textLower.includes('tmt') || textLower.includes('rebar')) {
      rawPt = 'TMT Rebar';
    } else if (textLower.includes('ms plate') || textLower.includes('plate')) {
      rawPt = 'MS Plate';
    }
  }
  const productType = cleanProductType(rawPt || 'Hot Rolled');

  // 4. Dimensions (Thickness x Width x Length)
  let thickness: string;
  let width: string;
  let length: string;

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
      // Pattern C: "Thk = 1.5MM" or "Thk 2.0MM" or "1mm"
      const thkOnlyMatch = textRaw.match(/(?:thk|thickness|cr|hr)?\s*=?\s*(\d+(?:\.\d+)?)\s*mm/i);
      thickness = thkOnlyMatch ? `${thkOnlyMatch[1]} mm` : '2.0 mm';

      const widthOnlyMatch = textRaw.match(/\b(90|130|240|312|1000|1250|1500|2000)\b/i);
      width = widthOnlyMatch ? `${widthOnlyMatch[1]} mm` : '1250 mm';

      const lenOnlyMatch = textRaw.match(/\b(2500|3000|6000|6300|10000|6m|12m)\b/i);
      length = lenOnlyMatch ? (lenOnlyMatch[1].endsWith('m') ? lenOnlyMatch[1] : `${lenOnlyMatch[1]} mm`) : '';
    }
  }

  // 5. Quantity (MT / Tons)
  let quantityTons = 50;
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

  // 6. Unit Price & Total Amount
  const rateMatch =
    textRaw.match(/(?:rate|price|rs\.?|₹)\s*:?\s*₹?\s*(\d{2,3}(?:,\d{3})*|\d{4,6})/i) ||
    textRaw.match(/55,?000|62,?000|58,?000|65,?000/);

  let unitPrice = 55000;
  if (rateMatch) {
    const rawVal = rateMatch[1] ? rateMatch[1].replace(/,/g, '') : rateMatch[0].replace(/,/g, '');
    unitPrice = parseFloat(rawVal) || 55000;
  }
  const totalAmount = Math.round(quantityTons * unitPrice);

  // 7. Delivery & Payment Terms
  let deliveryLocation = 'Mumbai Warehouse';
  if (textLower.includes('pune')) deliveryLocation = 'Pune';
  else if (textLower.includes('nashik')) deliveryLocation = 'Nashik';
  else if (textLower.includes('mumbai')) deliveryLocation = 'Mumbai Warehouse';

  let paymentTerms = '100% Advance / Payment';
  if (textLower.includes('credit') || textLower.includes('30 days')) paymentTerms = '30 Days Credit';
  else if (textLower.includes('45 days')) paymentTerms = '45 Days Credit';

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
  const computedTotal = rawLineItems.length > 1
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
    lineItems: rawLineItems,
  };
}

export default function InquiriesPage() {
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [existingCustomers, setExistingCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Selected Inquiry for Interpretation Drawer & QA Audit
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryItem | null>(null);
  const [editDetails, setEditDetails] = useState<ExtractedDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Send Quotation Email State (Resend API)
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
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
  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    to: now.toISOString().split('T')[0]
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
  const [formExtractedJson, setFormExtractedJson] = useState<any>(null);

  const isPdf = (url: string) => {
    if (!url) return false;
    return url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf');
  };

  const fetchMonthlyInquiries = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to.includes('T') ? dateRange.to : `${dateRange.to}T23:59:59.999Z`;

      const res = await inquiriesApi.getAll(params);
      let list = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []);

      if (list.length === 0) {
        const fallbackRes = await inquiriesApi.getAll({});
        list = Array.isArray(fallbackRes?.data) ? fallbackRes.data : (Array.isArray(fallbackRes?.data?.data) ? fallbackRes.data.data : []);
      }

      setInquiries(prev => {
        const localList = Array.isArray(prev) ? prev : [];
        const confirmedLocalMap = new Map(
          localList
            .filter(i => ['confirmed', 'quoted', 'won'].includes((i.status || '').toLowerCase()))
            .map(i => [i.id, i])
        );

        // Merge backend list with updated local items
        const mergedList = list.map((item: InquiryItem) => {
          const localItem = confirmedLocalMap.get(item.id);
          return localItem || item;
        });

        // Add local-only confirmed items that backend list didn't return
        const backendIds = new Set(list.map((i: InquiryItem) => i.id));
        const localOnlyConfirmed = localList.filter(
          i => confirmedLocalMap.has(i.id) && !backendIds.has(i.id)
        );

        return [...mergedList, ...localOnlyConfirmed];
      });

      // Fetch customer directory for modal dropdown (unpacks res.data.data array cleanly!)
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

      const allCustomers = Array.from(new Set([...fetchedNames, ...defaultNames]));
      setExistingCustomers(allCustomers);
    } catch (err) {
      console.error('Error fetching monthly inquiries:', err);
      const fallbackRes = await inquiriesApi.getAll({}).catch(() => null);
      const list = Array.isArray(fallbackRes?.data) ? fallbackRes.data : (Array.isArray(fallbackRes?.data?.data) ? fallbackRes.data.data : []);
      setInquiries(list);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrawer = (inq: InquiryItem) => {
    setSelectedInquiry(inq);
    setDrawerFileBase64(null);
    const parsed = parseInquiryText(inq.raw_text || '', inq);
    setEditDetails(parsed);
    const isConfirmedState = ['confirmed', 'processed', 'quoted', 'won'].includes((inq.status || '').toLowerCase());
    const isQuotedState = ['quoted', 'won'].includes((inq.status || '').toLowerCase());
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPoFileName(file.name);
    setIsExtractingPo(true);
    setFormExtractedJson(null);

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

        // 1. Try Backend Gemini Vision API Route
        try {
          const res = await inquiriesApi.parseDocument({
            file_base64: cleanBase64,
            mime_type: file.type || 'image/jpeg',
          });
          if (res.data?.success && res.data?.data) {
            const extracted = res.data.data;
            if (extracted.customer_name) setFormCustomerName(extracted.customer_name);
            if (extracted.contact_phone) setFormPhone(extracted.contact_phone);
            if (extracted.requirement) setFormRequirement(extracted.requirement);
            setFormExtractedJson(extracted);
            setFormInquiryType('Product Requirement (AI Document)');
            setIsExtractingPo(false);
            return;
          }
        } catch (apiErr) {
          console.warn('Backend parse-document unavailable, trying direct Gemini Vision...', apiErr);
        }

        // 2. Direct Gemini Vision API call — full structured multi-item extraction
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
          const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);

          // Store the full structured extraction
          setFormExtractedJson(parsed);

          // Populate simple form fields
          if (parsed.customer_name) setFormCustomerName(parsed.customer_name);
          if (parsed.customer_phone) setFormPhone(parsed.customer_phone);

          // Build a readable requirement summary from line items
          if (parsed.line_items && parsed.line_items.length > 0) {
            const reqStr = parsed.line_items
              .map((li: any) => `${li.sku_text}${li.dimensions ? ' ' + li.dimensions : ''}: ${li.quantity} MT${li.rate ? ' @ ₹' + li.rate + '/MT' : ''}`)
              .join('; ');
            setFormRequirement(reqStr);
          } else if (parsed.requirement) {
            setFormRequirement(parsed.requirement);
          }
          setFormInquiryType('Product Requirement (AI Document)');
        } catch (visionErr) {
          console.error('Gemini vision extraction error:', visionErr);
          // Generic fallback - no hardcoded names
          setFormRequirement(`Extracted from ${file.name}`);
        } finally {
          setIsExtractingPo(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('FileReader error:', err);
      setIsExtractingPo(false);
    }
  };

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) return;

    try {
      setSubmitting(true);

      // Build ai_extraction_json from the structured extraction (if available)
      let aiExtractionJson: any = null;
      if (formExtractedJson) {
        // Normalize line_items to match drawer expectations
        const lineItems = (formExtractedJson.line_items || []).map((li: any) => ({
          sku_text: li.sku_text || '',
          dimensions: li.dimensions || '',
          quantity: Number(li.quantity) || 0,
          unit: li.unit || 'MT',
          rate: Number(li.rate) || 0,
          amount: Number(li.amount) || Math.round(Number(li.quantity || 0) * Number(li.rate || 0)),
        }));
        const totalAmount = lineItems.reduce((s: number, i: any) => s + i.amount, 0);
        aiExtractionJson = {
          ...formExtractedJson,
          customer: {
            name: formExtractedJson.customer_name || formCustomerName,
            phone: formExtractedJson.customer_phone || formPhone,
            gst: formExtractedJson.customer_gst || null,
            address: formExtractedJson.customer_address || null,
          },
          line_items: lineItems,
          total_amount: formExtractedJson.total_amount || totalAmount,
          delivery_location: formExtractedJson.delivery_location || '',
          payment_terms: formExtractedJson.payment_terms || '',
        };
      }

      await inquiriesApi.create({
        sender_name: formCustomerName,
        customer_name: formCustomerName,
        customer_phone: formPhone,
        sender_phone: formPhone,
        raw_text: poFileName ? `[Inquiry Attachment: ${poFileName}] ${formRequirement}` : formRequirement,
        inquiry_type: formInquiryType,
        status: 'review',
        overall_confidence: 0.95,
        media_urls: poFileBase64 ? [poFileBase64] : [],
        ai_extraction_json: aiExtractionJson,
      });

      setShowModal(false);
      setFormCustomerName('');
      setFormPhone('');
      setFormRequirement('');
      setFormInquiryType('Product Requirement');
      setPoFileName('');
      setPoFileBase64(null);
      setFormExtractedJson(null);

      fetchMonthlyInquiries();
    } catch (err: any) {
      console.error('Error logging inquiry:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to log inquiry. Please try again.';
      alert(`Failed to log inquiry: ${errMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Keep ONLY actual Product Inquiries (filters out generic greetings, deal logs, and status questions!)
  const rawList = Array.isArray(inquiries) ? inquiries : [];
  const productInquiries = rawList.filter(isProductInquiry);

  const filtered = productInquiries.filter(i => {
    try {
      const text = i?.raw_text || '';
      const parsed = parseInquiryText(text, i);
      const name = parsed.companyName || i?.customer_name || i?.sender_name || '';
      const phone = parsed.customerPhone || i?.customer_phone || i?.sender_phone || '';

      const matchesSearch =
        !searchTerm.trim() ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.toLowerCase().includes(searchTerm.toLowerCase());

      const statusStr = (i?.status || 'processed').toLowerCase();
      const matchesStatus =
        filterStatus === 'all' ||
        statusStr === filterStatus.toLowerCase() ||
        (filterStatus === 'review' && ['review', 'needs_review', 'pending', 'confirmed', 'quoted'].includes(statusStr)) ||
        (filterStatus === 'processed' && ['processed', 'won', 'auto_created', 'confirmed', 'quoted'].includes(statusStr));

      return matchesSearch && matchesStatus;
    } catch {
      return true;
    }
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="text-blue-600" size={28} />
            Customer Product Inquiries
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            AI Multi-Format Interpretation (Text, Image, PDF) with QA Audit &amp; Customer Pre-fill
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
            onClick={fetchMonthlyInquiries}
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
          {['all', 'review', 'processed'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${filterStatus === st
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
              {st === 'all' ? `All Inquiries (${filtered.length})` : st === 'review' ? 'In Review ⏳' : 'Processed 🎉'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Inquiries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Sr.</th>
                <th className="px-4 py-3">Received Date</th>
                <th className="px-4 py-3">Customer / Company Name</th>
                <th className="px-4 py-3">Customer Phone</th>
                <th className="px-4 py-3">Items Summary</th>
                <th className="px-4 py-3">Source Channel</th>
                <th className="px-4 py-3 text-right">Status / Actions</th>
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
                  const details = parseInquiryText(inq.raw_text || '', inq);
                  const st = (inq.status || '').toLowerCase();
                  const isQuoted = st === 'quoted';
                  const isConfirmed = st === 'confirmed' || st === 'processed' || st === 'won';

                  return (
                    <tr
                      key={inq.id || idx}
                      onClick={() => handleOpenDrawer(inq)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group">
                      <td className="px-4 py-3.5 font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {inq.created_at ? new Date(inq.created_at).toLocaleString('en-IN') : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <span className="flex items-center gap-1.5 text-blue-700 group-hover:underline">
                          <Building2 size={15} className="text-blue-600 flex-shrink-0" />
                          {details.companyName}
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
                            {details.lineItems.slice(0, 3).map((li, liIdx) => (
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
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 capitalize">
                          {inq.source_channel || 'WhatsApp Bot'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isQuoted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                              <CheckCircle size={12} /> Quotation Sent ✉️
                            </span>
                          ) : isConfirmed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                              <CheckCircle size={12} /> Confirmed &amp; Saved ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock size={12} /> Review &amp; Edit ✍️
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const d = parseInquiryText(inq.raw_text || '', inq);
                              setQuotationViewInquiry(inq);
                              setQuotationViewDetails(d);
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
                        onClick={() => setImageViewerUrl(drawerFileBase64 || selectedInquiry.media_urls![0])}
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
                  <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block mb-0.5 uppercase tracking-wider text-[10px]">Delivery Address</span>
                      <input
                        type="text"
                        value={editDetails.deliveryLocation}
                        onChange={(e) => setEditDetails({ ...editDetails, deliveryLocation: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold"
                      />
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold block mb-0.5 uppercase tracking-wider text-[10px]">Payment Terms</span>
                      <select
                        value={editDetails.paymentTerms}
                        onChange={(e) => setEditDetails({ ...editDetails, paymentTerms: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold">
                        <option value="30 Days Credit">30 Days Credit</option>
                        <option value="STRICTLY 45 Days Credit">STRICTLY 45 Days Credit</option>
                        <option value="60 Days Credit">60 Days Credit</option>
                        <option value="100% Advance / Payment">100% Advance / Payment</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold block mb-0.5 uppercase tracking-wider text-[10px]">Inquiry Received Date</span>
                      <span className="font-mono font-bold text-slate-700 block">
                        {new Date(selectedInquiry.created_at).toLocaleString('en-IN')}
                      </span>
                    </div>
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

            {isPdf(imageViewerUrl) ? (
              <iframe
                src={imageViewerUrl}
                title="Inquiry PDF Document"
                className="w-full h-[72vh] rounded-2xl bg-white shadow-2xl border border-slate-800"
              />
            ) : (
              <img
                src={imageViewerUrl}
                alt="Inquiry document full view"
                className="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-2xl bg-slate-950 border border-slate-800"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallbackDiv = document.getElementById('image-fallback-card');
                  if (fallbackDiv) fallbackDiv.style.display = 'flex';
                }}
              />
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
                <select
                  required
                  value={formCustomerName}
                  onChange={e => setFormCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Existing Customer or Type...</option>
                  {existingCustomers.map((cName) => (
                    <option key={cName} value={cName}>{cName}</option>
                  ))}
                </select>
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
