import { useQuery } from '@tanstack/react-query';
import { customersApi } from '../lib/api';
import { useEffect, useState } from 'react';
import { Search, AlertTriangle, CheckCircle,
         Clock, ChevronRight } from 'lucide-react';


function HealthBadge({ risk }: { risk: string }) {
  const config = {
    high: { label: 'High Risk', class: 'bg-red-100 text-red-700', icon: <AlertTriangle size={12} /> },
    medium: { label: 'At Risk', class: 'bg-yellow-100 text-yellow-700', icon: <Clock size={12} /> },
    low: { label: 'Healthy', class: 'bg-green-100 text-green-700', icon: <CheckCircle size={12} /> },
  }[risk] || { label: risk, class: 'bg-gray-100 text-gray-600', icon: null };

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${config.class}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function BillingChart({ customer }: { customer: any }) {
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
    };
  }).reverse();

  const dealsByMonth = last6Months.map(month => ({
    ...month,
    deals: (customer.deals || []).filter((d: any) => d.created_at?.startsWith(month.key)),
    value: (customer.deals || [])
      .filter((d: any) => d.created_at?.startsWith(month.key))
      .reduce((sum: number, d: any) => sum + (d.total_amount || 0), 0),
  }));

  const maxValue = Math.max(...dealsByMonth.map(m => m.value), 1);

  return (
    <div className="bg-white rounded-xl border p-4 mb-4">
      <h3 className="font-semibold text-gray-800 mb-4 text-sm">Billing Activity - Last 6 Months</h3>
      <div className="space-y-3">
        {dealsByMonth.map(month => (
          <div key={month.key} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-12 flex-shrink-0">{month.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
              {month.value > 0 ? (
                <div
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full flex items-center pl-2 transition-all"
                  style={{ width: `${Math.max(6, (month.value / maxValue) * 100)}%` }}
                >
                  <span className="text-xs text-white font-medium truncate">
                    ₹{Number(month.value).toLocaleString('en-IN')}
                  </span>
                </div>
              ) : (
                <div className="h-full w-full flex items-center pl-3">
                  <span className="text-xs text-red-400 font-medium">No orders</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 w-24 flex-shrink-0 justify-end">
              {month.deals.length > 0 ? (
                <span className="text-xs text-gray-500">{month.deals.length} deal{month.deals.length > 1 ? 's' : ''}</span>
              ) : (
                <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-500 rounded font-medium">Gap</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.getOne(id).then(r => r.data.data),
  });

  useEffect(() => {
    document.title = 'Customers - Enlight Sales OS';
  }, []);

  if (isLoading) return (
    <div className="space-y-4">
      <div className="animate-pulse grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white border rounded-xl p-4">
            <div className="h-5 bg-gray-200 rounded w-32 mb-3" />
            <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );

  const customer = data;
  if (!customer) return null;

  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-5 text-sm font-medium">
        ← Back to customers
      </button>

      {/* Customer header */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
          {customer.customer_name?.charAt(0) || '?'}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{customer.customer_name}</h2>
          {customer.customer_gst && (
            <p className="text-xs text-gray-500">GST: {customer.customer_gst}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
            {customer.customer_phone && <span>{customer.customer_phone}</span>}
            <span className="text-gray-300">•</span>
            <span>Every {customer.avg_order_frequency_days || 30}d</span>
          </div>
        </div>
      </div>

      {/* Billing chart */}
      <BillingChart customer={customer} />

      <div className="grid grid-cols-3 gap-4">
        {/* Identity */}
        <div className="bg-white rounded-xl border p-4 col-span-1">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Customer Info</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Customer Name</p>
              <p className="font-medium">{customer.customer_name || '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Contact Person</p>
              <p className="font-medium">{customer.contact_person || '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Phone</p>
              <p className="font-medium">{customer.customer_phone || '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Last Order</p>
              <p className="font-medium">
                {customer.last_order_date ? new Date(customer.last_order_date).toLocaleDateString('en-IN') : '-'}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Order Frequency</p>
              <p className="font-medium">Every {customer.avg_order_frequency_days || 30} days</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Churn Risk</p>
              <HealthBadge risk={customer.churn_risk || 'low'} />
            </div>
          </div>
        </div>

        {/* Deals */}
        <div className="bg-white rounded-xl border p-4 col-span-2">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Recent Deals ({customer.deals?.length || 0})</h3>
          {customer.deals?.length > 0 ? (
            <div className="space-y-2">
              {customer.deals.slice(0, 5).map((deal: any) => (
                <div key={deal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {deal.inquiry_type === 'purchase_order' ? `PO: ${deal.po_number || 'N/A'}` : 'Inquiry'}
                    </p>
                    <p className="text-xs text-gray-500">{new Date(deal.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">
                      {deal.total_amount ? '₹' + Number(deal.total_amount).toLocaleString('en-IN') : '-'}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full
                      ${deal.stage === 'won' ? 'bg-green-100 text-green-700'
                        : deal.stage === 'lost' ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'}`}>
                      {deal.stage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No deals yet</p>
          )}
        </div>

        {/* Visits */}
        <div className="bg-white rounded-xl border p-4 col-span-1">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Visits ({customer.visits?.length || 0})</h3>
          {customer.visits?.length > 0 ? (
            <div className="space-y-2">
              {customer.visits.slice(0, 3).map((visit: any) => (
                <div key={visit.id} className="p-2 bg-gray-50 rounded">
                  <p className="text-xs font-medium text-gray-700">{visit.person_met || 'Visit logged'}</p>
                  <p className="text-xs text-gray-500">{visit.remarks}</p>
                  <p className="text-xs text-gray-400">{new Date(visit.visited_at).toLocaleDateString('en-IN')}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No visits logged</p>
          )}
        </div>

        {/* Complaints */}
        <div className="bg-white rounded-xl border p-4 col-span-2">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Complaints ({customer.complaints?.length || 0})</h3>
          {customer.complaints?.length > 0 ? (
            <div className="space-y-2">
              {customer.complaints.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.complaint_type}</p>
                    <p className="text-xs text-gray-500">{c.description}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No complaints</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Customers - Enlight Sales OS';
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['customers-churn'],
    queryFn: () => customersApi.getChurnRisk().then(r => r.data.data),
  });

  if (selectedId) {
    return <CustomerDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const customers = (data || []).filter((c: any) =>
    c.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 text-sm">{data?.length || 0} recurring customers</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Customer', 'Last Order', 'Days Since', 'Frequency', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b animate-pulse">
                  <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-32 mb-1" /><div className="h-3 bg-gray-200 rounded w-24" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                  <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded-full w-20" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-12" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Customer', 'Last Order', 'Days Since', 'Frequency', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer: any) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{customer.customer_name}</p>
                    <p className="text-xs text-gray-500">{customer.customer_phone}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {customer.last_order_date ? new Date(customer.last_order_date).toLocaleDateString('en-IN') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {customer.days_since_order != null ? `${customer.days_since_order}d ago` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">Every {customer.avg_order_frequency_days || 30}d</td>
                  <td className="px-4 py-3">
                    <HealthBadge risk={customer.churn_risk} />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedId(customer.id)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium">
                      View <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && (
            <div className="text-center py-12 text-gray-400">No customers found</div>
          )}
        </div>
      )}
    </div>
  );
}
