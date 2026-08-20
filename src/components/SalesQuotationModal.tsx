import { useState } from 'react';
import { X, Printer, Copy, Check } from 'lucide-react';

interface DealItem {
  id?: string;
  sku_text?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  quoted_price?: number;
  price_per_mt?: number;
  amount?: number;
}

interface QuotationDeal {
  id?: string;
  customer_name?: string;
  po_number?: string;
  po_date?: string;
  total_amount?: number;
  delivery_location?: string;
  payment_terms?: string;
  created_at?: string;
  deal_items?: DealItem[];
  deal_number?: string;
}

interface SalesQuotationModalProps {
  deal: QuotationDeal | null;
  onClose: () => void;
}

import { calculatePricingSummary } from '../utils/pricingEngine';

export default function SalesQuotationModal({ deal, onClose }: SalesQuotationModalProps) {
  const [copiedPo, setCopiedPo] = useState(false);

  if (!deal) return null;

  const pricing = calculatePricingSummary({
    lineItems: deal.deal_items || [],
    basic_amount: deal.total_amount ? Number(deal.total_amount) : 0,
  });

  const subtotal = pricing.subtotal;
  const gstAmount = pricing.gstAmount;
  const grandTotal = pricing.grandTotal;

  const dealRefId = deal.id ? `#${deal.id.substring(0, 8).toUpperCase()}` : '#ENLIGHT-DEAL';
  const poNumber = deal.po_number || `PO-${new Date().getFullYear()}-AUTO`;
  const orderDate = deal.po_date || (deal.created_at ? new Date(deal.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);

  const handleCopyPo = () => {
    navigator.clipboard.writeText(poNumber);
    setCopiedPo(true);
    setTimeout(() => setCopiedPo(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] overflow-y-auto animate-in fade-in duration-200">
      
      {/* Print CSS to hide everything except the printable quotation area */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-quotation-modal, #printable-quotation-modal * {
            visibility: visible !important;
          }
          #printable-quotation-modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-200 my-8">
        
        {/* Modal Top Header Bar */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              EM
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Official Sales Quotation &amp; Order Invoice</h3>
              <p className="text-xs text-slate-400">PO Reference: {poNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPo}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              {copiedPo ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copiedPo ? 'Copied!' : 'Copy PO'}
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer size={14} /> Print / Save PDF
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Quotation Sheet Body */}
        <div id="printable-quotation-modal" className="p-6 sm:p-8 space-y-6 bg-white">
          
          {/* Company Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-slate-900 text-white font-black text-xl px-3 py-1 rounded-lg">ENLIGHT</span>
                <span className="text-xl font-bold tracking-wider text-slate-800">METALS</span>
              </div>
              <p className="text-xs font-bold text-blue-700 mt-1">ENLIGHT METALS PRIVATE LIMITED • INDUSTRIAL METAL SOLUTIONS</p>
              <p className="text-xs text-slate-500">MIDC Industrial Zone, Mumbai - 400001 • GSTIN: 27AAACE1234F1Z9</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200 mb-1">
                ✓ CONFIRMED ORDER &amp; QUOTATION
              </span>
              <p className="text-xs text-slate-500 font-medium">PO Number: <span className="font-bold text-slate-800">{poNumber}</span></p>
              <p className="text-xs text-slate-500">Order Date: <span className="font-semibold text-slate-700">{orderDate}</span></p>
            </div>
          </div>

          {/* Customer & Shipping Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Billed To / Customer Account</p>
              <h4 className="font-bold text-slate-900 text-base mt-0.5">{deal.customer_name || 'Industrial Customer Account'}</h4>
              <p className="text-slate-500">Industrial Purchase &amp; Contracting Account</p>
              <p className="text-slate-400 mt-1">Deal Ref ID: <span className="font-mono font-bold text-slate-700">{dealRefId}</span></p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Ship To / Delivery Destination</p>
              <h4 className="font-bold text-slate-900 text-sm mt-0.5">{deal.delivery_location || 'Customer Site / MIDC Warehouse'}</h4>
              <p className="text-slate-500 mt-1">Dispatch Mode: Commercial Freight Heavy Transport</p>
              <p className="text-emerald-700 font-semibold mt-0.5">Status: Ready for Loading &amp; Dispatch</p>
            </div>
          </div>

          {/* Quotation Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-white text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3 text-center w-12">#</th>
                  <th className="px-4 py-3">Material / Product Description</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Total Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {deal.deal_items && deal.deal_items.length > 0 ? (
                  deal.deal_items.map((item, i) => {
                    const qty = Number(item.quantity || 0);
                    const rate = Number(item.rate || item.quoted_price || item.price_per_mt || 0);
                    const amt = Number(item.amount || (qty * rate) || subtotal || 0);

                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-center text-slate-500 font-medium">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.sku_text || '—'}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium">{qty ? `${qty} ${item.unit || 'MT'}` : '-'}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">₹{amt.toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-center text-slate-500 font-medium">1</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">Industrial Metal Supply Order Requirement</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">Bulk Order</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      ₹{Number(subtotal).toLocaleString('en-IN')}
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
              <p>1. Material meets IS 2062 / IS 1786 prime metal standards.</p>
              <p>2. Payment terms: {deal.payment_terms || '100% as per agreed commercial contract'}.</p>
              <p>3. Official computer-generated quotation from Enlight Metals OS.</p>
            </div>

            <div className="w-full sm:w-80 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal (Base Value):</span>
                <span className="font-mono font-medium">
                  ₹{subtotal.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between text-xs text-slate-600">
                <span>GST (18% Forward):</span>
                <span className="font-mono font-medium">
                  + ₹{gstAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-300 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900">Total Order Value:</span>
                <span className="text-lg font-bold text-emerald-600 font-mono">
                  ₹{grandTotal.toLocaleString('en-IN')}
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
  );
}
