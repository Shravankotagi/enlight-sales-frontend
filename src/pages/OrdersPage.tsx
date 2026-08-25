import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  Plus,
  Minus,
  Search,
  CheckCircle,
  PackageCheck,
  Truck,
  X,
  Building2,
  Eye,
  UploadCloud,
  FileText,
  ExternalLink,
  ImageIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  MoreVertical,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi, inquiriesApi, dealsApi, customersApi } from '../lib/api';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { useAuth } from '../context/AuthContext';
import { getFirstDayOfMonth, getLastDayOfMonth } from '../utils/dateUtils';
import { calculateQuotationBreakdown, normalizeUnit } from '../utils/pricingEngine';

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
  customer_name: string;
  customer_phone?: string;
  salesperson_phone?: string;
  salesperson_name?: string;
  assigned_salesperson_name?: string;
  salesperson?: string;
  po_number?: string;
  po_date?: string;
  total_amount?: number;
  delivery_location?: string;
  delivery_date?: string;
  payment_terms?: string;
  created_at: string;
  won_at?: string;
  media_urls?: string[];
  deal_items?: DealItem[];
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

export function formatDeliveryLocation(raw?: string): string {
  if (!raw || !raw.trim() || raw === '-') return '—';
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
  if (dims && dims !== '—' && dims !== '-') {
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
    dimensions: dims || '—',
  };
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { effectivePhone } = useAuth();

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
  });

  const { data: rawOrders = [], isLoading: loading, refetch: fetchOrders } = useQuery<Order[]>({
    queryKey: ['orders-list', effectivePhone, dateRange],
    queryFn: async () => {
      const params: any = {};
      if (effectivePhone) params.salesperson_phone = effectivePhone;
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to.includes('T') ? dateRange.to : `${dateRange.to}T23:59:59.999Z`;

      const res = await ordersApi.getAll(params);
      const raw = res?.data;
      return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
    },
    refetchInterval: 15000,
  });

  const { data: rawCustomers = [] } = useQuery<string[]>({
    queryKey: ['customer-names-list-orders'],
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

      const orderCustomerNames = rawOrders.map((o: any) => o.customer_name).filter(Boolean);

      return Array.from(new Set([...fetchedNames, ...orderCustomerNames, ...defaultNames]));
    },
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [showModal, setShowModal] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset page when search or date range changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange]);

  // PO Image Viewer State
  const [poImageViewerUrl, setPoImageViewerUrl] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Send / Share Modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [shareOrder, setShareOrder] = useState<Order | null>(null);
  const [sendEmail, setSendEmail] = useState('shravankotagi314@gmail.com');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [resendNotice, setResendNotice] = useState('');

  useEffect(() => {
    const handleOutsideClick = () => setOpenActionMenuId(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Prevent background scrolling when any modal or drawer is open
  useEffect(() => {
    const isAnyModalOpen =
      showModal ||
      showSendModal ||
      !!poImageViewerUrl;
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
  }, [
    showModal,
    showSendModal,
    poImageViewerUrl,
  ]);

  // AI OCR Scanning state
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [poFileName, setPoFileName] = useState('');

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formPoNumber, setFormPoNumber] = useState('');
  const [formPoDate, setFormPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDeliveryLocation, setFormDeliveryLocation] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('');
  const [formLineItems, setFormLineItems] = useState<LineItemDetail[]>([
    {
      sku_text: '',
      dimensions: '',
      hsn_code: '7208',
      quantity: 0,
      unit: 'MT',
      rate: 0,
      amount: 0,
    },
  ]);
  const [formUploadedBase64, setFormUploadedBase64] = useState<string | null>(null);

  const isPdf = (url?: string) => {
    if (!url) return false;
    return url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPoFileName(file.name);
    setIsParsingDoc(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        setFormUploadedBase64(base64Data);

        const res = await inquiriesApi.parseDocument({
          file_base64: base64Data,
          mime_type: file.type || 'image/jpeg',
        });

        const extraction = res?.data?.data || res?.data;
        if (extraction) {
          const rawCust =
            extraction.customer?.name ||
            extraction.customer_name ||
            extraction.companyName ||
            '';
          if (rawCust && rawCust.trim().length > 0) {
            setFormCustomerName(rawCust.trim());
          }

          const rawPhone =
            extraction.customer?.phone ||
            extraction.customer_phone ||
            extraction.phone ||
            '';
          if (rawPhone && rawPhone.trim().length > 0) {
            setFormCustomerPhone(rawPhone.trim());
          }

          if (extraction.po_number) {
            setFormPoNumber(extraction.po_number);
          }
          if (extraction.po_date) {
            setFormPoDate(extraction.po_date);
          }
          if (extraction.delivery_location) {
            setFormDeliveryLocation(extraction.delivery_location);
          }
          if (extraction.payment_terms) {
            setFormPaymentTerms(extraction.payment_terms);
          }

          if (Array.isArray(extraction.line_items) && extraction.line_items.length > 0) {
            const mappedItems: LineItemDetail[] = extraction.line_items.map((i: any) => ({
              sku_text: i.sku_text || i.description || 'Material',
              dimensions: i.dimensions || '',
              hsn_code: i.hsn_code || i.hsn || '7208',
              quantity: Number(i.quantity) || 0,
              unit: normalizeUnit(i.unit) || 'MT',
              rate: Number(i.rate) || 0,
              amount: Number(i.amount) || Math.round(Number(i.quantity || 0) * Number(i.rate || 0)),
            }));
            setFormLineItems(mappedItems);
          }

          toast.success('PO Document parsed! Fields auto-filled.');
        }
      } catch (err: any) {
        console.error('Error parsing PO document:', err);
        toast.error('Could not auto-extract PO details. You can enter the fields manually.');
      } finally {
        setIsParsingDoc(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      toast.error('Please enter Company Name');
      return;
    }
    if (!formPoNumber.trim()) {
      toast.error('Please enter PO Number');
      return;
    }
    if (!formPoDate) {
      toast.error('Please select PO Date');
      return;
    }
    if (!formDeliveryLocation.trim()) {
      toast.error('Please enter Delivery Location');
      return;
    }
    if (formLineItems.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    for (let i = 0; i < formLineItems.length; i++) {
      const item = formLineItems[i];
      if (!item.sku_text.trim()) {
        toast.error(`Line Item #${i + 1}: Description & Specifications is required.`);
        return;
      }
      if (item.quantity <= 0) {
        toast.error(`Line Item #${i + 1}: Quantity must be greater than 0.`);
        return;
      }
      if (item.rate <= 0) {
        toast.error(`Line Item #${i + 1}: Rate must be greater than 0.`);
        return;
      }
    }

    const subtotal = formLineItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const qBreakdown = calculateQuotationBreakdown(subtotal);

    try {
      setSubmitting(true);
      await ordersApi.processPo({
        customer_name: formCustomerName.trim(),
        customer_phone: formCustomerPhone.trim() || undefined,
        po_number: formPoNumber.trim(),
        po_date: formPoDate,
        total_amount: qBreakdown.grandTotal,
        delivery_location: formDeliveryLocation.trim(),
        payment_terms: formPaymentTerms.trim() || undefined,
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
      setFormPoDate(new Date().toISOString().split('T')[0]);
      setFormDeliveryLocation('');
      setFormPaymentTerms('');
      setFormLineItems([
        {
          sku_text: '',
          dimensions: '',
          hsn_code: '7208',
          quantity: 0,
          unit: 'MT',
          rate: 0,
          amount: 0,
        },
      ]);
      setPoFileName('');
      setFormUploadedBase64(null);

      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      fetchOrders();
    } catch (err: any) {
      console.error('Error creating order:', err);
      toast.error(err?.response?.data?.message || 'Failed to create order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSendModal = async (ord: Order) => {
    setShareOrder(ord);
    setSendEmail((ord as any).customer_email || 'shravankotagi314@gmail.com');
    setResendNotice('');
    setShowSendModal(true);

    try {
      const res = await dealsApi.getOne(ord.id);
      const fullDeal = res?.data?.data || res?.data;
      if (fullDeal) {
        setShareOrder(fullDeal);
        if (fullDeal.customer_email) {
          setSendEmail(fullDeal.customer_email);
        }
      }
    } catch (e) {
      console.warn('Non-blocking full deal load notice:', e);
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

      const itemsStr = (o?.deal_items || []).map((i: any) => i?.sku_text || '').join(' ');
      return (
        (o?.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o?.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o?.delivery_location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        itemsStr.toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .sort((a: Order, b: Order) => {
      const timeA = new Date(a.created_at || a.won_at || 0).getTime();
      const timeB = new Date(b.created_at || b.won_at || 0).getTime();
      return timeB - timeA;
    });

  const totalOrders = filtered.length;
  const totalRevenue = filtered.reduce((sum: number, o: Order) => sum + Number(o?.total_amount || 0), 0);
  const totalTonnage = filtered.reduce((sum: number, o: Order) => {
    const itemsQty = (o?.deal_items || []).reduce((iSum: number, i: any) => {
      const q = Number(i?.quantity || 0);
      const u = (i?.unit || 'MT').toUpperCase().trim();
      const inMt = u === 'KG' || u === 'KGS' || u === 'KILOGRAM' || u === 'KILOGRAMS' ? q / 1000 : q;
      return iSum + inMt;
    }, 0);
    return sum + itemsQty;
  }, 0);

  const handleViewPoDocument = async (ord: Order) => {
    let mediaUrl = ord.media_urls?.[0];
    if (mediaUrl && (mediaUrl.startsWith('data:') || mediaUrl.startsWith('http'))) {
      setPoImageViewerUrl(mediaUrl);
      return;
    }

    const toastId = toast.loading('Loading original PO document...');
    try {
      const res = await dealsApi.getOne(ord.id);
      const fullDeal = res?.data?.data || res?.data;
      if (fullDeal && Array.isArray(fullDeal.media_urls) && fullDeal.media_urls.length > 0) {
        mediaUrl = fullDeal.media_urls[0];
        setPoImageViewerUrl(mediaUrl || null);
        toast.dismiss(toastId);
      } else {
        toast.dismiss(toastId);
        toast.error('No original PO document image/PDF attached to this record.');
      }
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('Could not load PO document.');
    }
  };

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const paginatedOrders = filtered.slice(startIndex, endIndex);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="text-blue-600" size={28} />
            Completed &amp; Delivered Orders
          </h1>
          
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-sm transition-colors">
            <Plus size={18} />
            Create New Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Orders Won</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalOrders}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <ShoppingBag size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Revenue Achieved</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">₹{totalRevenue.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <PackageCheck size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Volume (MT)</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{totalTonnage.toLocaleString('en-IN')} MT</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Truck size={22} />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer, PO number, location, product..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <DateFilterControl onChange={setDateRange} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-center w-[4%]">#</th>
                <th className="px-5 py-3 text-left w-[26%]">Customer</th>
                <th className="px-4 py-3 text-center w-[14%]">PO Number</th>
                <th className="px-4 py-3 text-center w-[12%]">Products &amp; Items</th>
                <th className="px-4 py-3 text-center w-[14%]">Order Tonnage (MT)</th>
                <th className="px-4 py-3 text-center w-[18%]">Delivery Location</th>
                <th className="pl-4 pr-6 sm:pr-8 py-3.5 text-center w-28">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading orders data...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No orders found.</td>
                </tr>
              ) : (
                paginatedOrders.map((ord, idx) => {
                  const globalIdx = startIndex + idx + 1;
                  const itemCount = (ord?.deal_items && ord.deal_items.length > 0) ? ord.deal_items.length : 1;

                  const ordTonnage = (ord?.deal_items || []).reduce((iSum: number, i: any) => {
                    const q = Number(i?.quantity || 0);
                    const u = (i?.unit || 'MT').toUpperCase().trim();
                    const inMt = u === 'KG' || u === 'KGS' || u === 'KILOGRAM' || u === 'KILOGRAMS' ? q / 1000 : q;
                    return iSum + inMt;
                  }, 0);

                  return (
                    <tr
                      key={ord.id || idx}
                      className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-500 text-center">{globalIdx}</td>
                      <td className="px-5 py-3.5 text-left">
                        <div className="font-bold text-slate-900 text-sm">
                          <span className="truncate">{ord.customer_name || 'Customer'}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="font-mono">
                            {ord.created_at
                              ? new Date(ord.created_at).toLocaleString('en-IN')
                              : (ord.won_at
                                  ? new Date(ord.won_at).toLocaleString('en-IN')
                                  : (ord.po_date || '-'))}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 text-slate-800 font-semibold font-mono text-xs shadow-2xs">
                          {ord.po_number || 'PO-2026-AUTO'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 text-center font-medium">
                        {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-900 whitespace-nowrap font-mono text-xs">
                        {ordTonnage > 0 ? `${ordTonnage.toLocaleString('en-IN')} MT` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 font-medium text-center whitespace-nowrap" title={ord.delivery_location || '-'}>
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-xs">
                          {formatDeliveryLocation(ord.delivery_location)}
                        </span>
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
                                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2.5 transition-colors">
                                <Eye size={14} className="text-slate-500 shrink-0" />
                                <span>View PO</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleOpenSendModal(ord);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2.5 transition-colors">
                                <Send size={14} className="text-slate-500 shrink-0" />
                                <span>Send</span>
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
        </div>

        {/* Pagination Bar */}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/80 border-t border-slate-200 text-xs text-slate-600">
            <div className="font-medium">
              Showing <span className="font-bold text-slate-900">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-900">{endIndex}</span> of{' '}
              <span className="font-bold text-slate-900">{filtered.length}</span> orders
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={validCurrentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1 transition-colors shadow-2xs text-xs">
                <ChevronLeft size={14} /> Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || (p >= validCurrentPage - 2 && p <= validCurrentPage + 2))
                  .map((pageNum, i, arr) => {
                    const prevPageNum = arr[i - 1];
                    const showEllipsis = prevPageNum && pageNum - prevPageNum > 1;
                    return (
                      <span key={pageNum} className="flex items-center">
                        {showEllipsis && <span className="px-1 text-slate-400 font-mono text-xs">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                            validCurrentPage === pageNum
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}>
                          {pageNum}
                        </button>
                      </span>
                    );
                  })}
              </div>

              <button
                type="button"
                disabled={validCurrentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1 transition-colors shadow-2xs text-xs">
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showSendModal && shareOrder && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            setShowSendModal(false);
            setResendNotice('');
          }}>
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Share PO
              </h2>
              <button
                onClick={() => {
                  setShowSendModal(false);
                  setResendNotice('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Email Address <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. shravankotagi314@gmail.com"
                  value={sendEmail}
                  onChange={e => setSendEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                />
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
                onClick={() => {
                  setShowSendModal(false);
                  setResendNotice('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl">
                Cancel
              </button>

              <button
                type="button"
                disabled={sendingEmail || !sendEmail.trim()}
                onClick={async () => {
                  if (!shareOrder) return;
                  const targetEmail = sendEmail.trim();
                  if (!targetEmail) {
                    toast.error('Please enter a valid recipient email address');
                    return;
                  }
                  try {
                    setSendingEmail(true);
                    setResendNotice('');

                    const lineItems = (shareOrder.deal_items && shareOrder.deal_items.length > 0)
                      ? shareOrder.deal_items.map((i: any) => {
                          const rawSku = i.sku_text || 'Steel Material';
                          const rawDims = i.dimensions || '';
                          const { materialDescription, dimensions } = extractCleanProductAndSpecs(rawSku, rawDims);
                          return {
                            sku_text: materialDescription,
                            dimensions: dimensions !== '—' && dimensions !== '-' ? dimensions : '',
                            hsn_code: i.hsn_code || '7208',
                            quantity: Number(i.quantity) || 0,
                            unit: normalizeUnit(i.unit) || 'MT',
                            rate: Number(i.rate) || 0,
                            amount: Number(i.amount) || 0,
                          };
                        })
                      : [
                          {
                            sku_text: 'Steel Material',
                            dimensions: '',
                            hsn_code: '7208',
                            quantity: 0,
                            unit: 'MT',
                            rate: 0,
                            amount: Number(shareOrder.total_amount) || 0,
                          },
                        ];

                    const subtotal = lineItems.reduce((s: number, i: any) => s + (i.amount || 0), 0) || Number(shareOrder.total_amount) || 0;

                    const payload = {
                      customer_email: targetEmail,
                      customer_name: shareOrder.customer_name || 'Customer',
                      details: {
                        companyName: shareOrder.customer_name || 'Customer',
                        customerName: shareOrder.customer_name || 'Customer',
                        customerPhone: shareOrder.customer_phone || '',
                        salespersonName: (shareOrder as any).salesperson_name || 'Sales Representative',
                        poNumber: shareOrder.po_number || 'PO-2026-AUTO',
                        poDate: shareOrder.po_date || new Date().toISOString().split('T')[0],
                        deliveryLocation: shareOrder.delivery_location || '',
                        paymentTerms: shareOrder.payment_terms || '30 Days Credit',
                        lineItems,
                        totalAmount: subtotal,
                        isOrder: true,
                        media_urls: shareOrder.media_urls || undefined,
                      },
                    };

                    const res = await inquiriesApi.sendQuotation(shareOrder.id, payload);
                    const msg = res?.data?.message || res?.data?.data?.message || `PO Quotation dispatched to ${targetEmail}!`;
                    setResendNotice(msg);
                    toast.success(msg);
                    if (res?.data?.email_sent !== false) {
                      setTimeout(() => {
                        setShowSendModal(false);
                        setResendNotice('');
                      }, 2500);
                    }
                  } catch (err: any) {
                    console.error('Error sending PO document:', err);
                    const errMsg = err?.response?.data?.message || 'Failed to dispatch PO document via email';
                    setResendNotice(errMsg);
                    toast.error(errMsg);
                  } finally {
                    setSendingEmail(false);
                  }
                }}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50">
                {sendingEmail ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{sendingEmail ? 'Dispatching Email & PDF...' : 'Share PO Email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {poImageViewerUrl && (
        <div
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPoImageViewerUrl(null)}>
          <div
            className="relative max-w-5xl w-full max-h-[92vh] bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-2xl overflow-hidden flex flex-col items-center justify-center"
            onClick={e => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-4 px-1">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <FileText size={16} className="text-blue-400" />
                Original Purchase Order (PO) Document / WhatsApp Image
              </span>
              <button
                onClick={() => setPoImageViewerUrl(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 flex items-center gap-1 text-xs font-bold transition-colors">
                <X size={18} /> Close
              </button>
            </div>

            {isPdf(poImageViewerUrl) ? (
              <iframe
                src={poImageViewerUrl}
                title="Purchase Order PDF Document"
                className="w-full h-[75vh] rounded-2xl bg-white shadow-2xl border border-slate-800"
              />
            ) : (
              <img
                src={poImageViewerUrl}
                alt="Original Purchase Order Document"
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl bg-slate-950 border border-slate-800"
                onError={e => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallbackDiv = document.getElementById('po-image-fallback-card');
                  if (fallbackDiv) fallbackDiv.style.display = 'flex';
                }}
              />
            )}

            <div
              id="po-image-fallback-card"
              style={{ display: 'none' }}
              className="flex-col items-center justify-center p-8 text-center bg-slate-900/90 rounded-2xl border border-slate-800 space-y-4 max-w-md my-8">
              <div className="p-4 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
                <ImageIcon size={40} />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Purchase Order Document Attachment</h3>
                <p className="text-slate-400 text-xs mt-1">
                  Attached Document Processed Live via Gemini Vision
                </p>
                <p className="text-slate-500 text-[11px] mt-2 leading-relaxed">
                  The document details, item quantities, and commercial terms were extracted and synced live to this Orders tab.
                </p>
              </div>
            </div>

            {poImageViewerUrl.startsWith('http') && (
              <div className="flex items-center justify-center mt-3 gap-3">
                <a
                  href={poImageViewerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
                  <ExternalLink size={14} /> Open Original PO in New Tab
                </a>
              </div>
            )}
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
                      onClick={() => setShowCompanyDropdown(prev => !prev)}
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
                          No matching company found. Typing will save as new company.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PO Number <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PO-2026-0042"
                    value={formPoNumber}
                    onChange={e => setFormPoNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PO Date <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
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
                      <th className="px-3 py-3 border-r border-slate-700 w-[12%] text-center">HSN/SAC</th>
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
                              type="text"
                              value={item.sku_text || ''}
                              onChange={(e) => {
                                const updated = [...formLineItems];
                                updated[idx] = { ...updated[idx], sku_text: e.target.value };
                                setFormLineItems(updated);
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
                                  const updated = [...formLineItems];
                                  updated[idx] = { ...updated[idx], dimensions: e.target.value };
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
                            type="text"
                            value={item.hsn_code || ''}
                            onChange={(e) => {
                              const updated = [...formLineItems];
                              updated[idx] = { ...updated[idx], hsn_code: e.target.value };
                              setFormLineItems(updated);
                            }}
                            placeholder="e.g. 7208"
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs font-mono text-center text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                          />
                        </td>
                        <td className="px-3 py-3.5 border-r border-slate-200">
                          <div className="flex items-center gap-1.5 w-full min-w-[135px]">
                            <input
                              type="number"
                              min="0"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                const rawQ = val === '' ? 0 : parseFloat(val);
                                const safeQ = isNaN(rawQ) || rawQ < 0 ? 0 : rawQ;
                                const updated = [...formLineItems];
                                const amt = Math.max(0, Math.round(safeQ * (updated[idx]?.rate || 0)));
                                updated[idx] = { ...updated[idx], quantity: safeQ, amount: amt };
                                setFormLineItems(updated);
                              }}
                              placeholder="0"
                              className="flex-1 min-w-[65px] px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs text-slate-900 font-mono outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal text-center"
                            />
                            <select
                              value={normalizeUnit(item.unit) || 'MT'}
                              onChange={(e) => {
                                const updated = [...formLineItems];
                                updated[idx] = { ...updated[idx], unit: e.target.value };
                                setFormLineItems(updated);
                              }}
                              className="w-[62px] shrink-0 px-1 py-1.5 bg-slate-50 border border-slate-300 rounded text-[11px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500">
                              <option value="MT">MT</option>
                              <option value="Nos">Nos</option>
                              <option value="Pcs">Pcs</option>
                              <option value="KG">KG</option>
                              <option value="Sheets">Sheets</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 border-r border-slate-200 font-bold font-mono">
                          <input
                            type="number"
                            min="0"
                            value={item.rate === 0 ? '' : item.rate}
                            onChange={(e) => {
                              const val = e.target.value;
                              const rawR = val === '' ? 0 : parseFloat(val);
                              const safeR = isNaN(rawR) || rawR < 0 ? 0 : rawR;
                              const updated = [...formLineItems];
                              const amt = Math.max(0, Math.round((updated[idx]?.quantity || 0) * safeR));
                              updated[idx] = { ...updated[idx], rate: safeR, amount: amt };
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
                                    { sku_text: '', dimensions: '', hsn_code: '7208', quantity: 0, unit: 'MT', rate: 0, amount: 0 },
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

                  const totalQty = formLineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                  const distinctUnits = Array.from(new Set(formLineItems.map(i => normalizeUnit(i.unit) || 'MT')));
                  const primaryUnit = distinctUnits.length === 1 ? distinctUnits[0] : (distinctUnits.length === 0 ? 'MT' : 'units');
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Delivery Location <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
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
                    type="text"
                    placeholder="e.g. 30 Days Credit, 100% Advance"
                    value={formPaymentTerms}
                    onChange={e => setFormPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50">
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
