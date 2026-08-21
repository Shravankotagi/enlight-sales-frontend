import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  Plus,
  Search,
  CheckCircle,
  PackageCheck,
  Truck,
  X,
  Building2,
  Eye,
  UploadCloud,
  FileText,
  Phone,
  Calendar,
  MapPin,
  CreditCard,
  Package,
  ExternalLink,
  ImageIcon,
  User,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi, inquiriesApi, dealsApi, customersApi } from '../lib/api';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { useAuth } from '../context/AuthContext';
import { getFirstDayOfMonth, getLastDayOfMonth } from '../utils/dateUtils';
import { calculatePricingSummary } from '../utils/pricingEngine';

interface DealItem {
  id?: string;
  sku_text?: string;
  dimensions?: string;
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

  // Selected Order for Details Drawer & PO Image Viewer
  const [selectedDrawerOrder, setSelectedDrawerOrder] = useState<Order | null>(null);
  const [poImageViewerUrl, setPoImageViewerUrl] = useState<string | null>(null);

  // Prevent background scrolling when any modal or drawer is open
  useEffect(() => {
    const isAnyModalOpen = showModal || !!selectedDrawerOrder || !!poImageViewerUrl;
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow || 'unset';
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [showModal, selectedDrawerOrder, poImageViewerUrl]);

  // AI OCR Scanning state
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [poFileName, setPoFileName] = useState('');

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formPoNumber, setFormPoNumber] = useState('');
  const [formPoDate, setFormPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [formProductSKU, setFormProductSKU] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formDeliveryLocation, setFormDeliveryLocation] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('');
  const [formExtractedItems, setFormExtractedItems] = useState<DealItem[]>([]);
  const [formUploadedBase64, setFormUploadedBase64] = useState<string | null>(null);

  // Commercial breakdown state
  const [formBasicAmount, setFormBasicAmount] = useState<number>(0);
  const [formGstAmount, setFormGstAmount] = useState<number>(0);
  const [formGrandTotal, setFormGrandTotal] = useState<number>(0);

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

          if (extraction.basic_amount || extraction.po_basic_value) {
            setFormBasicAmount(Number(extraction.basic_amount || extraction.po_basic_value) || 0);
          }
          if (extraction.gst_amount || extraction.tax_amount) {
            setFormGstAmount(Number(extraction.gst_amount || extraction.tax_amount) || 0);
          }
          if (extraction.total_amount || extraction.grand_total) {
            setFormGrandTotal(Number(extraction.total_amount || extraction.grand_total) || 0);
          }

