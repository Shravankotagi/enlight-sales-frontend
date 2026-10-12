import { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, LockKeyhole, Send } from 'lucide-react';
import { formatIndianCurrency } from '../utils/pricingEngine';
import { calculateProcurementPricing } from '../utils/procurementPricing';
import { procurementMock } from '../lib/procurementMock';

interface ProcurementPricingPanelProps {
  onSendQuotation: (pricing: { sellRatePerMt: number; subtotal: number }) => void;
}

export default function ProcurementPricingPanel({ onSendQuotation }: ProcurementPricingPanelProps) {
  const request = procurementMock.list()[0];
  const [basePrice, setBasePrice] = useState(request.base_price_per_mt ? String(request.base_price_per_mt) : '');
  const [transport, setTransport] = useState('1800');
  const [margin, setMargin] = useState('6.2');
  const [sent, setSent] = useState(request.status === 'quotation_sent');

  const pricing = useMemo(() => calculateProcurementPricing({
    basePricePerMt: Number(basePrice),
    transportPerMt: Number(transport),
    marginPercent: Number(margin),
    quantity: request.quantity,
    unit: request.unit,
  }), [basePrice, transport, margin, request.quantity, request.unit]);

  const hasBasePrice = Number(basePrice) > 0;
  const sendQuotation = () => {
    if (!hasBasePrice) return;
    procurementMock.markQuotationSent(request.id);
    setSent(true);
    onSendQuotation({ sellRatePerMt: pricing.sellRatePerMt, subtotal: pricing.subtotal });
  };

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-blue-600" />
            <h3 className="text-sm font-black text-slate-900">Procurement pricing</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">Base price is provided by Procurement before you send a quotation.</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${hasBasePrice ? 'border-blue-200 bg-blue-100 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          {hasBasePrice ? 'Priced by procurement' : 'Awaiting procurement'}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        <LockKeyhole size={14} className="text-slate-400" />
        Prototype request <span className="font-mono font-bold text-slate-800">{request.id}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs font-bold text-slate-700">
          Base price (₹ / MT)
          <input
            aria-label="Base price per MT"
            type="number"
            min="0"
            value={basePrice}
            onChange={(event) => setBasePrice(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2 text-sm font-bold text-slate-600"
            readOnly={hasBasePrice}
          />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Transport (₹ / MT)
          <input
            aria-label="Transport per MT"
            type="number"
            min="0"
            value={transport}
            onChange={(event) => setTransport(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-bold text-slate-900"
          />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Margin (%)
          <input
            aria-label="Margin percentage"
            type="number"
            min="0"
            value={margin}
            onChange={(event) => setMargin(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-bold text-slate-900"
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-blue-100 bg-white p-3 sm:grid-cols-4">
        <div><p className="text-[10px] font-bold uppercase text-slate-400">Sell rate</p><p className="mt-1 text-sm font-black text-slate-900">₹{formatIndianCurrency(pricing.sellRatePerMt, false)} / MT</p></div>
        <div><p className="text-[10px] font-bold uppercase text-slate-400">Quantity</p><p className="mt-1 text-sm font-black text-slate-900">{pricing.quantityMt.toFixed(2)} MT</p></div>
        <div><p className="text-[10px] font-bold uppercase text-slate-400">Subtotal</p><p className="mt-1 text-sm font-black text-slate-900">₹{formatIndianCurrency(pricing.subtotal, false)}</p></div>
        <div><p className="text-[10px] font-bold uppercase text-slate-400">With GST</p><p className="mt-1 text-sm font-black text-emerald-700">{pricing.gst.formattedGrandTotal}</p></div>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" disabled={!hasBasePrice || sent} onClick={sendQuotation} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm ${sent ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300'}`}>
          {sent ? <><CheckCircle2 size={15} /> Quotation sent</> : <><Send size={15} /> Send quotation</>}
        </button>
      </div>
    </section>
  );
}
