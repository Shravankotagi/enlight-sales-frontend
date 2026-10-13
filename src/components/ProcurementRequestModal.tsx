import { useMemo, useState } from 'react';
import { AlertTriangle, Check, FileText, EyeOff, User, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { detectHsnCode } from '../utils/hsnDetector';
import { quantityToMt } from '../utils/procurementPricing';
import {
  getProcurementStatus,
  procurementMock,
  procurementStatusClasses,
  procurementStatusLabel,
  type ProcurementLineItem,
  type ProcurementRequest,
} from '../lib/procurementMock';

interface Props {
  request: ProcurementRequest;
  onClose: () => void;
  onSaved: () => void;
  readOnly?: boolean;
}

export default function ProcurementRequestModal({ request, onClose, onSaved, readOnly = false }: Props) {
  const [lines, setLines] = useState<ProcurementLineItem[]>(request.line_items);
  const [requestNote, setRequestNote] = useState(request.request_note || '');
  const status = getProcurementStatus({ ...request, line_items: lines });
  const totalMt = useMemo(
    () => lines.reduce((sum, item) => sum + quantityToMt(item.quantity, item.unit), 0),
    [lines],
  );
  const blankPriceCount = lines.filter((item) => Number(item.base_price_per_mt) <= 0).length;
  const canSave = lines.length > 0;

  const updateLine = (index: number, patch: Partial<ProcurementLineItem>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  };

  const save = () => {
    if (!canSave || readOnly) return;
    const resolvedLines = lines.map((line) => ({
      ...line,
      base_price_per_mt: Number(line.base_price_per_mt) > 0 ? Number(line.base_price_per_mt) : undefined,
      line_status: Number(line.base_price_per_mt) > 0 ? 'priced' as const : 'cannot_price' as const,
    }));
    procurementMock.saveLinePricing(request.id, resolvedLines, requestNote);
    toast.success('Procurement update saved for Sales');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-xs animate-in fade-in duration-150" onClick={onClose}>
      <div className="my-auto flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-blue-600"><FileText size={22} /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Procurement Request</h2>
              <p className="mt-0.5 font-mono text-xs text-slate-500">ID: {request.id}</p>
            </div>
          </div>
          <button type="button" aria-label="Close procurement request" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-300 bg-white px-3 py-2">
              <p className="text-[11px] font-bold text-slate-500">Salesperson</p>
              <p className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-900"><User size={14} className="text-blue-600" />{request.salesperson_name}</p>
            </div>
            <div><p className="text-[11px] font-bold text-slate-500">Delivery region</p><p className="mt-1 text-xs font-bold text-slate-900">{request.delivery_region}</p></div>
            <div><p className="text-[11px] font-bold text-slate-500">Requested</p><p className="mt-1 text-xs font-bold text-slate-900">{new Date(request.requested_at).toLocaleDateString('en-IN')}</p></div>
            <div><p className="text-[11px] font-bold text-slate-500">Status</p><span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${procurementStatusClasses[status]}`}>{procurementStatusLabel[status]}</span></div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800"><EyeOff size={16} /> Customer identity is intentionally hidden from Procurement.</div>

          <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-xs">
            <table className="min-w-[1100px] w-full border-collapse text-left text-xs text-slate-800">
              <thead className="bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-white">
                <tr>
                  <th className="w-[4%] border-r border-slate-700 px-3 py-3 text-center">#</th>
                  <th className="w-[25%] border-r border-slate-700 px-4 py-3">Description &amp; Specifications</th>
                  <th className="w-[11%] border-r border-slate-700 px-3 py-3 text-center">HSN/SAC</th>
                  <th className="w-[15%] border-r border-slate-700 px-3 py-3 text-center">Quantity, Unit &amp; Wt (MT)</th>
                  <th className="w-[14%] border-r border-slate-700 px-3 py-3 text-center">Base Price (₹/MT)</th>
                  <th className="w-[17%] px-3 py-3">Line Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {lines.map((line, index) => {
                  return (
                    <tr key={`${line.sku_text}-${index}`} className="hover:bg-blue-50/30">
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center font-mono text-slate-400">{index + 1}</td>
                      <td className="border-r border-slate-200 px-4 py-3.5"><p className="font-bold text-slate-900">{line.sku_text}</p><p className="mt-0.5 font-mono text-[11px] text-slate-500">{line.grade}{line.grade && line.dimensions ? ' · ' : ''}{line.dimensions}</p></td>
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center font-mono">{detectHsnCode(line.sku_text, line.dimensions) || '-'}</td>
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center"><p className="font-bold">{line.quantity.toLocaleString('en-IN')} {line.unit}</p><p className="mt-0.5 text-[11px] text-slate-500">{quantityToMt(line.quantity, line.unit).toFixed(2)} MT</p></td>
                      <td className="border-r border-slate-200 px-3 py-3.5"><input aria-label={`Base price for ${line.sku_text}`} disabled={readOnly} type="number" min="0" value={line.base_price_per_mt || ''} onChange={(event) => updateLine(index, { base_price_per_mt: Number(event.target.value) || undefined, line_status: Number(event.target.value) > 0 ? 'priced' : 'needs_price' })} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center font-bold outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400" placeholder="Enter price" /></td>
                      <td className="px-3 py-3.5"><input aria-label={`Note for ${line.sku_text}`} disabled={readOnly} value={line.line_note || ''} onChange={(event) => updateLine(index, { line_note: event.target.value })} placeholder="Optional note for Sales" className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-bold text-slate-500">Items</p><p className="mt-1 font-bold text-slate-900">{lines.length} items</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-bold text-slate-500">Total weight</p><p className="mt-1 font-bold text-slate-900">{totalMt.toFixed(2)} MT</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-bold text-slate-500">Will be unavailable</p><p className="mt-1 font-bold text-slate-900">{blankPriceCount} item{blankPriceCount === 1 ? '' : 's'}</p></div>
          </div>
          <div><label htmlFor="procurement-request-note" className="text-xs font-bold text-slate-700">Procurement update for Sales <span className="font-normal text-slate-400">(optional)</span></label><textarea id="procurement-request-note" disabled={readOnly} value={requestNote} onChange={(event) => setRequestNote(event.target.value)} rows={3} placeholder="Add context for the salesperson" className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100" /></div>
          {!readOnly && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900"><AlertTriangle size={15} /> On save, any product without a base price is marked unavailable for Sales. Notes are optional.</div>}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3.5">
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">Cancel</button>
          {!readOnly && <button type="button" disabled={!canSave} onClick={save} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Check size={15} />Save Pricing</button>}
        </div>
      </div>
    </div>
  );
}
