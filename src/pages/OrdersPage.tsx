import { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Search, CheckCircle, PackageCheck, Truck, RefreshCw, X, FileText, Building2 } from 'lucide-react';
import { ordersApi } from '../lib/api';

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
      setOrders(res.data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
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

  // Filter orders
  const filtered = orders.filter(o => {
    const itemsStr = (o.deal_items || []).map(i => i.sku_text).join(' ');
    return (
      o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.delivery_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      itemsStr.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalTonnage = orders.reduce((sum, o) => {
    const itemsQty = (o.deal_items || []).reduce((iSum, i) => iSum + Number(i.quantity || 0), 0);
    return sum + itemsQty;
  }, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="text-blue-600" size={28} />
            Completed & Delivered Orders (KRA 1 & KRA 4)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Track confirmed sales orders, PO numbers, tonnage, and delivery dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Loading orders data...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filtered.map((ord, idx) => {
                  const itemsStr = (ord.deal_items || [])
                    .map(i => `${i.quantity ? `${i.quantity} ${i.unit || 'MT'}` : ''} ${i.sku_text || 'Material'}`)
                    .filter(Boolean)
                    .join(', ') || 'Steel Products';

                  return (
                    <tr key={ord.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {ord.po_date || (ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-IN') : '-')}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-blue-700 font-semibold">
                        <span className="inline-flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          <FileText size={12} /> {ord.po_number || 'PO-2026-AUTO'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        <span className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-slate-400" />
                          {ord.customer_name}
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
    </div>
  );
}
