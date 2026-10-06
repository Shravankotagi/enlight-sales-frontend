import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  Plus,
  Minus,
  Search,
  CheckCircle,
  Truck,
  X,
  Building2,
  Eye,
  UploadCloud,
  FileText,
  ChevronDown,
  Loader2,
  AlertCircle,
  MoreVertical,
  RefreshCw,
  Calendar,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ordersApi,
  inquiriesApi,
  dealsApi,
  customersApi,
  logPoAllocationError,
} from '../lib/api';
import { type DateFilterRange } from '../components/DateFilterControl';
import { useAuth } from '../context/AuthContext';
import { formatLocalDate, getDaysAgo } from '../utils/dateUtils';
import PaginationControl from '../components/PaginationControl';
import {
  calculateLineItem,
  calculateQuotationBreakdown,
  calculateTotalTonnageMt,
  calculateOrdersTotalTonnage,
  getOrderTonnage,
  normalizeUnit,
} from '../utils/pricingEngine';
import { detectHsnCode } from '../utils/hsnDetector';

interface DealItem {
  id?: string;
  sku_text?: string;
  dimensions?: string;
  hsn_code?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  amount?: number;
}

interface Order {
  id: string;
  inquiry_id?: string;
  customer_name: string;
  customer_phone?: string;
  salesperson_phone?: string;
  salesperson_name?: string;
  assigned_salesperson_name?: string;
  salesperson?: string;
  po_number?: string;
  reference_po_number?: string;
  generated_po_number?: string;
  po_source?: string;
  po_status?: string;
  po_date?: string;
  total_amount?: number;
  delivery_location?: string;
  delivery_date?: string;
  payment_terms?: string;
  created_at: string;
  won_at?: string;
  media_urls?: string[];
  deal_items?: DealItem[];
  raw_text?: string;
  source_channel?: string;
  inquiries?: {
    source_channel?: string;
    inquiry_type?: string;
  };
}

