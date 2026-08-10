import { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Search, CheckCircle, PackageCheck, Truck, RefreshCw, X, FileText, Building2, Printer, Eye, Copy, Check } from 'lucide-react';
import { ordersApi } from '../lib/api';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';

interface DealItem {
  id?: string;
  sku_text?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  amount?: number;
}

interface Order {
  id: string;
  customer_name: string;
  po_number?: string;
  po_date?: string;
  total_amount?: number;
  delivery_location?: string;
  delivery_date?: string;
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
  const [copiedPo, setCopiedPo] = useState(false);

  const now = new Date();
  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    to: now.toISOString().split('T')[0]
  });

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formPoNumber, setFormPoNumber] = useState('');
  const [formPoDate, setFormPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [formProductSKU, setFormProductSKU] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formDeliveryLocation, setFormDeliveryLocation] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await ordersApi.getAll();
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
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

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) return;

    const qty = Number(formQuantity) || 0;
    const rate = Number(formRate) || 0;
    const itemAmount = qty > 0 && rate > 0 ? qty * rate : 0;

    try {
      setSubmitting(true);
      await ordersApi.create({
        customer_name: formCustomerName,
        po_number: formPoNumber.trim() || undefined,
        po_date: formPoDate,
        total_amount: itemAmount > 0 ? itemAmount : 0,
        delivery_location: formDeliveryLocation,
        items: formProductSKU ? [{
          sku_text: formProductSKU,
          quantity: qty,
          unit: 'MT',
          rate: rate,
          amount: itemAmount
        }] : []
      });

      setShowModal(false);
      // Reset form
      setFormCustomerName('');
      setFormPoNumber('');
      setFormPoDate(new Date().toISOString().split('T')[0]);
      setFormProductSKU('');
      setFormQuantity('');
      setFormRate('');
      setFormDeliveryLocation('');

      fetchOrders();
    } catch (err) {
      console.error('Error creating order:', err);
      alert('Failed to log order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const safeOrders = Array.isArray(orders) ? orders : [];

  // Filter orders by date range & search
  const filtered = safeOrders.filter(o => {
    // Date filter
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
                    .join(', ') || 'Steel Products';

                  return (
                    <tr
                      key={ord.id || idx}
                      onClick={() => setSelectedQuotationOrder(ord)}
                      className="hover:bg-blue-50/70 transition-colors cursor-pointer group"
                      title="Click to view full Official Sales Quotation & Invoice"
                    >
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedQuotationOrder(ord);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all group-hover:shadow-sm hover:scale-105"
                        >
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

      {/* Log Order Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
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

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supreme Steel"
                  value={formCustomerName}
                  onChange={e => setFormCustomerName(e.target.value)}
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
                    step="0.01"
                    placeholder="e.g. 30"
                    value={formQuantity}
                    onChange={e => setFormQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rate per MT (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 58000"
                    value={formRate}
                    onChange={e => setFormRate(e.target.value)}
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

              {Number(formQuantity) > 0 && Number(formRate) > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">Estimated Total Deal Value:</p>
                  <p className="text-lg font-bold text-blue-900">
                    ₹{(Number(formQuantity) * Number(formRate)).toLocaleString('en-IN')}
                  </p>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Controls Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between no-print">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow-sm">
                  EM
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    Official Sales Quotation &amp; Order Invoice
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    PO Reference: {selectedQuotationOrder.po_number || 'PO-AUTO-GENERATED'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const po = selectedQuotationOrder.po_number || 'PO-AUTO';
                    navigator.clipboard.writeText(po);
                    setCopiedPo(true);
                    setTimeout(() => setCopiedPo(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  {copiedPo ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copiedPo ? 'PO Copied!' : 'Copy PO'}
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Print Quotation or Save as PDF"
                >
                  <Printer size={14} /> Print / Save PDF
                </button>

                <button
                  onClick={() => setSelectedQuotationOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Document Content */}
            <div className="p-8 space-y-6 printable-area bg-white text-slate-900">
              
              {/* Document Letterhead */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b-2 border-slate-900 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-900 text-white font-black text-xl px-2.5 py-1 rounded">ENLIGHT</span>
                    <span className="text-2xl font-bold tracking-tight text-slate-900">METALS</span>
                  </div>
                  <p className="text-xs font-bold text-blue-700 tracking-wider uppercase mt-1">
                    Enlight Metals Private Limited • Industrial Steel Solutions
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    MIDC Industrial Zone, Mumbai - 400001 • GSTIN: 27AAACE1234F1Z9
                  </p>
                </div>

                <div className="sm:text-right">
                  <span className="inline-block bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full border border-emerald-300">
                    ✓ CONFIRMED ORDER &amp; QUOTATION
                  </span>
                  <p className="text-xs text-slate-600 mt-2 font-mono">
                    <strong>PO Number:</strong> {selectedQuotationOrder.po_number || 'PO-2026-AUTO'}
                  </p>
                  <p className="text-xs text-slate-500">
                    <strong>Order Date:</strong> {selectedQuotationOrder.po_date || (selectedQuotationOrder.created_at ? new Date(selectedQuotationOrder.created_at).toLocaleDateString('en-IN') : '-')}
                  </p>
                </div>
              </div>

              {/* Billed To & Delivery Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Building2 size={13} /> Billed To / Customer Account
                  </p>
                  <h4 className="text-base font-bold text-slate-900">{selectedQuotationOrder.customer_name}</h4>
                  <p className="text-xs text-slate-600 mt-1">Industrial Purchase &amp; Contracting Account</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Deal Ref ID: #{selectedQuotationOrder.id?.slice(0, 8).toUpperCase() || 'DEAL-WON'}
                  </p>
                </div>

                <div className="sm:text-right">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1 sm:justify-end">
                    <Truck size={13} /> Ship To / Delivery Destination
                  </p>
                  <h4 className="text-sm font-bold text-slate-800">
                    {selectedQuotationOrder.delivery_location || 'Customer Site / MIDC Warehouse'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">Dispatch Mode: Commercial Freight Heavy Transport</p>
                  <p className="text-xs text-emerald-700 font-semibold mt-0.5">Status: Ready for Loading &amp; Dispatch</p>
                </div>
              </div>

              {/* Quotation Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900 text-white text-xs font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-3 text-center w-12">#</th>
                      <th className="px-4 py-3">Material / Product Description</th>
                      <th className="px-4 py-3 text-right">Quantity (MT)</th>
                      <th className="px-4 py-3 text-right">Unit Rate (₹/MT)</th>
                      <th className="px-4 py-3 text-right">Total Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedQuotationOrder.deal_items && selectedQuotationOrder.deal_items.length > 0 ? (
                      selectedQuotationOrder.deal_items.map((item, i) => {
                        const qty = Number(item.quantity || 0);
                        const amt = Number(item.amount || (qty * Number(item.rate || 0)) || selectedQuotationOrder.total_amount || 0);
                        const rate = item.rate || (qty > 0 ? Math.round(amt / qty) : 0);

                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-center text-slate-500 font-medium">{i + 1}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{item.sku_text || 'Steel Products'}</td>
                            <td className="px-4 py-3 text-right font-mono font-medium">{qty ? `${qty} MT` : '-'}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600">{rate ? `₹${rate.toLocaleString('en-IN')}` : '-'}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">₹{amt.toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-center text-slate-500 font-medium">1</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">Industrial Steel Supply Order Requirement</td>
                        <td className="px-4 py-3 text-right font-mono font-medium">Bulk Order</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">Standard Rate</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          ₹{Number(selectedQuotationOrder.total_amount || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Box & Terms */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-2">
                <div className="text-xs text-slate-500 max-w-sm space-y-1">
                  <p className="font-semibold text-slate-700">Commercial Terms &amp; Notes:</p>
                  <p>1. Material meets IS 2062 / IS 1786 prime steel standards.</p>
                  <p>2. Payment terms: 100% as per agreed commercial contract.</p>
                  <p>3. Official computer-generated quotation from Enlight Metals OS.</p>
                </div>

                <div className="w-full sm:w-80 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Subtotal (Base Value):</span>
                    <span className="font-mono font-medium">
                      ₹{Math.round(Number(selectedQuotationOrder.total_amount || 0) / 1.18).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-slate-600">
                    <span>GST (18% Estimated):</span>
                    <span className="font-mono font-medium">
                      ₹{(Number(selectedQuotationOrder.total_amount || 0) - Math.round(Number(selectedQuotationOrder.total_amount || 0) / 1.18)).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-300 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-900">Total Order Value:</span>
                    <span className="text-lg font-bold text-emerald-600 font-mono">
                      ₹{Number(selectedQuotationOrder.total_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signature Footer */}
              <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
                <div>
                  <p className="font-semibold text-slate-800">Enlight Metals Sales Ops Team</p>
                  <p>System Generated Official Quotation &amp; Invoice</p>
                </div>

                <div className="text-right">
                  <div className="h-10 border-b border-dashed border-slate-300 w-36 mb-1"></div>
                  <p className="font-bold text-slate-800">Authorized Signatory</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
