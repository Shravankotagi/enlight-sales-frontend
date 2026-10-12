import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  EyeOff,
  Package,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { quantityToMt } from '../utils/procurementPricing';
import { procurementMock, type ProcurementRequest, type ProcurementStatus } from '../lib/procurementMock';

const statusLabel: Record<ProcurementStatus, string> = {
  awaiting_price: 'Awaiting price',
  priced: 'Priced by procurement',
  quotation_sent: 'Quotation sent',
};

const statusClasses: Record<ProcurementStatus, string> = {
  awaiting_price: 'bg-amber-50 text-amber-700 border-amber-200',
  priced: 'bg-blue-50 text-blue-700 border-blue-200',
  quotation_sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

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
  const [basePrice, setBasePrice] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [note, setNote] = useState('');

  const refresh = () => setRequests(procurementMock.list());
  const openRequest = (request: ProcurementRequest) => {
    setSelected(request);
    setBasePrice(request.base_price_per_mt ? String(request.base_price_per_mt) : '');
    setValidUntil(request.valid_until || '');
    setNote(request.pricing_note || '');
  };

  const filteredRequests = useMemo(() => requests.filter((request) => {
    const searchMatch = `${request.id} ${request.material} ${request.grade}`.toLowerCase().includes(search.toLowerCase());
    return searchMatch && (status === 'all' || request.status === status);
  }), [requests, search, status]);

  const awaitingCount = requests.filter((request) => request.status === 'awaiting_price').length;
  const today = new Date().toISOString().slice(0, 10);
  const pricedToday = requests.filter((request) => request.status === 'priced' && request.requested_at.slice(0, 10) === today).length;
  const awaitingTonnage = requests
    .filter((request) => request.status === 'awaiting_price')
    .reduce((sum, request) => sum + quantityToMt(request.quantity, request.unit), 0);

  const savePrice = () => {
    if (!selected || Number(basePrice) <= 0) return;
    procurementMock.setBasePrice(selected.id, Number(basePrice), note, validUntil);
    refresh();
    setSelected(procurementMock.getOne(selected.id));
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Operations workspace</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Procurement</h1>
          <p className="mt-1 text-sm text-slate-500">Review material requests and provide base pricing to Sales.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          <ShieldCheck size={15} /> Customer details hidden for procurement
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Awaiting price', value: awaitingCount, icon: Clock3, tone: 'amber' },
          { label: 'Priced today', value: pricedToday, icon: CheckCircle2, tone: 'blue' },
          { label: 'Tonnage awaiting', value: `${awaitingTonnage.toFixed(2)} MT`, icon: Package, tone: 'emerald' },
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
              placeholder="Search request ID, material or grade"
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
            <option value="awaiting_price">Awaiting price</option>
            <option value="priced">Priced by procurement</option>
            <option value="quotation_sent">Quotation sent</option>
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-5 py-3">Request</th>
                <th className="px-5 py-3">Material</th>
                <th className="px-5 py-3">Quantity</th>
                <th className="px-5 py-3">Delivery region</th>
                <th className="px-5 py-3">Requested</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((request) => (
                <tr key={request.id} className="transition-colors hover:bg-blue-50/40">
                  <td className="px-5 py-4 font-mono font-bold text-slate-800">{request.id}</td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-900">{request.material}</p>
                    <p className="text-xs text-slate-500">{request.grade} · {request.dimensions}</p>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-700">
                    {request.quantity.toLocaleString('en-IN')} {request.unit}
                    <span className="block text-xs font-normal text-slate-400">{quantityToMt(request.quantity, request.unit).toFixed(2)} MT</span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{request.delivery_region}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(request.requested_at)}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses[request.status]}`}>
                      {statusLabel[request.status]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button type="button" onClick={() => openRequest(request)} className="text-blue-600 hover:text-blue-800">
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-3 md:hidden">
          {filteredRequests.map((request) => (
            <button key={request.id} type="button" onClick={() => openRequest(request)} className="w-full rounded-xl border border-slate-200 p-4 text-left">
              <div className="flex items-start justify-between">
                <span className="font-mono text-sm font-bold text-slate-800">{request.id}</span>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${statusClasses[request.status]}`}>{statusLabel[request.status]}</span>
              </div>
              <p className="mt-2 font-bold text-slate-900">{request.material}</p>
              <p className="mt-1 text-xs text-slate-500">{request.grade} · {quantityToMt(request.quantity, request.unit).toFixed(2)} MT · {request.delivery_region}</p>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-xs font-bold text-blue-600">{selected.id}</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">{selected.material}</h2>
                <p className="mt-1 text-sm text-slate-500">{selected.grade} · {selected.dimensions}</p>
              </div>
              <button type="button" aria-label="Close request details" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              <EyeOff size={16} /> Customer identity is intentionally not available in this workspace.
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Quantity</p><p className="mt-1 font-bold">{selected.quantity.toLocaleString('en-IN')} {selected.unit}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Tonnage</p><p className="mt-1 font-bold">{quantityToMt(selected.quantity, selected.unit).toFixed(2)} MT</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Delivery region</p><p className="mt-1 font-bold">{selected.delivery_region}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Requested</p><p className="mt-1 font-bold">{formatDate(selected.requested_at)}</p></div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="base-price" className="text-sm font-bold text-slate-800">Base price (₹ / MT)</label>
                <input id="base-price" type="number" min="0" value={basePrice} onChange={(event) => setBasePrice(event.target.value)} placeholder="Enter procurement base price" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label htmlFor="valid-until" className="text-sm font-bold text-slate-800">Price valid until <span className="font-normal text-slate-400">(optional)</span></label>
                <input id="valid-until" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label htmlFor="pricing-note" className="text-sm font-bold text-slate-800">Internal note <span className="font-normal text-slate-400">(optional)</span></label>
                <textarea id="pricing-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Add a note for Sales" className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <button type="button" disabled={Number(basePrice) <= 0} onClick={savePrice} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                Save base price <ArrowRight size={16} />
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
