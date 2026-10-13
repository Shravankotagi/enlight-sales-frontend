import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, Clock3, Package, Search, ShieldCheck, UserCheck } from 'lucide-react';
import { quantityToMt } from '../utils/procurementPricing';
import {
  getProcurementStatus,
  procurementMock,
  procurementStatusClasses,
  procurementStatusLabel,
  type ProcurementRequest,
  type ProcurementStatus,
} from '../lib/procurementMock';
import ProcurementRequestModal from '../components/ProcurementRequestModal';

const metricClasses: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export default function ProcurementPage() {
  const [requests, setRequests] = useState(() => procurementMock.list());
  const [selected, setSelected] = useState<ProcurementRequest | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | ProcurementStatus>('all');

  const refresh = () => setRequests(procurementMock.list());

  const filteredRequests = useMemo(() => requests.filter((request) => {
    const searchMatch = `${request.id} ${request.salesperson_name} ${request.line_items.map((item) => `${item.sku_text} ${item.grade}`).join(' ')}`.toLowerCase().includes(search.toLowerCase());
    return searchMatch && (status === 'all' || getProcurementStatus(request) === status);
  }), [requests, search, status]);

  const awaitingCount = requests.filter((request) => getProcurementStatus(request) === 'needs_pricing').length;
  const today = new Date().toISOString().slice(0, 10);
  const pricedToday = requests.filter((request) => getProcurementStatus(request) === 'price_added' && request.requested_at.slice(0, 10) === today).length;
  const awaitingTonnage = requests
    .filter((request) => request.line_items.some((item) => item.line_status === 'needs_price'))
    .reduce((sum, request) => sum + request.line_items.filter((item) => item.line_status === 'needs_price').reduce((lineSum, item) => lineSum + quantityToMt(item.quantity, item.unit), 0), 0);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Operations workspace</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Procurement</h1>
          <p className="mt-1 text-sm text-slate-500">Review material requests and provide per-product base pricing to Sales.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          <ShieldCheck size={15} /> Customer details hidden for procurement
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Needs pricing', value: awaitingCount, icon: Clock3, tone: 'amber' },
          { label: 'Price added today', value: pricedToday, icon: CheckCircle2, tone: 'blue' },
          { label: 'Tonnage needing price', value: `${awaitingTonnage.toFixed(2)} MT`, icon: Package, tone: 'emerald' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${metricClasses[tone]}`}>
              <Icon size={19} />
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              aria-label="Search procurement requests"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search request ID, salesperson, material or grade"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <select
            aria-label="Filter procurement requests by status"
            value={status}
            onChange={(event) => setStatus(event.target.value as 'all' | ProcurementStatus)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <option value="all">All statuses</option>
            {Object.entries(procurementStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-3 py-3 text-center">#</th>
                <th className="px-5 py-3">Request</th>
                <th className="px-5 py-3">Items Summary</th>
                <th className="px-5 py-3">Delivery region</th>
                <th className="whitespace-nowrap px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((request, index) => {
                const requestStatus = getProcurementStatus(request);
                const totalMt = request.line_items.reduce((sum, item) => sum + quantityToMt(item.quantity, item.unit), 0);
                return <tr key={request.id} onClick={() => setSelected(request)} className="cursor-pointer transition-colors hover:bg-slate-50/75">
                  <td className="px-3 py-4 text-center font-medium text-slate-500">{index + 1}</td>
                  <td className="px-5 py-4">
                    <p className="font-mono font-bold text-slate-900">{request.id}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDate(request.requested_at)}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-slate-500"><UserCheck size={12} className="text-slate-400" /> Rep: {request.salesperson_name}</p>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-700">
                    {request.line_items.length} {request.line_items.length === 1 ? 'Item' : 'Items'}
                    <span className="block text-xs font-normal text-slate-400">({totalMt.toFixed(2)} MT)</span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{request.delivery_region}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${procurementStatusClasses[requestStatus]}`}>
                      {procurementStatusLabel[requestStatus]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button type="button" aria-label={`Open ${request.id}`} onClick={(event) => { event.stopPropagation(); setSelected(request); }} className="text-blue-600 hover:text-blue-800">
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-3 md:hidden">
          {filteredRequests.map((request) => {
            const requestStatus = getProcurementStatus(request);
            const totalMt = request.line_items.reduce((sum, item) => sum + quantityToMt(item.quantity, item.unit), 0);
            return <button key={request.id} type="button" onClick={() => setSelected(request)} className="w-full rounded-xl border border-slate-200 p-4 text-left">
              <div className="flex items-start justify-between">
                <span className="font-mono text-sm font-bold text-slate-800">{request.id}</span>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${procurementStatusClasses[requestStatus]}`}>{procurementStatusLabel[requestStatus]}</span>
              </div>
              <p className="mt-2 font-bold text-slate-900">{request.line_items.length} items ({totalMt.toFixed(2)} MT)</p>
              <p className="mt-1 text-xs text-slate-500">Rep: {request.salesperson_name} · {request.delivery_region}</p>
            </button>;
          })}
        </div>
      </div>

      {selected && <ProcurementRequestModal request={selected} onClose={() => setSelected(null)} onSaved={() => { refresh(); setSelected(procurementMock.getOne(selected.id)); }} />}
    </div>
  );
}
