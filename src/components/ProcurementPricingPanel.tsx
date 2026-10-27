import { LockKeyhole } from 'lucide-react';
import {
  getProcurementStatus,
  procurementMock,
  procurementStatusClasses,
  procurementStatusLabel,
} from '../lib/procurementMock';

interface ProcurementPricingPanelProps {
  onSendQuotation: (pricing: { sellRatePerMt: number; subtotal: number }) => void;
}

export default function ProcurementPricingPanel({ onSendQuotation }: ProcurementPricingPanelProps) {
  const request = procurementMock.list()[0];
  const status = getProcurementStatus(request);
  const pricedLines = request.line_items.filter((line) => line.line_status === 'priced' && Number(line.base_price_per_mt) > 0);
  const canSendQuotation = pricedLines.length === request.line_items.length;

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LockKeyhole size={18} className="text-blue-600" />
            <h3 className="text-sm font-black text-slate-900">Procurement update</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">Procurement controls base prices. Sales can review their update here.</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${procurementStatusClasses[status]}`}>
          {procurementStatusLabel[status]}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        <LockKeyhole size={14} className="text-slate-400" />
        Prototype request <span className="font-mono font-bold text-slate-800">{request.id}</span>
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-blue-100 bg-white p-3">
        {request.line_items.map((line) => (
          <div key={`${line.sku_text}-${line.dimensions}`} className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-800">{line.sku_text}</span>
            {line.line_status === 'cannot_price'
              ? <span className="font-bold text-rose-700">Can't price — {line.line_note}</span>
              : line.line_status === 'priced'
                ? <span className="font-bold text-blue-700">Base price ₹{line.base_price_per_mt?.toLocaleString('en-IN')} / MT</span>
                : <span className="font-bold text-amber-700">Needs pricing</span>}
          </div>
        ))}
      </div>
      {request.request_note && <p className="mt-3 text-xs text-slate-600"><strong>Procurement note:</strong> {request.request_note}</p>}
      <button type="button" disabled={!canSendQuotation} onClick={() => onSendQuotation({ sellRatePerMt: pricedLines[0]?.base_price_per_mt || 0, subtotal: 0 })} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Send quotation</button>
    </section>
  );
}
