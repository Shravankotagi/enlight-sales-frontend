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
  FileText,
  Building2,
  Eye,
  UploadCloud,
  Sparkles,
  Layers,
  Phone,
  Trash2,
  Calendar,
  MapPin,
  CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi, dealsApi, inquiriesApi } from '../lib/api';
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
  const [activeDeals, setActiveDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<'ai' | 'manual'>('ai');
  const [submitting, setSubmitting] = useState(false);
  const [selectedQuotationOrder, setSelectedQuotationOrder] = useState<Order | null>(null);

  // AI OCR Scanning state
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [poFileName, setPoFileName] = useState('');
  const [selectedDealId, setSelectedDealId] = useState('');

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
  const [formDeliveryLocation, setFormDeliveryLocation] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('30 Days Credit');
  const [formLineItems, setFormLineItems] = useState<DealItem[]>([
    { sku_text: '', dimensions: '', quantity: 0, unit: 'MT', rate: 0, amount: 0 },
  ]);

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

  const fetchActiveDeals = async () => {
    try {
      const res = await dealsApi.getAll();
      const list = res?.data || [];
      setActiveDeals(list.filter((d: any) => !['won', 'lost'].includes(d.stage)));
    } catch (err) {
      console.error('Error fetching active deals:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchActiveDeals();
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

          if (Array.isArray(extraction.line_items) && extraction.line_items.length > 0) {
            const mappedItems = extraction.line_items.map((i: any) => ({
              sku_text: i.sku_text || i.description || 'Material',
              dimensions: i.dimensions || '',
              quantity: Number(i.quantity) || 0,
              unit: i.unit || 'MT',
              rate: Number(i.rate) || 0,
              amount: Number(i.amount) || Math.round(Number(i.quantity || 0) * Number(i.rate || 0)),
            }));
            setFormLineItems(mappedItems);
          }

          toast.success('PO Document parsed successfully with Gemini OCR!');
        }
      } catch (err: any) {
        console.error('Error parsing PO document with Gemini:', err);
        toast.error('Could not auto-extract PO details. You can enter the details manually.');
      } finally {
        setIsParsingDoc(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddItem = () => {
    setFormLineItems(prev => [
      ...prev,
      { sku_text: '', dimensions: '', quantity: 0, unit: 'MT', rate: 0, amount: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setFormLineItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof DealItem, value: any) => {
    setFormLineItems(prev => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'rate') {
        const q = field === 'quantity' ? Number(value) : Number(current.quantity);
        const r = field === 'rate' ? Number(value) : Number(current.rate);
        current.amount = Math.round(q * r);
      }
      updated[index] = current;
      return updated;
    });
  };

  const calculatedTotal = formLineItems.reduce(
    (sum, item) => sum + (Number(item.amount) || Math.round(Number(item.quantity || 0) * Number(item.rate || 0))),
    0,
  );

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      toast.error('Please enter customer / company name');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        deal_id: selectedDealId || undefined,
        customer_name: formCustomerName.trim(),
        customer_phone: formCustomerPhone.trim() || undefined,
        po_number: formPoNumber.trim() || undefined,
        po_date: formPoDate,
        total_amount: calculatedTotal > 0 ? calculatedTotal : 0,
        delivery_location: formDeliveryLocation.trim() || undefined,
        payment_terms: formPaymentTerms.trim() || undefined,
        line_items: formLineItems.filter(i => (i.sku_text && i.sku_text.trim()) || Number(i.quantity) > 0),
      };

      await ordersApi.processPo(payload);

      toast.success('🎉 Purchase Order Confirmed! Deal marked WON, KRA 1 & Payment Tracking updated.');
      setShowModal(false);

      // Reset form
      setFormCustomerName('');
      setFormCustomerPhone('');
      setFormPoNumber('');
      setFormPoDate(new Date().toISOString().split('T')[0]);
      setFormDeliveryLocation('');
      setFormPaymentTerms('30 Days Credit');
      setSelectedDealId('');
      setPoFileName('');
      setFormLineItems([{ sku_text: '', dimensions: '', quantity: 0, unit: 'MT', rate: 0, amount: 0 }]);

      fetchOrders();
      fetchActiveDeals();
    } catch (err: any) {
      console.error('Error processing PO order:', err);
      toast.error(err?.response?.data?.message || 'Failed to record purchase order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const safeOrders = Array.isArray(orders) ? orders : [];

  // Filter orders by date range & search
  const filtered = safeOrders.filter(o => {
    if (dateRange.from && dateRange.to) {
      const dateStr = o.po_date || o.created_at || o.won_at;
      if (dateStr) {
        const itemDate = new Date(dateStr).toISOString().split('T')[0];
        if (itemDate < dateRange.from || itemDate > dateRange.to) return false;
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
            Track confirmed sales orders, PO numbers, negotiated amounts, tonnage, and payment tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateFilterControl onChange={setDateRange} />
          <button
            onClick={() => {
              fetchOrders();
              fetchActiveDeals();
            }}
            className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl flex items-center gap-2 shadow-sm transition-all hover:shadow-md">
            <Plus size={18} />
            Log Client PO / Order (Mark Won)
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Orders Won (KRA 1)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalOrders}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <ShoppingBag size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Revenue Achieved</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">₹{totalRevenue.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <PackageCheck size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
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
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 justify-between items-center">
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Sr.</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Products &amp; Items</th>
                <th className="px-4 py-3 text-right">Final PO Value (₹)</th>
                <th className="px-4 py-3">Delivery Location</th>
                <th className="px-4 py-3">Payment Terms</th>
                <th className="px-4 py-3 text-right">Status</th>
                <th className="px-4 py-3 text-center">Quotation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    Loading orders data...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filtered.map((ord, idx) => {
                  const itemsList = ord?.deal_items || [];
                  const primaryItem = itemsList[0];
                  const extraCount = itemsList.length - 1;

                  return (
                    <tr key={ord.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {ord.po_date
                          ? new Date(ord.po_date).toLocaleDateString('en-IN')
                          : ord.won_at
                          ? new Date(ord.won_at).toLocaleDateString('en-IN')
                          : new Date(ord.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-blue-700 whitespace-nowrap">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                          {ord.po_number || 'PO-CONFIRMED'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-slate-400 shrink-0" />
                          <span>{ord.customer_name}</span>
                        </div>
                        {ord.customer_phone && (
                          <div className="text-xs text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                            <Phone size={11} /> {ord.customer_phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 max-w-xs">
                        {primaryItem ? (
                          <div>
                            <span className="font-medium text-slate-800">
                              {primaryItem.sku_text}
                              {primaryItem.dimensions ? ` (${primaryItem.dimensions})` : ''}
                            </span>
                            <span className="text-slate-500 ml-1">
                              · {primaryItem.quantity || 0} {primaryItem.unit || 'MT'}
                              {primaryItem.rate ? ` @ ₹${Number(primaryItem.rate).toLocaleString('en-IN')}` : ''}
                            </span>
                            {extraCount > 0 && (
                              <span className="ml-1.5 inline-block text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                +{extraCount} more items
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Metal Products</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-700 whitespace-nowrap text-sm">
                        ₹{Number(ord.total_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                        {ord.delivery_location || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap font-medium">
                        {ord.payment_terms || <span className="text-slate-400">30 Days</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle size={12} /> Won / Delivered 🎉
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedQuotationOrder(ord);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all hover:scale-105">
                          <Eye size={13} /> View Quotation
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

      {/* Log Client PO Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="text-emerald-600" size={22} />
                Confirm Client Purchase Order (Mark Won 🎉)
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex gap-2 border-b border-slate-100 pb-2">
              <button
                type="button"
                onClick={() => setModalTab('ai')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  modalTab === 'ai'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                <Sparkles size={14} /> AI PO Document Scanner (Vision OCR)
              </button>
              <button
                type="button"
                onClick={() => setModalTab('manual')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  modalTab === 'manual'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                <Layers size={14} /> Manual Entry ✍️
              </button>
            </div>

            {modalTab === 'ai' && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UploadCloud className="text-blue-600" size={20} />
                    <span className="text-xs font-bold text-blue-900">Upload Client Signed PO Document (Image or PDF)</span>
                  </div>
                  {isParsingDoc && (
                    <span className="text-xs text-blue-600 flex items-center gap-1 font-semibold animate-pulse">
                      <RefreshCw size={12} className="animate-spin" /> Gemini Extracting PO...
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
                {poFileName && (
                  <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle size={13} /> Selected Document: {poFileName}
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="space-y-4">
              {/* Optional: Link to Existing Pipeline Deal */}
              {activeDeals.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Link to Active Pipeline Deal / Quotation (Optional)
                  </label>
                  <select
                    value={selectedDealId}
                    onChange={e => {
                      const dId = e.target.value;
                      setSelectedDealId(dId);
                      const matched = activeDeals.find(d => d.id === dId);
                      if (matched) {
                        setFormCustomerName(matched.customer_name || '');
                        if (matched.delivery_location) setFormDeliveryLocation(matched.delivery_location);
                        if (matched.payment_terms) setFormPaymentTerms(matched.payment_terms);
                        if (matched.deal_items && matched.deal_items.length > 0) {
                          setFormLineItems(
                            matched.deal_items.map((i: any) => ({
                              sku_text: i.sku_text || '',
                              dimensions: i.dimensions || '',
                              quantity: i.quantity || 0,
                              unit: i.unit || 'MT',
                              rate: i.rate || 0,
                              amount: i.amount || Math.round((i.quantity || 0) * (i.rate || 0)),
                            })),
                          );
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium">
                    <option value="">-- Select Existing Deal to Mark Won (or Auto-Match) --</option>
                    {activeDeals.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.customer_name} · Stage: {d.stage.toUpperCase()} · ₹
                        {Number(d.total_amount || 0).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Company Name *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 text-slate-400" size={15} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maheshwari Heavy Forgings Ltd."
                      value={formCustomerName}
                      onChange={e => setFormCustomerName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="e.g. +91 98220 44589"
                      value={formCustomerPhone}
                      onChange={e => setFormCustomerPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Client PO Number *</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 text-slate-400" size={15} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. PO/2026/08/4819"
                      value={formPoNumber}
                      onChange={e => setFormPoNumber(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PO Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 text-slate-400" size={15} />
                    <input
                      type="date"
                      value={formPoDate}
                      onChange={e => setFormPoDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="e.g. Chakan Plant, Pune"
                      value={formDeliveryLocation}
                      onChange={e => setFormDeliveryLocation(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-2.5 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="e.g. 30 Days Credit / 100% Advance"
                      value={formPaymentTerms}
                      onChange={e => setFormPaymentTerms(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Table (Negotiated PO Values) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers size={14} className="text-blue-600" />
                    PO Line Items &amp; Negotiated Prices ({formLineItems.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg hover:bg-blue-100">
                    <Plus size={13} /> Add Product
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {formLineItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          placeholder="Product Description / SKU (e.g. MS Plates E350)"
                          value={item.sku_text}
                          onChange={e => handleItemChange(idx, 'sku_text', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="grid grid-cols-4 gap-2">
                          <input
                            type="text"
                            placeholder="Dimensions (e.g. 12mm x 2500mm)"
                            value={item.dimensions}
                            onChange={e => handleItemChange(idx, 'dimensions', e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded-lg text-xs outline-none"
                          />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Qty (MT)"
                            value={item.quantity || ''}
                            onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded-lg text-xs outline-none font-semibold text-blue-700"
                          />
                          <input
                            type="number"
                            placeholder="Rate (₹/MT)"
                            value={item.rate || ''}
                            onChange={e => handleItemChange(idx, 'rate', e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded-lg text-xs outline-none font-semibold text-slate-800"
                          />
                          <div className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-700 flex items-center justify-end">
                            ₹{(Number(item.amount) || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                      {formLineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              {calculatedTotal > 0 && (
                <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-emerald-800 font-bold">Final Negotiated PO Deal Value:</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Will be booked under KRA 1 and tracked in Accounts / Payments
                    </p>
                  </div>
                  <p className="text-xl font-bold text-emerald-900">
                    ₹{calculatedTotal.toLocaleString('en-IN')}
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50">
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {submitting ? 'Confirming PO & Syncing...' : 'Confirm PO & Mark Deal Won 🎉'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Sales Quotation & Tax Invoice Modal */}
      {selectedQuotationOrder && (
        <SalesQuotationModal deal={selectedQuotationOrder} onClose={() => setSelectedQuotationOrder(null)} />
      )}
    </div>
  );
}