          if (Array.isArray(extraction.line_items) && extraction.line_items.length > 0) {
            const mappedItems: DealItem[] = extraction.line_items.map((i: any) => ({
              sku_text: i.sku_text || i.description || 'Material',
              dimensions: i.dimensions || '',
              quantity: Number(i.quantity) || 0,
              unit: i.unit || 'MT',
              rate: Number(i.rate) || 0,
              amount: Number(i.amount) || Math.round(Number(i.quantity || 0) * Number(i.rate || 0)),
            }));
            setFormExtractedItems(mappedItems);

            const totalQty = mappedItems.reduce((s, i) => s + (i.quantity || 0), 0);
            const totalAmt = mappedItems.reduce((s, i) => s + (i.amount || 0), 0);
            const avgRate = totalQty > 0 ? Math.round(totalAmt / totalQty) : (mappedItems[0]?.rate || 0);

            if (mappedItems.length === 1) {
              const item = mappedItems[0];
              const skuText = item.sku_text || 'Material';
              const dimStr = item.dimensions && !skuText.includes(item.dimensions) ? ` (${item.dimensions})` : '';
              setFormProductSKU(`1. ${skuText}${dimStr} - ${item.quantity} ${item.unit || 'MT'}`);
            } else {
              setFormProductSKU(
                mappedItems
                  .map((i, idx) => {
                    const skuText = i.sku_text || 'Material';
                    const dimStr = i.dimensions && !skuText.includes(i.dimensions) ? ` (${i.dimensions})` : '';
                    return `${idx + 1}. ${skuText}${dimStr} - ${i.quantity} ${i.unit || 'MT'}`;
                  })
                  .join('\n')
              );
            }

            setFormQuantity(totalQty > 0 ? String(totalQty) : '');
            setFormRate(avgRate > 0 ? String(avgRate) : '');
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

  const basicValue =
    formBasicAmount > 0
      ? formBasicAmount
      : formExtractedItems.length > 0
      ? formExtractedItems.reduce((s, i) => s + (Number(i.amount) || Math.round(Number(i.quantity || 0) * Number(i.rate || 0))), 0)
      : Math.round((Number(formQuantity) || 0) * (Number(formRate) || 0));

  const gstValue =
    formGstAmount > 0
      ? formGstAmount
      : basicValue > 0
      ? Math.round(basicValue * 0.18)
      : 0;

  const totalDealValue =
    formGrandTotal > 0
      ? formGrandTotal
      : basicValue > 0
      ? basicValue + gstValue
      : 0;

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
    if (!formProductSKU.trim()) {
      toast.error('Please enter Product Description / SKU');
      return;
    }
    const qty = Number(formQuantity) || 0;
    if (qty <= 0) {
      toast.error('Please enter valid Quantity');
      return;
    }
    const rate = Number(formRate) || 0;
    if (rate <= 0) {
      toast.error('Please enter valid Rate per MT');
      return;
    }
    if (!formDeliveryLocation.trim()) {
      toast.error('Please enter Delivery Location');
      return;
    }

    const computedAmt = qty > 0 && rate > 0 ? qty * rate : 0;

    let lineItemsToSend = formExtractedItems;
    if (lineItemsToSend.length === 0 && formProductSKU.trim()) {
      try {
        const textExtractRes = await inquiriesApi.parseText({
          text: `${formProductSKU} Quantity: ${formQuantity} MT Rate: ${formRate} Delivery: ${formDeliveryLocation} Payment: ${formPaymentTerms || '30 days'}`,
        });
        const extractedData = textExtractRes?.data?.data || textExtractRes?.data;
        if (Array.isArray(extractedData?.line_items) && extractedData.line_items.length > 0) {
          lineItemsToSend = extractedData.line_items.map((i: any) => ({
            sku_text: i.sku_text || i.sku || i.product_name || i.description || formProductSKU,
            dimensions: i.dimensions || '',
            quantity: Number(i.quantity) || qty || 0,
            unit: i.unit || 'MT',
            rate: Number(i.rate) || rate || 0,
            amount: Number(i.amount) || Math.round((Number(i.quantity) || qty || 0) * (Number(i.rate) || rate || 0)),
          }));
        }
      } catch (e) {
        console.warn('Fallback manual single line item for order creation');
      }
    }

    if (lineItemsToSend.length === 0 && formProductSKU.trim()) {
      lineItemsToSend = [{
        sku_text: formProductSKU.trim(),
        quantity: qty,
        unit: 'MT',
        rate: rate,
        amount: computedAmt,
      }];
    }

    const finalOrderValue = totalDealValue > 0 ? totalDealValue : (basicValue > 0 ? basicValue : computedAmt);

    try {
      setSubmitting(true);
      await ordersApi.processPo({
        customer_name: formCustomerName.trim(),
        customer_phone: formCustomerPhone.trim() || undefined,
        po_number: formPoNumber.trim(),
        po_date: formPoDate,
        total_amount: finalOrderValue,
        delivery_location: formDeliveryLocation.trim(),
        payment_terms: formPaymentTerms.trim() || undefined,
        line_items: lineItemsToSend,
        media_urls: formUploadedBase64 ? [formUploadedBase64] : undefined,
      });

      toast.success('Order Confirmed & Won! Sales Achievement & Payment tracking updated.');
      setShowModal(false);

      setFormCustomerName('');
      setFormCustomerPhone('');
      setFormPoNumber('');
      setFormPoDate(new Date().toISOString().split('T')[0]);
      setFormProductSKU('');
      setFormQuantity('');
      setFormRate('');
      setFormDeliveryLocation('');
      setFormPaymentTerms('');
      setFormExtractedItems([]);
      setFormBasicAmount(0);
      setFormGstAmount(0);
      setFormGrandTotal(0);
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
          <p className="text-slate-500 text-sm mt-1">
            Track confirmed sales orders, PO numbers, tonnage, and delivery dispatches.
          </p>
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
                <th className="px-4 py-3 text-center w-[12%]">Purchase Order</th>
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
                      onClick={() => setSelectedDrawerOrder(ord)}
                      className="hover:bg-blue-50/80 transition-colors cursor-pointer group select-none"
                      title="Click anywhere on row to view full Order Details in table format">
                      <td className="px-4 py-3.5 font-medium text-slate-500 text-center">{globalIdx}</td>
                      <td className="px-5 py-3.5 text-left">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <Building2 size={15} className="text-slate-700 shrink-0" />
                          <span className="truncate">{ord.customer_name || 'Customer'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          <span className="font-mono">
                            {ord.created_at
                              ? new Date(ord.created_at).toLocaleString('en-IN')
                              : (ord.won_at
                                  ? new Date(ord.won_at).toLocaleString('en-IN')
                                  : (ord.po_date || '-'))}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-blue-700 font-semibold text-center">
                        <span className="inline-flex items-center justify-center gap-1.5 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white px-2.5 py-1 rounded-md border border-blue-200 group-hover:border-blue-600 transition-all font-bold shadow-2xs">
                          <FileText size={13} /> {ord.po_number || 'PO-2026-AUTO'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 text-center font-medium">
                        {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-900 whitespace-nowrap font-mono text-xs">
                        {ordTonnage > 0 ? `${ordTonnage.toLocaleString('en-IN')} MT` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 font-medium text-center whitespace-nowrap" title={ord.delivery_location || '-'}>
                        <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-xs">
                          <MapPin size={12} className="text-rose-500 shrink-0" />
                          {formatDeliveryLocation(ord.delivery_location)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleViewPoDocument(ord);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 inline-flex items-center gap-1 shadow-2xs"
                          title="View Original Purchase Order Image / Document">
                          <Eye size={13} className="text-slate-600" />
                          <span>View PO</span>
                        </button>
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

      {selectedDrawerOrder && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={() => setSelectedDrawerOrder(null)}>
          <div
            className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-6 my-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-900">
                    {selectedDrawerOrder.customer_name || 'Customer Order'}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle size={12} /> Won / Confirmed 
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  {selectedDrawerOrder.customer_phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={13} className="text-slate-400" /> {selectedDrawerOrder.customer_phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-slate-400" /> Order Date &amp; Time: {selectedDrawerOrder.created_at ? new Date(selectedDrawerOrder.created_at).toLocaleString('en-IN') : (selectedDrawerOrder.won_at ? new Date(selectedDrawerOrder.won_at).toLocaleString('en-IN') : selectedDrawerOrder.po_date || '-')}
                  </span>
                  <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    PO Ref: {selectedDrawerOrder.po_number || 'PO-2026-AUTO'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {selectedDrawerOrder.media_urls && selectedDrawerOrder.media_urls.length > 0 && (
                  <button
                    onClick={() => handleViewPoDocument(selectedDrawerOrder)}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs">
                    <ImageIcon size={14} /> View Original PO Image 
                  </button>
                )}
                <button
                  onClick={() => setSelectedDrawerOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={14} className="text-blue-600" /> Extracted Line Items &amp; Commercial Breakdown
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3 text-center">Sr.</th>
                      <th className="px-4 py-3 text-center">Material Description &amp; SKU</th>
                      <th className="px-4 py-3 text-center">Dimensions / Specs</th>
                      <th className="px-4 py-3 text-center">Quantity</th>
                      <th className="px-4 py-3 text-center">Unit Rate (₹/MT)</th>
                      <th className="px-4 py-3 text-center">Line Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedDrawerOrder.deal_items && selectedDrawerOrder.deal_items.length > 0 ? (
                      selectedDrawerOrder.deal_items.map((item, iIdx) => {
                        const rateNum = Number(item.rate || 0);
                        const qtyNum = Number(item.quantity || 0);
                        const amtNum = Number(item.amount) || (rateNum > 0 && qtyNum > 0 ? Math.round(rateNum * qtyNum) : 0);

                        return (
                          <tr key={iIdx} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-400">{iIdx + 1}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{item.sku_text || 'Steel Material'}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono">{item.dimensions || '-'}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-blue-600 font-mono">
                              {qtyNum > 0 ? `${qtyNum} ${item.unit || 'MT'}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-700 font-mono">
                              {rateNum > 0 ? `₹${rateNum.toLocaleString('en-IN')}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-700 font-mono">
                              ₹{amtNum.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="px-4 py-3 font-medium text-slate-400">1</td>
                        <td className="px-4 py-3 font-bold text-slate-900">Steel Material Requirements</td>
                        <td className="px-4 py-3 text-slate-600 font-mono">-</td>
                        <td className="px-4 py-3 text-right font-extrabold text-blue-600 font-mono">-</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700 font-mono">-</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700 font-mono">
                          ₹{Number(selectedDrawerOrder.total_amount || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-300 text-xs">
                    {(() => {
                      const pricing = calculatePricingSummary({
                        lineItems: selectedDrawerOrder.deal_items || [],
                        total_amount: Number(selectedDrawerOrder.total_amount || 0),
                      });
                      const totalVal = pricing.grandTotal;

                      return (
                        <tr className="bg-emerald-100/90 text-emerald-950 font-black">
                          <td colSpan={4} className="px-4 py-3 font-extrabold text-xs uppercase tracking-wide">
                            Total Order Value (Incl. 18% GST)
                          </td>
                          <td colSpan={2} className="px-4 py-3 text-right font-black text-emerald-900 text-base font-mono">
                            ₹{totalVal.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivery Location</span>
                  <span className="font-semibold text-slate-800">{selectedDrawerOrder.delivery_location || '-'}</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CreditCard size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Terms</span>
                  <span className="font-semibold text-purple-700">{selectedDrawerOrder.payment_terms || '-'}</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Order Won Date</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedDrawerOrder.won_at ? new Date(selectedDrawerOrder.won_at).toLocaleString('en-IN') : (selectedDrawerOrder.created_at ? new Date(selectedDrawerOrder.created_at).toLocaleString('en-IN') : '-')}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <User size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Salesperson</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedDrawerOrder.salesperson_phone || '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedDrawerOrder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors">
                Close Details
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleViewPoDocument(selectedDrawerOrder);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5">
                  <Eye size={15} /> View Original PO Document
                </button>
              </div>
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
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

            {/* Upload PO Document Section matching Img 4 */}
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Description / SKU <span className="text-red-500 font-bold">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. TMT Bar 12mm - 30 MT @ ₹58,000/MT&#10;HR Coil 2.5mm - 10 MT @ ₹62,000/MT"
                  value={formProductSKU}
                  onChange={e => setFormProductSKU(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 resize-y max-h-40 overflow-y-auto leading-relaxed placeholder:text-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quantity (MT) <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    placeholder="e.g. 30"
                    value={formQuantity}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setFormQuantity(val < 0 ? '0' : e.target.value);
                      setFormBasicAmount(0);
                      setFormGstAmount(0);
                      setFormGrandTotal(0);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rate per MT (₹) <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    placeholder="e.g. 58000"
                    value={formRate}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setFormRate(val < 0 ? '0' : e.target.value);
                      setFormBasicAmount(0);
                      setFormGstAmount(0);
                      setFormGrandTotal(0);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Location <span className="text-red-500 font-bold">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Gat No / Plot No PAP V :- 149/2, Village Vasuli, Chakan, Pune, Maharashtra - 410501"
                  value={formDeliveryLocation}
                  onChange={e => setFormDeliveryLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 resize-y max-h-32 overflow-y-auto leading-relaxed placeholder:text-slate-400 font-medium"
                />
              </div>

              {basicValue > 0 && (
                <div className="p-3.5 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 rounded-xl border border-blue-200 space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span className="font-semibold">PO Basic Value:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ₹{basicValue.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span className="font-semibold">GST Value (18% / SGST+CGST):</span>
                    <span className="font-mono font-bold text-amber-700">
                      +₹{gstValue.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-blue-200/80 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-blue-900">Total Deal Value (Incl. GST):</p>
                      <p className="text-[10px] text-slate-500">
                        Official PO amount for Sales Achievement &amp; Payment Tracking
                      </p>
                    </div>
                    <p className="text-lg font-bold text-blue-900 font-mono">
                      ₹{totalDealValue.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              )}

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