export function getOrderSourceChannel(ord?: Order | null): string {
  if (!ord) return 'Dashboard';
  const channel = (
    ord.source_channel ||
    ord.inquiries?.source_channel ||
    ''
  ).toLowerCase().trim();

  // AI Assistant signals
  if (
    channel === 'ai_assistant' ||
    channel === 'chatbot' ||
    channel === 'assistant' ||
    channel === 'ai' ||
    channel === 'rag_assistant' ||
    channel === 'base_rag_assistant'
  ) {
    return 'AI Assistant';
  }

  // Explicit WhatsApp signals
  if (
    channel.startsWith('whatsapp') ||
    channel === 'wa' ||
    Boolean((ord.inquiries as any)?.whatsapp_message_id)
  ) {
    return 'WhatsApp';
  }

  // Dashboard / Web / Manual signals or default
  if (
    channel === 'web_dashboard' ||
    channel === 'dashboard' ||
    channel === 'purchase_order' ||
    channel === 'manual' ||
    channel === 'form' ||
    channel === 'web' ||
    !channel
  ) {
    return 'Dashboard';
  }

  return channel.includes('whatsapp') ? 'WhatsApp' : (channel.includes('assistant') || channel.includes('ai') ? 'AI Assistant' : 'Dashboard');
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

function isCustomerInAssignedList(inputName: string, assignedList: string[]): boolean {
  if (!inputName || !inputName.trim()) return false;
  const cleanInput = inputName.trim().toLowerCase();
  if (assignedList.some(c => c.trim().toLowerCase() === cleanInput)) return true;

  const stripSuffixes = (str: string) =>
    str
      .toLowerCase()
      .replace(/\b(private\s+limited|pvt\s+ltd|pvt\s+limited|private\s+ltd|co\s+ltd|llp|limited|pvt|ltd|inc|corp)\b/gi, '')
      .replace(/[^a-z0-9]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const strippedInput = stripSuffixes(cleanInput);
  if (!strippedInput) return false;

  return assignedList.some(c => {
    const strippedC = stripSuffixes(c);
    return Boolean(
      strippedC &&
      (strippedC === strippedInput || strippedInput.startsWith(strippedC) || strippedC.startsWith(strippedInput)),
    );
  });
}

export function formatOrderSourceText(ord?: Order | null): string {
  if (!ord) return 'No source document or text available for this order.';

  const lines: string[] = [];
  if (ord.customer_name) lines.push(`Company: ${ord.customer_name}`);
  if (ord.customer_phone) lines.push(`Phone: ${ord.customer_phone}`);
  if (ord.po_number) lines.push(`System PO Number: ${ord.po_number}`);
  if (ord.reference_po_number) lines.push(`Reference PO: ${ord.reference_po_number}`);
  if (ord.po_date) lines.push(`PO Date: ${ord.po_date}`);
  if (ord.delivery_location) lines.push(`Delivery Location: ${ord.delivery_location}`);
  if (ord.payment_terms) lines.push(`Payment Terms: ${ord.payment_terms}`);

  const items = ord.deal_items || [];
  if (Array.isArray(items) && items.length > 0) {
    lines.push('\nLine Items:');
    let subtotal = 0;
    items.forEach((item: any, idx: number) => {
      const name = item.sku_text || item.description || item.name || item.sku || 'Product';
      const spec = item.dimensions || item.spec || item.specification || '';
      const qty = item.quantity ?? item.qty ?? 0;
      const unit = item.unit || 'MT';
      const rate = Number(item.rate ?? item.unit_price ?? item.quoted_price ?? item.price_per_mt ?? 0);
      const amount = Number(item.amount ?? 0) || (qty * rate);
      if (amount > 0) subtotal += amount;
      const hsn = item.hsn_code || item.hsn || detectHsnCode(name) || '';

      let itemStr = `${idx + 1}. ${name}`;
      if (spec) itemStr += ` (${spec})`;
      itemStr += ` | ${qty} ${unit}`;
      if (rate > 0) itemStr += ` | ₹${rate.toLocaleString('en-IN')}/${unit}`;
      if (amount > 0) itemStr += ` | Line Total: ₹${amount.toLocaleString('en-IN')}`;
      if (hsn) itemStr += ` [HSN: ${hsn}]`;
      lines.push(itemStr);
    });

    if (subtotal > 0) {
      const gst = Math.round(subtotal * 0.18);
      const total = subtotal + gst;
      lines.push(`\nSubtotal: ₹${subtotal.toLocaleString('en-IN')}`);
      lines.push(`GST (18%): ₹${gst.toLocaleString('en-IN')}`);
      lines.push(`Total Order Value: ₹${total.toLocaleString('en-IN')}`);
    }
  }

  // If raw_text is present, meaningful and not just a document placeholder, include it as source reference
  if (
    ord.raw_text &&
    typeof ord.raw_text === 'string' &&
    ord.raw_text.trim() &&
    !ord.raw_text.trim().startsWith('[Inquiry Attachment:') &&
    !ord.raw_text.trim().startsWith('[PO Document:')
  ) {
    if (lines.length > 0) {
      lines.push('\nOriginal Source Message:');
    }
    lines.push(ord.raw_text.trim());
  }

  if (lines.length === 0) {
    return 'No source document or text available for this order.';
  }

  return lines.join('\n');
}

export function formatDeliveryLocation(raw?: string): string {
  if (!raw || !raw.trim() || raw === '-') return '-';
  const text = raw.trim();

  // If already clean and short (e.g. "Chakan, Maharashtra" or "Talegaon, Maharashtra")
  if (
    text.length < 35 &&
    !text.toLowerCase().includes('gat no') &&
    !text.toLowerCase().includes('plot no') &&
    !text.toLowerCase().includes('shed no') &&
    !text.toLowerCase().includes('unit -') &&
    !text.toLowerCase().includes('pin:')
  ) {
    return text;
  }

  const indianStates = [
    'Maharashtra', 'Gujarat', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Andhra Pradesh',
    'Rajasthan', 'Madhya Pradesh', 'Uttar Pradesh', 'Haryana', 'Punjab', 'West Bengal',
    'Odisha', 'Chhattisgarh', 'Jharkhand', 'Bihar', 'Kerala', 'Goa', 'Delhi', 'Uttarakhand'
  ];

  const indianCities = [
    'Chakan', 'Pune', 'Talegaon', 'Bhosari', 'Vasuli', 'Kharabwadi', 'Sanaswadi', 'Ranjangaon',
    'Pimpri', 'Chinchwad', 'Kurkumbh', 'Baramati', 'Waluj', 'Aurangabad', 'Nashik', 'Nagpur',
    'Kolhapur', 'Solapur', 'Mumbai', 'Thane', 'Navi Mumbai', 'Tarapur', 'Taloja', 'Panvel',
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Vapi', 'Ankleshwar',
    'Bengaluru', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Jamshedpur', 'Raipur',
    'Bhilai', 'Rourkela', 'Jaipur', 'Indore', 'Bhopal', 'Ghaziabad', 'Faridabad', 'Gurugram',
    'Gurgaon', 'Noida', 'Uchgaon', 'Chiplun', 'Sangli', 'Satara'
  ];

  let detectedState = '';
  for (const st of indianStates) {
    if (new RegExp('\\b' + st + '\\b', 'i').test(text)) {
      detectedState = st;
      break;
    }
  }

  let detectedCity = '';
  for (const ct of indianCities) {
    if (new RegExp('\\b' + ct + '\\b', 'i').test(text)) {
      detectedCity = ct;
      break;
    }
  }

  if (detectedCity && detectedState) {
    if (detectedCity.toLowerCase() === detectedState.toLowerCase()) return detectedState;
    return `${detectedCity}, ${detectedState}`;
  }

  if (detectedCity) {
    return `${detectedCity}, Maharashtra`;
  }

  if (detectedState) {
    return detectedState;
  }

  const parts = text
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(
      (p) =>
        p.length > 0 &&
        !p.toLowerCase().includes('pin') &&
        !p.toLowerCase().includes('state code') &&
        !p.toLowerCase().includes('india') &&
        !/^\d{6}$/.test(p),
    );

  if (parts.length > 0) {
    const cleanLast = parts.slice(-2).join(', ');
    return cleanLast.length > 40 ? parts[parts.length - 1] : cleanLast;
  }

  return text;
}

export function extractCleanProductAndSpecs(rawSku?: string, rawDimensions?: string): {
  materialDescription: string;
  dimensions: string;
} {
  let sku = (rawSku || '').trim();
  let dims = (rawDimensions || '').trim();

  // If dimensions already provided, remove that exact dimension string from sku
  if (dims) {
    const escapedDims = dims.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
    sku = sku.replace(new RegExp(`\\b${escapedDims}\\b`, 'gi'), '');
    sku = sku.replace(new RegExp(escapedDims, 'gi'), '');
  }

  // Multi-dimension pattern: e.g. 8X6000X1500, 10X6000X1500, 1250x2500, 1.2 x 1250 x 2500, 1250*2500
  const multiDimRegex = /\b\d+(?:\.\d+)?\s*[xX*×]\s*\d+(?:\.\d+)?(?:\s*[xX*×]\s*\d+(?:\.\d+)?)?(?:\s*mm)?\b/gi;
  if (!dims) {
    const match = sku.match(multiDimRegex);
    if (match && match[0]) {
      dims = match[0].trim();
      sku = sku.replace(match[0], '');
    }
  } else {
    sku = sku.replace(multiDimRegex, '');
  }

  // Thickness patterns if dimensions already extracted or present: e.g. "8 MM THK", "10 MM THK", "1.2mm", "1.4 mm"
  if (dims && dims !== '-' && dims !== '-') {
    sku = sku.replace(/\b\d+(?:\.\d+)?\s*(?:mm\s*thk|mm|thk|thick)\b/gi, '');
  }

  // Strip standalone pieces/quantity counts if embedded in SKU text like "50PCS", "43 PCS", "100 NOS"
  sku = sku.replace(/\b\d+\s*(?:pcs|nos|pieces|sheets|plates|coils|bundle|bundles)\b/gi, '');

  // Strip standalone empty brackets/parentheses like "()", "[]", "--", excessive dashes or commas
  sku = sku.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '');
  sku = sku.replace(/\s*,\s*$/, '').replace(/^[\s,-]+|[\s,-]+$/g, '');
  sku = sku.replace(/\s{2,}/g, ' ').trim();

  return {
    materialDescription: sku || (rawSku || 'Steel Material').trim(),
    dimensions: dims || '-',
  };
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetOrderId = searchParams.get('orderId') || searchParams.get('id');
  const returnTo = searchParams.get('returnTo');
  const autoOpenedOrderIdRef = useRef<string | null>(null);
  const [modalReturnTo, setModalReturnTo] = useState<string | null>(() => searchParams.get('returnTo'));

  const queryClient = useQueryClient();
  const { effectivePhone, activeRole, activeMode } = useAuth();

  const [dayPreset, setDayPreset] = useState<'all' | 'today' | '7_days' | '30_days' | '90_days' | 'custom'>('all');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'all',
    from: undefined,
    to: undefined,
  });

  const handleDayPresetChange = (preset: string) => {
    const todayStr = formatLocalDate();
    setDayPreset(preset as any);

    if (preset === 'all') {
      setShowCustomDate(false);
      setCustomFrom('');
      setCustomTo('');
      setDateRange({ preset: 'all', from: undefined, to: undefined });
    } else if (preset === 'today') {
      setShowCustomDate(false);
      setDateRange({ preset: 'today', from: todayStr, to: todayStr });
    } else if (preset === '7_days') {
      setShowCustomDate(false);
      setDateRange({ preset: '7_days', from: getDaysAgo(7), to: todayStr });
    } else if (preset === '30_days') {
      setShowCustomDate(false);
      setDateRange({ preset: '30_days', from: getDaysAgo(30), to: todayStr });
    } else if (preset === '90_days') {
      setShowCustomDate(false);
      setDateRange({ preset: '90_days', from: getDaysAgo(90), to: todayStr });
    } else if (preset === 'custom') {
      setShowCustomDate(true);
      setDateRange({ preset: 'custom', from: customFrom, to: customTo });
    }
  };

  const handleCustomFromChange = (val: string) => {
    setCustomFrom(val);
    let effectiveTo = customTo;
    if (val && customTo && val > customTo) {
      effectiveTo = val;
      setCustomTo(val);
    }
    if (val && effectiveTo) {
      setDateRange({ preset: 'custom', from: val, to: effectiveTo });
    }
  };

  const handleCustomToChange = (val: string) => {
    let effectiveVal = val;
    if (val && customFrom && val < customFrom) {
      effectiveVal = customFrom;
    }
    setCustomTo(effectiveVal);
    if (customFrom && effectiveVal) {
      setDateRange({ preset: 'custom', from: customFrom, to: effectiveVal });
    }
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setDayPreset('all');
    setDateRange({
      preset: 'all',
      from: undefined,
      to: undefined,
    });
    setShowCustomDate(false);
    setCustomFrom('');
    setCustomTo('');
    setCurrentPage(1);
  };

  const { data: rawOrders = [], isLoading: loading, isFetching, refetch: fetchOrders } = useQuery<Order[]>({
    queryKey: ['orders-list', effectivePhone, dateRange, activeRole, activeMode],
    queryFn: async () => {
      const params: any = {};
      if (effectivePhone) params.salesperson_phone = effectivePhone;
      if (activeMode) params.mode = activeMode;
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to.includes('T') ? dateRange.to : `${dateRange.to}T23:59:59.999Z`;

      const res = await ordersApi.getAll(params);
      const raw = res?.data;
      return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
    },
  });

  useEffect(() => {
    const handleDbChange = (e: any) => {
      const { table } = e.detail || {};
      if (table === 'deals' || table === 'deal_items') {
        fetchOrders();
      }
    };
    window.addEventListener('enlight-db-change', handleDbChange);
    return () => window.removeEventListener('enlight-db-change', handleDbChange);
  }, [fetchOrders]);

  const { data: rawCustomers = [] } = useQuery<string[]>({
    queryKey: ['customer-names-list-orders', effectivePhone, activeRole, activeMode],
    queryFn: async (): Promise<string[]> => {
      const params: any = {};
      if (effectivePhone) params.salesperson_phone = effectivePhone;
      if (activeMode) params.mode = activeMode;

      const custRes = await customersApi.getAll(params).catch(() => null);
      const rawCust = custRes?.data;
      const cList = Array.isArray(rawCust) ? rawCust : (Array.isArray(rawCust?.data) ? rawCust.data : []);
      const fetchedNames: string[] = cList
        .map((c: any) => String(c.customer_name || c.name || c.company_name || '').trim())
        .filter(Boolean);

      return Array.from(new Set(fetchedNames)).sort((a: string, b: string) => a.localeCompare(b));
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [showModal, setShowModal] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [allocatingPo, setAllocatingPo] = useState(false);

  // Reset page when search or date range changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange]);

  // PO Image / Text Viewer State
  const [poImageViewerUrl, setPoImageViewerUrl] = useState<string | null>(null);
  const [selectedPoOrder, setSelectedPoOrder] = useState<Order | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [loadingPoId, setLoadingPoId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => setOpenActionMenuId(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Prevent background scrolling when any modal or drawer is open
  useEffect(() => {
    const isAnyModalOpen = showModal || !!poImageViewerUrl;
    const body = document.body;
    const docEl = document.documentElement;
    const mainLayoutContainer = document.querySelector('.flex-1.overflow-auto') as HTMLElement | null;

    if (isAnyModalOpen) {
      body.style.overflow = 'hidden';
      docEl.style.overflow = 'hidden';
      if (mainLayoutContainer) {
        mainLayoutContainer.style.overflow = 'hidden';
      }
      return () => {
        body.style.overflow = 'unset';
        docEl.style.overflow = 'unset';
        if (mainLayoutContainer) {
          mainLayoutContainer.style.overflow = 'auto';
        }
      };
    } else {
      body.style.overflow = 'unset';
      docEl.style.overflow = 'unset';
      if (mainLayoutContainer) {
        mainLayoutContainer.style.overflow = 'auto';
      }
    }
  }, [showModal, poImageViewerUrl]);

  // AI OCR Scanning state
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [poFileName, setPoFileName] = useState('');
  const [formUploadedBase64, setFormUploadedBase64] = useState<string | null>(null);

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formPoNumber, setFormPoNumber] = useState('');
  const [formGeneratedPoNumber, setFormGeneratedPoNumber] = useState('');
  const [formReferencePoNumber, setFormReferencePoNumber] = useState('');
  const [poReservationToken, setPoReservationToken] = useState('');
  const [poConflict, setPoConflict] = useState<string | null>(null);
  const [checkingPoAvailability, setCheckingPoAvailability] = useState(false);
  const poInputDirtyRef = useRef(false);
  const [formPoDate, setFormPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDeliveryLocation, setFormDeliveryLocation] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('');
  const [formLineItems, setFormLineItems] = useState<LineItemDetail[]>([
    {
      sku_text: '',
      dimensions: '',
      hsn_code: '',
      quantity: 0,
      unit: 'MT',
      rate: 0,
      amount: 0,
    },
  ]);

  const createPoReservationToken = () =>
    `dashboard:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

  const handleOpenCreateOrder = async () => {
    if (allocatingPo) return;

    const reservationToken = createPoReservationToken();
    poInputDirtyRef.current = false;
    setPoReservationToken(reservationToken);
    setFormPoNumber('');
    setFormGeneratedPoNumber('');
    setPoConflict(null);
    setShowModal(false);
    setAllocatingPo(true);

    try {
      const response = await ordersApi.allocatePo({
        reservation_token: reservationToken,
      });
      const allocation = response?.data;
      if (!allocation?.po_number) {
        throw new Error('The system did not return a generated PO number.');
      }
      setFormPoNumber(String(allocation.po_number));
      setFormGeneratedPoNumber(String(allocation.generated_po_number || allocation.po_number));
      setShowModal(true);
    } catch (error: any) {
      logPoAllocationError(
        'Orders create form',
        error,
        reservationToken,
      );
      toast.error(error?.response?.data?.message || 'Could not generate the system PO. Please try again.');
    } finally {
      setAllocatingPo(false);
    }
  };

  useEffect(() => {
    const value = formPoNumber.trim();
    if (!showModal || !value || !poReservationToken) {
      setPoConflict(null);
      setCheckingPoAvailability(false);
      return;
    }

    let active = true;
    setCheckingPoAvailability(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await ordersApi.checkPoAvailability({
          po_number: value,
          reservation_token: poReservationToken,
        });
        if (!active) return;
        const available = response?.data?.available !== false;
        setPoConflict(available ? null : (response?.data?.reason || 'This PO number is already allocated.'));
      } catch {
        if (active) setPoConflict('PO availability could not be checked. Please try again.');
      } finally {
        if (active) setCheckingPoAvailability(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [formPoNumber, poReservationToken, showModal]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | File[] } }) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if ('value' in e.target) {
      (e.target as HTMLInputElement).value = '';
    }

    setPoFileName(file.name);
    setIsParsingDoc(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;

        let mimeType = file.type;
        if (!mimeType || mimeType === 'application/octet-stream') {
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (ext === 'pdf') mimeType = 'application/pdf';
          else if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
          else if (ext === 'webp') mimeType = 'image/webp';
          else mimeType = 'application/pdf';
        }

        const res = await inquiriesApi.parseDocument({
          file_base64: base64Data,
          mime_type: mimeType,
        });

        if (!res?.data?.success || !res?.data?.data) {
          throw new Error(res?.data?.error || 'Failed to extract PO details from document');
        }

        const extraction = res.data.data;
        setFormUploadedBase64(base64Data);

        const rawCust =
          extraction.customer_name ||
          extraction.customer?.name ||
          extraction.companyName ||
          extraction.company_name ||
          '';
        if (rawCust && String(rawCust).trim().length > 0) {
          const cleanCust = String(rawCust).trim();
          setFormCustomerName(cleanCust);
        }

        const rawPhone =
          extraction.customer_phone ||
          extraction.contact_phone ||
          extraction.customer?.phone ||
          extraction.phone ||
          '';
        const cleanPhone = String(rawPhone).replace(/\D/g, '').slice(-10);
        if (cleanPhone.length >= 10) {
          setFormCustomerPhone(cleanPhone);
        }

        if (extraction.po_number) {
          setFormReferencePoNumber(String(extraction.po_number).trim());
        }
        if (extraction.po_date) {
          let formattedDate = String(extraction.po_date).trim();
          const dMatch = formattedDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
          if (dMatch) {
            formattedDate = `${dMatch[3]}-${dMatch[2].padStart(2, '0')}-${dMatch[1].padStart(2, '0')}`;
          }
          setFormPoDate(formattedDate);
        }
        if (extraction.delivery_location) {
          setFormDeliveryLocation(String(extraction.delivery_location).trim());
        }
        if (extraction.payment_terms) {
          setFormPaymentTerms(String(extraction.payment_terms).trim());
        }

        if (Array.isArray(extraction.line_items) && extraction.line_items.length > 0) {
          const mappedItems: LineItemDetail[] = extraction.line_items.map((i: any) => {
            const skuText = (i.sku_text || i.description || i.product || 'Material').trim();
            const dims = (i.dimensions || '').trim();
            let rawUnit = (i.unit || 'MT').trim();
            const q = Number(i.quantity) || 0;
            const r = Number(i.rate) || 0;
            const amt = Number(i.amount) || Math.round(q * r);

            // Protect against OCR hallucinating product names (e.g. 'Plates', 'Sheets', 'Coils') as units when document specifies MT
            if (
              /^(?:plate|plates|sheet|sheets|coil|coils|beam|channel|pipe)$/i.test(rawUnit) &&
              (r > 1000 || /m\.?t/i.test(skuText) || /m\.?t/i.test(dims) || /\bmt\b/i.test(skuText))
            ) {
              rawUnit = 'MT';
            }

            return {
              sku_text: skuText,
              dimensions: dims,
              hsn_code: (i.hsn_code || i.hsn || detectHsnCode(skuText, dims) || '').trim(),
              quantity: q,
              unit: normalizeUnit(rawUnit) || 'MT',
              rate: r,
              amount: amt,
            };
          });
          setFormLineItems(mappedItems);
        }

        toast.success('PO Document parsed! All details auto-filled.');
      } catch (err: any) {
        console.error('Error parsing PO document:', err);
        setFormUploadedBase64(null);
        setPoFileName('');
        toast.error(err?.message || 'Could not auto-extract PO details. You can enter the fields manually.');
      } finally {
        setIsParsingDoc(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Client-side inline field validation before API call
    if (!formCustomerName.trim()) {
      const el = document.getElementById('form-company-name') as HTMLInputElement;
      if (el) {
        el.focus();
        el.reportValidity();
      }
      return;
    }
    if (activeRole !== 'admin' && !isCustomerInAssignedList(formCustomerName, rawCustomers)) {
      toast.error('Cannot create order: Customer is not in your assigned customer list.');
      return;
    }
    if (!formPoNumber.trim()) {
      const el = document.getElementById('form-po-number') as HTMLInputElement;
      if (el) {
        el.focus();
        el.reportValidity();
      }
      return;
    }
    if (checkingPoAvailability || poConflict) {
      toast.error(poConflict || 'Checking PO number availability. Please wait.');
      return;
    }
    if (!formPoDate) {
      const el = document.getElementById('form-po-date') as HTMLInputElement;
      if (el) {
        el.focus();
        el.reportValidity();
      }
      return;
    }

    if (formLineItems.length === 0) {
      return;
    }

    for (let i = 0; i < formLineItems.length; i++) {
      const item = formLineItems[i];
      if (!item.sku_text.trim()) {
        const el = document.getElementById(`form-item-sku-${i}`) as HTMLInputElement;
        if (el) {
          el.focus();
          el.reportValidity();
        }
        return;
      }
      if (!item.dimensions?.trim()) {
        const el = document.getElementById(`form-item-spec-${i}`) as HTMLInputElement;
        if (el) {
          el.focus();
          el.reportValidity();
        }
        return;
      }
      if (!item.hsn_code || !item.hsn_code.trim()) {
        const el = document.getElementById(`form-item-hsn-${i}`) as HTMLInputElement;
        if (el) {
          el.focus();
          el.reportValidity();
        }
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        const el = document.getElementById(`form-item-qty-${i}`) as HTMLInputElement;
        if (el) {
          el.focus();
          el.reportValidity();
        }
        return;
      }
      if (!item.rate || Number(item.rate) <= 0) {
        const el = document.getElementById(`form-item-rate-${i}`) as HTMLInputElement;
        if (el) {
          el.focus();
          el.reportValidity();
        }
        return;
      }
    }

    if (!formDeliveryLocation.trim()) {
      const el = document.getElementById('form-delivery-location') as HTMLInputElement;
      if (el) {
        el.focus();
        el.reportValidity();
      }
      return;
    }

    if (!formPaymentTerms.trim()) {
      const el = document.getElementById('form-payment-terms') as HTMLInputElement;
      if (el) {
        el.focus();
        el.reportValidity();
      }
      return;
    }

    const subtotal = formLineItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const qBreakdown = calculateQuotationBreakdown(subtotal);

    try {
      setSubmitting(true);
      await ordersApi.processPo({
        customer_name: formCustomerName.trim(),
        customer_phone: formCustomerPhone.trim() || undefined,
        po_number: formPoNumber.trim(),
        generated_po_number: formGeneratedPoNumber.trim() || formPoNumber.trim(),
        reference_po_number: formReferencePoNumber.trim() || undefined,
        po_reservation_token: poReservationToken || undefined,
        po_date: formPoDate,
        total_amount: qBreakdown.grandTotal,
        delivery_location: formDeliveryLocation.trim(),
        payment_terms: formPaymentTerms.trim() || undefined,
        source_channel: 'web_dashboard',
        line_items: formLineItems.map(i => ({
          sku_text: i.sku_text.trim(),
          dimensions: i.dimensions ? i.dimensions.trim() : undefined,
          hsn_code: i.hsn_code ? i.hsn_code.trim() : undefined,
          quantity: Number(i.quantity) || 0,
          unit: i.unit || 'MT',
          rate: Number(i.rate) || 0,
          amount: Number(i.amount) || Math.round((Number(i.quantity) || 0) * (Number(i.rate) || 0)),
        })),
        media_urls: formUploadedBase64 ? [formUploadedBase64] : undefined,
      });

      toast.success('Order Confirmed & Won! Sales Achievement & Payment tracking updated.');
      setShowModal(false);

      setFormCustomerName('');
      setFormCustomerPhone('');
      setFormPoNumber('');
      setFormGeneratedPoNumber('');
      setFormReferencePoNumber('');
      setPoReservationToken('');
      setPoConflict(null);
      poInputDirtyRef.current = false;
      setFormPoDate(new Date().toISOString().split('T')[0]);
      setFormDeliveryLocation('');
      setFormPaymentTerms('');
      setFormLineItems([
        {
          sku_text: '',
          dimensions: '',
          hsn_code: '',
          quantity: 0,
          unit: 'MT',
          rate: 0,
          amount: 0,
        },
      ]);
      setPoFileName('');
      setFormUploadedBase64(null);

      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['customer-names-list-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries-list'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['all-deals-list'] });
      queryClient.invalidateQueries({ queryKey: ['home-inquiries-list'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['kra-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports-overview-data'] });
      queryClient.invalidateQueries({ queryKey: ['intelligence-deals'] });

      window.dispatchEvent(new CustomEvent('enlight-db-change', { detail: { table: 'deals' } }));
      window.dispatchEvent(new CustomEvent('enlight-db-change', { detail: { table: 'inquiries' } }));

      await fetchOrders();
    } catch (err: any) {
      console.error('Error creating order:', err);
      if (err?.response?.status === 409) {
        setPoConflict(
          err?.response?.data?.message ||
            'This PO number is already allocated. Please choose another number.',
        );
      }
      toast.error(err?.response?.data?.message || 'Failed to create order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewPoDocument = async (ord: Order) => {
    setSelectedPoOrder(ord);
    setPoImageViewerUrl(`extracted_preview://${ord.id}`);
    setLoadingPoId(ord.id);

    try {
      const res = await dealsApi.getOne(ord.id);
      const fullDeal = res?.data?.data || res?.data;
      if (fullDeal) {
        setSelectedPoOrder(prev => ({ ...(prev || ord), ...fullDeal }));
      }
    } catch (e) {
      console.warn('Could not load deal details for PO text preview:', e);
    } finally {
      setLoadingPoId(null);
    }
  };

  const parseSafeIsoDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const trimmed = String(dateStr).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

      // Check for DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
      }

      const d = new Date(trimmed);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const safeOrders: Order[] = Array.isArray(rawOrders) ? rawOrders : [];

  const filtered = safeOrders
    .filter((o: Order) => {
      if (dateRange.from && dateRange.to) {
        const effectiveDate =
          parseSafeIsoDate(o?.created_at) ||
          parseSafeIsoDate(o?.won_at) ||
          parseSafeIsoDate(o?.po_date);

        if (effectiveDate) {
          const fromDate = dateRange.from.split('T')[0];
          const toDate = dateRange.to.split('T')[0];
          if (effectiveDate < fromDate || effectiveDate > toDate) {
            return false;
          }
        }
      }

      const ordTonnage = getOrderTonnage(o);
      if (filterStatus === 'under_500') {
        if (ordTonnage >= 500) return false;
      } else if (filterStatus === '500_to_1000') {
        if (ordTonnage < 500 || ordTonnage > 1000) return false;
      } else if (filterStatus === 'above_1000') {
        if (ordTonnage <= 1000) return false;
      }

      const itemsStr = (o?.deal_items || []).map((i: any) => i?.sku_text || '').join(' ');
      return (
        (o?.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o?.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o?.delivery_location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        itemsStr.toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .sort((a: Order, b: Order) => {
      const timeA = new Date(a.won_at || a.created_at || 0).getTime();
      const timeB = new Date(b.won_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });

  const under500Count = safeOrders.filter((o: Order) => getOrderTonnage(o) < 500).length;
  const mid500To1000Count = safeOrders.filter((o: Order) => {
    const t = getOrderTonnage(o);
    return t >= 500 && t <= 1000;
  }).length;
  const above1000Count = safeOrders.filter((o: Order) => getOrderTonnage(o) > 1000).length;

  const totalOrders = filtered.length;
  const totalItems = filtered.reduce((sum: number, o: Order) => {
    const count = (o?.deal_items && o.deal_items.length > 0) ? o.deal_items.length : 1;
    return sum + count;
  }, 0);
  const totalTonnageResult = calculateOrdersTotalTonnage(filtered);
  const totalTonnage = totalTonnageResult.totalMt;

  const handleClosePoViewer = () => {
    setPoImageViewerUrl(null);
    setSelectedPoOrder(null);
    setModalReturnTo(null);

    // Clean order search params from URL so subsequent filter changes/actions don't reopen modal
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.has('orderId') || currentParams.has('id') || currentParams.has('returnTo')) {
      currentParams.delete('orderId');
      currentParams.delete('id');
      currentParams.delete('returnTo');
      const newSearch = currentParams.toString();
      navigate({ search: newSearch ? `?${newSearch}` : '' }, { replace: true });
    }
  };

  // Auto-open requested PO if navigated with ?orderId=... or ?id=...
  useEffect(() => {
    if (!targetOrderId || autoOpenedOrderIdRef.current === targetOrderId) return;
    const found = rawOrders.find(
      (o: any) => o.id === targetOrderId || o.po_number === targetOrderId,
    );
    if (found) {
      autoOpenedOrderIdRef.current = targetOrderId;
      if (returnTo) setModalReturnTo(returnTo);
      handleViewPoDocument(found);
    } else if (rawOrders.length > 0) {
      dealsApi
        .getOne(targetOrderId)
        .then(res => {
          const fullDeal = res?.data?.data || res?.data;
          if (fullDeal) {
            autoOpenedOrderIdRef.current = targetOrderId;
            if (returnTo) setModalReturnTo(returnTo);
            handleViewPoDocument(fullDeal);
          }
        })
        .catch(err => {
          console.warn('Could not load order for modal auto-open:', err);
          autoOpenedOrderIdRef.current = targetOrderId;
        });
    }
  }, [targetOrderId, rawOrders, returnTo]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const paginatedOrders = filtered.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] space-y-4 animate-fade-in font-sans">
      {/* Frozen Upper Section (Header, KPI Cards, Search & Filters) */}
      <div className="shrink-0 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShoppingBag className="text-blue-600" size={28} />
              Orders &amp; Delivery Management
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                fetchOrders();
                queryClient.invalidateQueries({ queryKey: ['orders-list'] });
              }}
              title="Refresh Orders"
              className="h-9 w-9 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-2xs flex items-center justify-center cursor-pointer disabled:opacity-60 shrink-0">
              <RefreshCw size={15} className={isFetching ? 'animate-spin text-blue-600' : ''} />
            </button>

            <button
              onClick={handleOpenCreateOrder}
              disabled={allocatingPo}
              className="h-9 flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-wait">
              {allocatingPo ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {allocatingPo ? 'Generating PO…' : 'Create New Order'}
            </button>
          </div>
        </div>

        {/* KPI Cards: Total Orders, Total Items, Total Tonnage */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Orders</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalOrders}</p>
            </div>
            <div className="p-3 bg-slate-100 text-slate-900 rounded-lg">
              <ShoppingBag size={22} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Items</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{totalItems}</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Layers size={22} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Tonnage (MT)</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">
                {totalTonnage.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} MT
              </p>

            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <Truck size={22} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* 1. Search Box with Clear ( X ) Icon */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search customer, PO number, location, product..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs text-slate-800"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  title="Clear Search">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* 2. Days Filter Dropdown (Bold closed, normal dropdown options) */}
            <div className="relative inline-flex items-center w-full sm:w-auto">
              <Calendar size={14} className="absolute left-3 text-blue-600 pointer-events-none" />
              <select
                value={dayPreset}
                onChange={e => handleDayPresetChange(e.target.value)}
                className="w-full sm:w-auto pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
                <option value="all" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>All Time</option>
                <option value="today" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Today</option>
                <option value="7_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 7 Days</option>
                <option value="30_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 30 Days</option>
                <option value="90_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 90 Days</option>
                <option value="custom" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Custom Range</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
            </div>

            {/* 3. Tonnage Filter Dropdown (<500, 500-1000, >1000) (Bold closed, normal dropdown options) */}
            <div className="relative inline-flex items-center w-full sm:w-auto">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
                <option value="all" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>All Orders ({safeOrders.length})</option>
                <option value="under_500" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>&lt; 500 MT ({under500Count})</option>
                <option value="500_to_1000" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>500 – 1000 MT ({mid500To1000Count})</option>
                <option value="above_1000" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>&gt; 1000 MT ({above1000Count})</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
            </div>

            {/* 4. Clear Filter Button */}
            {(searchTerm || filterStatus !== 'all' || dayPreset !== 'all') && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer">
                Clear Filter
              </button>
            )}
          </div>

          {/* Custom Range Picker Inputs */}
          {showCustomDate && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-200 text-xs animate-in fade-in duration-150">
              <span className="text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={e => handleCustomFromChange(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer text-slate-700 font-medium"
              />
              <span className="text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={e => handleCustomToChange(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer text-slate-700 font-medium"
              />
            </div>
          )}
        </div>
      </div>

      {/* Lower Section - Scrollable Table Card */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className={`flex-1 min-h-0 overflow-auto ${!loading && filtered.length === 0 ? 'flex flex-col' : ''}`}>
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider shadow-2xs">
              <tr>
                <th className="px-4 py-3 text-center w-[4%]">#</th>
                <th className="px-5 py-3 text-left w-[23%]">Customers</th>
                <th className="px-4 py-3 text-center w-[13%]">PO Number</th>
                <th className="px-4 py-3 text-center w-[14%]">Reference PO</th>
                <th className="px-4 py-3 text-center w-[11%]">Items Summary</th>
                <th className="px-4 py-3 text-center w-[13%]">Source Channel</th>
                <th className="px-4 py-3 text-center w-[14%]">Delivery Location</th>
                <th className="pl-4 pr-6 sm:pr-8 py-3.5 text-center w-28">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading orders data...</td>
                </tr>
              ) : filtered.length === 0 ? null : (
                paginatedOrders.map((ord, idx) => {
                  const globalIdx = startIndex + idx + 1;
                  const ordLineItems = (ord?.deal_items && ord.deal_items.length > 0) ? ord.deal_items : [];
                  const ordTonnage = calculateTotalTonnageMt(ordLineItems);
                  const tonnageFormatted = ordTonnage.totalMt > 0
                    ? `(${ordTonnage.totalMt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT)`
                    : '';
                  const itemCount = ordLineItems.length > 0 ? ordLineItems.length : 1;
                  const poNumber = ord.po_number?.trim() || '';

                  return (
                    <tr
                      key={ord.id || idx}
                      className="group hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-500 text-center">{globalIdx}</td>
                      <td className="px-5 py-3.5 text-left">
                        <div className="font-bold text-slate-900 text-sm">
                          <span className="truncate group-hover:text-blue-600 transition-colors inline-block">
                            {ord.customer_name || 'Customer'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="font-mono">
                            {ord.won_at
                              ? new Date(ord.won_at).toLocaleString('en-IN')
                              : (ord.created_at
                                  ? new Date(ord.created_at).toLocaleString('en-IN')
                                  : (ord.po_date || '-'))}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {poNumber ? (
                          <span className="inline-flex items-center justify-center bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 text-slate-800 font-semibold font-mono text-xs shadow-2xs">
                            {poNumber}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center text-slate-400 font-medium font-mono text-xs">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {ord.reference_po_number?.trim() ? (
                          <span className="inline-flex items-center justify-center bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 text-slate-800 font-semibold font-mono text-xs shadow-2xs max-w-full truncate" title={ord.reference_po_number.trim()}>
                            {ord.reference_po_number.trim()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center text-slate-400 font-medium font-mono text-xs">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 text-center font-medium whitespace-nowrap">
                        {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                        {tonnageFormatted && (
                          <span className="text-slate-600 font-semibold ml-1.5">{tonnageFormatted}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center text-xs font-medium text-slate-700">
                        {getOrderSourceChannel(ord)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 font-medium text-center whitespace-nowrap" title={ord.delivery_location || '-'}>
                        {formatDeliveryLocation(ord.delivery_location)}
                      </td>
                      <td className="pl-4 pr-6 sm:pr-8 py-3.5 text-center relative whitespace-nowrap">
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(prev => (prev === ord.id ? null : ord.id));
                            }}
                            className="p-1.5 rounded-lg border bg-white hover:bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300 shadow-2xs transition-all inline-flex items-center justify-center cursor-pointer"
                            title="Actions">
                            <MoreVertical size={16} />
                          </button>

                          {openActionMenuId === ord.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className={`absolute right-0 ${
                                idx >= paginatedOrders.length - 2 && paginatedOrders.length >= 3
                                  ? 'bottom-full mb-1'
                                  : 'top-full mt-1'
                              } w-36 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 text-left animate-in fade-in-50 duration-100`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleViewPoDocument(ord);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2.5 transition-colors cursor-pointer">
                                {loadingPoId === ord.id ? (
                                  <RefreshCw size={14} className="animate-spin text-blue-600 shrink-0" />
                                ) : (
                                  <Eye size={14} className="text-slate-500 shrink-0" />
                                )}
                                <span>{loadingPoId === ord.id ? 'Opening...' : 'View PO'}</span>
                              </button>
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
            <div className="flex-1 flex items-center justify-center px-4 text-center text-sm text-slate-400">
              No orders found.
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
            itemLabel="orders"
          />
        )}
      </div>

      {poImageViewerUrl && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={handleClosePoViewer}>
          <div
            className="relative w-full max-h-[90vh] max-w-3xl bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-200 mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                {(modalReturnTo || returnTo) && (
                  <button
                    type="button"
                    onClick={() => navigate(modalReturnTo || returnTo!)}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs">
                    <ArrowLeft size={14} /> Back to Customer Profile
                  </button>
                )}
                <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" />
                  Order PO Details &amp; Source
                </span>
              </div>
              <button
                onClick={handleClosePoViewer}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer">
                <X size={18} /> Close
              </button>
            </div>

              <div className="w-full space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-blue-700">System PO</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                      {selectedPoOrder?.po_number || '-'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-amber-700">Reference PO</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                      {selectedPoOrder?.reference_po_number || '-'}
                    </p>
                  </div>
                </div>
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Source Inquiry Text</span>
                {(selectedPoOrder?.created_at || selectedPoOrder?.won_at) && (
                  <span className="font-mono">
                    Received: {new Date(selectedPoOrder.created_at || selectedPoOrder.won_at || '').toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-xs font-mono whitespace-pre-wrap leading-relaxed select-text min-h-[140px] max-h-[60vh] overflow-y-auto">
                {formatOrderSourceText(selectedPoOrder)}
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto overscroll-contain">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="text-blue-600" size={20} />
                Record New Order
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Upload PO Document Section */}
            <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs text-blue-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <UploadCloud size={15} className="text-blue-600" />
                  Upload PO Document (Auto-Fill via Gemini)
                </span>
                <span className="text-[10px] text-slate-400 font-medium font-mono">PDF, JPEG, PNG</span>
              </div>

              <label
                htmlFor="order-po-file-upload"
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
                className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-white/90 hover:bg-blue-50/60 rounded-xl cursor-pointer transition-all">
                <input
                  id="order-po-file-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {isParsingDoc ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 animate-pulse py-1">
                    <Loader2 size={16} className="animate-spin" />
                    <span>AI Extracting PO details from document...</span>
                  </div>
                ) : formUploadedBase64 ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 py-1">
                    <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                    <span className="truncate max-w-xs">{poFileName || 'Document Attached'}</span>
                    <span className="text-[10px] text-blue-600 underline ml-1">Change</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 font-medium py-1">
                    Drop document here, or <span className="text-blue-600 font-bold underline">Browse File</span>
                  </p>
                )}
              </label>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Company Name <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="relative flex items-center">
                    <Building2 className="absolute left-3 text-slate-400 pointer-events-none" size={15} />
                    <input
                      id="form-company-name"
                      type="text"
                      required
                      placeholder="Type or select company name..."
                      value={formCustomerName}
                      onChange={e => {
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
                        setShowCompanyDropdown(prev => !prev);
                      }}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 p-1">
                      <ChevronDown size={16} className={`transition-transform ${showCompanyDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {showCompanyDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {rawCustomers
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
                      {rawCustomers.filter(c => !formCustomerName || c.toLowerCase().includes(formCustomerName.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400 italic">
                          {activeRole !== 'admin'
                            ? 'This company is not in your assigned customer list.'
                            : 'No matching company found. Typing will save as new company.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {activeRole !== 'admin' && formCustomerName.trim() && !isCustomerInAssignedList(formCustomerName, rawCustomers) && (
                  <div className="mt-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Customer Not Assigned:</span>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        "{formCustomerName}" is not in your assigned customer list. You can only record orders for your assigned customers.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    System PO Number <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    id="form-po-number"
                    type="text"
                    required
                    placeholder="EM/PO/1"
                    value={formPoNumber}
                    onChange={e => {
                      poInputDirtyRef.current = true;
                      setFormPoNumber(e.target.value);
                    }}
                    className={`w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal ${
                      poConflict ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                    }`}
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    Generated automatically and editable before confirmation.
                  </p>
                  {checkingPoAvailability && (
                    <p className="mt-1 text-[10px] text-slate-500">Checking availability…</p>
                  )}
                  {poConflict && (
                    <p className="mt-1 text-[10px] font-semibold text-rose-600">{poConflict}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reference PO <span className="text-[10px] font-medium text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Customer PO from document/text"
                    value={formReferencePoNumber}
                    onChange={e => setFormReferencePoNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PO Date <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    id="form-po-date"
                    type="date"
                    required
                    value={formPoDate}
                    onChange={e => setFormPoDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Structured Line Items Table matching Img 2 */}
              <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs text-slate-800 border-collapse">
                  <thead className="bg-slate-800 text-white font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-3 py-3 border-r border-slate-700 w-[4%] text-center">#</th>
                      <th className="px-4 py-3 border-r border-slate-700 w-[27%]">
                        Description &amp; Specifications <span className="text-red-500 font-bold">*</span>
                      </th>
                      <th className="px-3 py-3 border-r border-slate-700 w-[12%] text-center">
                        HSN/SAC <span className="text-red-500 font-bold">*</span>
                      </th>
                      <th className="px-3 py-3 border-r border-slate-700 w-[20%] text-center">
                        Quantity &amp; Unit <span className="text-red-500 font-bold">*</span>
                      </th>
                      <th className="px-3 py-3 border-r border-slate-700 w-[14%] text-center">
                        Rate (₹) <span className="text-red-500 font-bold">*</span>
                      </th>
                      <th className="px-4 py-3 border-r border-slate-700 w-[19%] text-left">Amount (₹)</th>
                      <th className="px-2 py-3 text-center w-[4%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {formLineItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30">
                        <td className="px-3 py-3.5 border-r border-slate-200 text-slate-400 font-mono text-center text-xs">{idx + 1}</td>
                        <td className="px-4 py-3.5 border-r border-slate-200">
                          <div className="space-y-1">
                            <input
                              id={`form-item-sku-${idx}`}
                              type="text"
                              required
                              value={item.sku_text || ''}
                              onChange={(e) => {
                                const newSku = e.target.value;
                                const updated = [...formLineItems];
                                const currentHsn = updated[idx]?.hsn_code || '';
                                const prevAutoHsn = detectHsnCode(updated[idx]?.sku_text || '', item.dimensions);
                                const newAutoHsn = detectHsnCode(newSku, item.dimensions);

                                let finalHsn = currentHsn;
                                if (!currentHsn || currentHsn === prevAutoHsn) {
                                  finalHsn = newAutoHsn;
                                }

                                const currentItem = { ...updated[idx], sku_text: newSku, hsn_code: finalHsn };
                                const calc = calculateLineItem({ ...currentItem, amount: 0 });
                                updated[idx] = { ...currentItem, amount: calc.amount };
                                setFormLineItems(updated);
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                              placeholder="Product Name / Description"
                            />
                            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                              <span className="font-semibold text-slate-400 shrink-0">Spec:</span>
                              <input
                                id={`form-item-spec-${idx}`}
                                type="text"
                                required
                                value={item.dimensions || ''}
                                onChange={(e) => {
                                  const newDim = e.target.value;
                                  const updated = [...formLineItems];
                                  const currentHsn = updated[idx]?.hsn_code || '';
                                  const prevAutoHsn = detectHsnCode(updated[idx]?.sku_text || '', updated[idx]?.dimensions);
                                  const newAutoHsn = detectHsnCode(updated[idx]?.sku_text || '', newDim);

                                  let finalHsn = currentHsn;
                                  if (!currentHsn || currentHsn === prevAutoHsn) {
                                    finalHsn = newAutoHsn;
                                  }

                                  const currentItem = { ...updated[idx], dimensions: newDim, hsn_code: finalHsn };
                                  const calc = calculateLineItem({ ...currentItem, amount: 0 });
                                  updated[idx] = { ...currentItem, amount: calc.amount };
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
                            value={item.hsn_code || ''}
                            onChange={(e) => {
                              const updated = [...formLineItems];
                              updated[idx] = { ...updated[idx], hsn_code: e.target.value };
                              setFormLineItems(updated);
                            }}
                            placeholder="e.g. 72083730"
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs font-mono text-center text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                          />
                        </td>
                        <td className="px-3 py-3.5 border-r border-slate-200">
                          <div className="flex items-center gap-1.5 w-full min-w-[135px]">
                            <input
                              id={`form-item-qty-${idx}`}
                              type="number"
                              required
                              min="0.001"
                              step="any"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                const rawQ = val === '' ? 0 : parseFloat(val);
                                const safeQ = isNaN(rawQ) || rawQ < 0 ? 0 : rawQ;
                                const updated = [...formLineItems];
                                const currentItem = { ...updated[idx], quantity: safeQ };
                                const calc = calculateLineItem({ ...currentItem, amount: 0 });
                                updated[idx] = { ...currentItem, amount: calc.amount };
                                setFormLineItems(updated);
                              }}
                              placeholder="0"
                              className="flex-1 min-w-[65px] px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs text-slate-900 font-mono outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal text-center"
                            />
                            <select
                              value={normalizeUnit(item.unit) || 'MT'}
                              onChange={(e) => {
                                const updated = [...formLineItems];
                                const currentItem = { ...updated[idx], unit: e.target.value };
                                const calc = calculateLineItem({ ...currentItem, amount: 0 });
                                updated[idx] = { ...currentItem, amount: calc.amount };
                                setFormLineItems(updated);
                              }}
                              className="w-[62px] shrink-0 px-1 py-1.5 bg-slate-50 border border-slate-300 rounded text-[11px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500">
                              <option value="MT">MT</option>
                              <option value="Nos">Nos</option>
                              <option value="Pcs">Pcs</option>
                              <option value="KG">KG</option>
                              <option value="Sheets">Sheets</option>
                              <option value="Plates">Plates</option>
                              <option value="Coils">Coils</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 border-r border-slate-200 font-bold font-mono">
                          <input
                            id={`form-item-rate-${idx}`}
                            type="number"
                            required
                            min="0.01"
                            step="any"
                            value={item.rate === 0 ? '' : item.rate}
                            onChange={(e) => {
                              const val = e.target.value;
                              const rawR = val === '' ? 0 : parseFloat(val);
                              const safeR = isNaN(rawR) || rawR < 0 ? 0 : rawR;
                              const updated = [...formLineItems];
                              const currentItem = { ...updated[idx], rate: safeR };
                              const calc = calculateLineItem({ ...currentItem, amount: 0 });
                              updated[idx] = { ...currentItem, amount: calc.amount };
                              setFormLineItems(updated);
                            }}
                            placeholder="0"
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal text-left text-slate-900"
                          />
                        </td>
                        <td className="px-3 py-3.5 text-left font-bold text-slate-900 font-mono border-r border-slate-200 min-w-[130px]">
                          <input
                            type="number"
                            min="0"
                            value={item.amount === 0 ? '' : item.amount}
                            onChange={(e) => {
                              const val = e.target.value;
                              const rawA = val === '' ? 0 : parseFloat(val);
                              const safeA = isNaN(rawA) || rawA < 0 ? 0 : rawA;
                              const updated = [...formLineItems];
                              updated[idx] = { ...updated[idx], amount: safeA };
                              setFormLineItems(updated);
                            }}
                            placeholder="0"
                            className="w-full min-w-[110px] px-2.5 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs text-left font-mono text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                          />
                        </td>
                        <td className="px-2 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {formLineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = formLineItems.filter((_, i) => i !== idx);
                                  setFormLineItems(updated);
                                }}
                                className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                                title="Remove line item">
                                <Minus size={15} />
                              </button>
                            )}
                            {idx === formLineItems.length - 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [
                                    ...formLineItems,
                                    { sku_text: '', dimensions: '', hsn_code: '72083840', quantity: 0, unit: 'MT', rate: 0, amount: 0 },
                                  ];
                                  setFormLineItems(updated);
                                }}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center"
                                title="Add line item">
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
                  const subtotal = formLineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                  const qBreakdown = calculateQuotationBreakdown(subtotal);

                  const totalTonnage = calculateTotalTonnageMt(formLineItems);
                  const formattedItemsInTotal = totalTonnage.formattedText;

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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Delivery Location <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    id="form-delivery-location"
                    type="text"
                    required
                    placeholder="e.g. Gat No / Plot No PAP V :- 149/2, Village Vasuli, Chakan, Pune, Maharashtra - 410501"
                    value={formDeliveryLocation}
                    onChange={e => setFormDeliveryLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Terms <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    id="form-payment-terms"
                    type="text"
                    required
                    placeholder="e.g. 30 Days Credit, 100% Advance"
                    value={formPaymentTerms}
                    onChange={e => setFormPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    isParsingDoc ||
                    (activeRole !== 'admin' && !isCustomerInAssignedList(formCustomerName, rawCustomers))
                  }
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Saving Order...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
