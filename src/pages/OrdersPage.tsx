import { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  CheckCircle,
  PackageCheck,
  Truck,
  RefreshCw,
  X,
  Building2,
  Eye,
  UploadCloud,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi, inquiriesApi } from '../lib/api';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import SalesQuotationModal from '../components/SalesQuotationModal';

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
  po_number?: string;
  po_date?: string;
  total_amount?: number;
  delivery_location?: string;
  delivery_date?: string;
  payment_terms?: string;
  created_at: string;
  won_at?: string;
  deal_items?: DealItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedQuotationOrder, setSelectedQuotationOrder] = useState<Order | null>(null);

  // AI OCR Scanning state
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [poFileName, setPoFileName] = useState('');

  const now = new Date();
  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  });

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formPoNumber, setFormPoNumber] = useState('');
  const [formPoDate, setFormPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [formProductSKU, setFormProductSKU] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formDeliveryLocation, setFormDeliveryLocation] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('30 Days Credit');
  const [formExtractedItems, setFormExtractedItems] = useState<DealItem[]>([]);

  // Commercial breakdown state
  const [formBasicAmount, setFormBasicAmount] = useState<number>(0);
  const [formGstAmount, setFormGstAmount] = useState<number>(0);
  const [formGrandTotal, setFormGrandTotal] = useState<number>(0);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await ordersApi.getAll();
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : raw?.data && Array.isArray(raw.data) ? raw.data : [];
      setOrders(list);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPoFileName(file.name);
    setIsParsingDoc(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;

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
              setFormProductSKU(
                mappedItems[0].sku_text +
                  (mappedItems[0].dimensions ? ` (${mappedItems[0].dimensions})` : '')
              );
            } else {
              setFormProductSKU(
                mappedItems.map((i, idx) => `${idx + 1}. ${i.sku_text}${i.dimensions ? ` (${i.dimensions})` : ''} - ${i.quantity} MT`).join(', ')
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

  // Dynamic calculations
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
      toast.error('Please enter Customer / Company Name');
      return;
    }

    const qty = Number(formQuantity) || 0;
    const rate = Number(formRate) || 0;
    const computedAmt = qty > 0 && rate > 0 ? qty * rate : 0;

    let lineItemsToSend = formExtractedItems.length > 0
      ? formExtractedItems
      : formProductSKU
      ? [{
          sku_text: formProductSKU,
          quantity: qty,
          unit: 'MT',
          rate: rate,
          amount: computedAmt,
        }]
      : [];

    const finalOrderValue = totalDealValue > 0 ? totalDealValue : (basicValue > 0 ? basicValue : computedAmt);

    try {
      setSubmitting(true);
      await ordersApi.processPo({
        customer_name: formCustomerName.trim(),
        customer_phone: formCustomerPhone.trim() || undefined,
        po_number: formPoNumber.trim() || undefined,
        po_date: formPoDate,
        total_amount: finalOrderValue,
        delivery_location: formDeliveryLocation.trim() || undefined,
        payment_terms: formPaymentTerms.trim() || undefined,
        line_items: lineItemsToSend,
      });

      toast.success('🎉 Order Confirmed & Won! Sales Achievement & Payment tracking updated.');
      setShowModal(false);

      // Reset form
      setFormCustomerName('');
      setFormCustomerPhone('');
      setFormPoNumber('');
      setFormPoDate(new Date().toISOString().split('T')[0]);
      setFormProductSKU('');
      setFormQuantity('');
      setFormRate('');
      setFormDeliveryLocation('');
      setFormPaymentTerms('30 Days Credit');
      setPoFileName('');
      setFormExtractedItems([]);
      setFormBasicAmount(0);
      setFormGstAmount(0);
      setFormGrandTotal(0);

      fetchOrders();
    } catch (err: any) {
      console.error('Error creating order:', err);
      toast.error(err?.response?.data?.message || 'Failed to log order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

function parseSafeIsoDate(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  // Match DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[-/]/);
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  // Match YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {}
  return '';
}

  const safeOrders = Array.isArray(orders) ? orders : [];

  // Filter orders by date range & search
  const filtered = safeOrders.filter(o => {
    if (dateRange.from && dateRange.to) {
      const isDateInRange = (dStr?: string) => {
        if (!dStr) return false;
        const d = parseSafeIsoDate(dStr);
        return Boolean(d && d >= dateRange.from! && d <= dateRange.to!);
      };

      // An order matches the date filter if won_at, created_at, OR po_date falls in range
      const wonInRange = isDateInRange(o.won_at);
      const createdInRange = isDateInRange(o.created_at);
      const poInRange = isDateInRange(o.po_date);

      if (!wonInRange && !createdInRange && !poInRange) {
        return false;
      }
    }

    const itemsStr = (o?.deal_items || []).map(i => i?.sku_text || '').join(' ');
    return (
      (o?.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o?.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o?.delivery_location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      itemsStr.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const totalOrders = filtered.length;
  const totalRevenue = filtered.reduce((sum, o) => sum + Number(o?.total_amount || 0), 0);
  const totalTonnage = filtered.reduce((sum, o) => {
    const itemsQty = (o?.deal_items || []).reduce((iSum, i) => iSum + Number(i?.quantity || 0), 0);
    return sum + itemsQty;
  }, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
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

        <div className="flex flex-wrap items-center gap-2">
          <DateFilterControl onChange={setDateRange} />
          <button
            onClick={fetchOrders}
            className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg flex items-center gap-2 shadow-sm transition-colors">
            <Plus size={18} />
            Create New Order
          </button>
        </div>
      </div>

      {/* Stats Cards */}
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

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, PO number, location, product..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Sr.</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Products &amp; Items</th>
                <th className="px-4 py-3 text-right">Order Value (₹)</th>
                <th className="px-4 py-3">Delivery Location</th>
                <th className="px-4 py-3 text-right">Status</th>
                <th className="px-4 py-3 text-center">Quotation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Loading orders data...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filtered.map((ord, idx) => {
                  const itemsStr = (ord?.deal_items || [])
                    .map(i => `${i?.quantity ? `${i.quantity} ${i.unit || 'MT'}` : ''} ${i?.sku_text || 'Material'}`)
                    .filter(Boolean)
                    .join(', ') || 'Metal Products';

                  return (
                    <tr
                      key={ord.id || idx}
                      onClick={() => setSelectedQuotationOrder(ord)}
                      className="hover:bg-blue-50/80 transition-colors cursor-pointer group select-none"
                      title="Click to view full Official Sales Quotation & Invoice">
                      <td className="px-4 py-3.5 font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {ord.po_date || (ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-IN') : '-')}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-blue-700 font-semibold">
                        <span className="inline-flex items-center gap-1.5 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white px-2.5 py-1 rounded-md border border-blue-200 group-hover:border-blue-600 transition-all font-bold shadow-2xs">
                          <FileText size={13} /> {ord.po_number || 'PO-2026-AUTO'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        <span className="flex items-center gap-1.5 group-hover:text-blue-700 transition-colors">
                          <Building2 size={14} className="text-slate-400 group-hover:text-blue-500" />
                          {ord.customer_name || 'Customer'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-800 font-medium max-w-xs truncate" title={itemsStr}>
                        {itemsStr}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₹{Number(ord.total_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {ord.delivery_location || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                          <CheckCircle size={12} /> Won / Delivered 🎉
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedQuotationOrder(ord);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all group-hover:shadow-md hover:scale-105">
                          <Eye size={14} /> View Quotation
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

      {/* Create New Order Modal with Document Upload & Breakdown */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="text-blue-600" size={20} />
                Create New Order (Mark Won)
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Upload PO Document Banner */}
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5 cursor-pointer">
                  <UploadCloud size={16} className="text-blue-600" />
                  Upload PO Document (Auto-Fill via Gemini)
                </label>
                {isParsingDoc && (
                  <span className="text-xs text-blue-600 flex items-center gap-1 font-semibold animate-pulse">
                    <RefreshCw size={12} className="animate-spin" /> Extracting...
                  </span>
                )}
              </div>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-600 file:mr-2.5 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />
              {poFileName && (
                <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle size={12} /> {poFileName} (Details auto-filled below)
                </p>
              )}
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supreme Steel"
                  value={formCustomerName}
                  onChange={e => {
                    setFormCustomerName(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PO Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if empty"
                    value={formPoNumber}
                    onChange={e => setFormPoNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PO Date</label>
                  <input
                    type="date"
                    value={formPoDate}
                    onChange={e => setFormPoDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Description / SKU</label>
                <input
                  type="text"
                  placeholder="e.g. TMT Bar 12mm"
                  value={formProductSKU}
                  onChange={e => setFormProductSKU(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity (MT)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 30"
                    value={formQuantity}
                    onChange={e => {
                      setFormQuantity(e.target.value);
                      setFormBasicAmount(0);
                      setFormGstAmount(0);
                      setFormGrandTotal(0);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rate per MT (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 58000"
                    value={formRate}
                    onChange={e => {
                      setFormRate(e.target.value);
                      setFormBasicAmount(0);
                      setFormGstAmount(0);
                      setFormGrandTotal(0);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Commercial Breakdown: PO Basic Value, GST, and Total Deal Value */}
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
                        Official PO amount for Sales Achievement & Payment Tracking
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

      {/* Official Sales Quotation & Tax Invoice Modal */}
      {selectedQuotationOrder && (
        <SalesQuotationModal
          deal={selectedQuotationOrder}
          onClose={() => setSelectedQuotationOrder(null)}
        />
      )}
    </div>
  );
}
