import { useState } from 'react';
import { X, Download, Check, Copy } from 'lucide-react';
import { calculateQuotationBreakdown, formatIndianCurrency } from '../utils/pricingEngine';

interface InquiryItem {
  id: string;
  sender_name?: string;
  customer_name?: string;
  customer_phone?: string;
  sender_phone?: string;
  raw_text?: string;
  inquiry_type?: string;
  status?: string;
  source_channel?: string;
  media_urls?: string[];
  overall_confidence?: number;
  created_at: string;
}

interface LineItemDetail {
  sku_text: string;
  dimensions?: string;
  hsn_code?: string;
  quantity: number;
  unit?: string;
  rate: number;
  amount: number;
}

interface ExtractedDetails {
  companyName: string;
  customerPhone: string;
  productType: string;
  thickness: string;
  width: string;
  length: string;
  productForm: 'Coil' | 'Sheet' | 'Plate' | 'Bar';
  quantityTons: number;
  quantityUnits: number;
  unitPrice: number;
  totalAmount: number;
  paymentTerms: string;
  deliveryLocation: string;
  lineItems: LineItemDetail[];
}

interface InquiryPdfModalProps {
  inquiry: InquiryItem | null;
  details: ExtractedDetails | null;
  onClose: () => void;
}

export default function InquiryPdfModal({ inquiry, details, onClose }: InquiryPdfModalProps) {
  const [copiedRef, setCopiedRef] = useState(false);
  const [logoError, setLogoError] = useState(false);

  if (!inquiry || !details) return null;

  // Build line items list — prefer dynamic lineItems, fall back to single item
  const lineItems: LineItemDetail[] =
    details.lineItems && details.lineItems.length > 0
      ? details.lineItems
      : [
          {
            sku_text: details.productType || 'Material',
            dimensions: [details.thickness, details.width ? `x ${details.width}` : '', details.length ? `x ${details.length}` : '']
              .filter(Boolean)
              .join(' ')
              .trim() || undefined,
            quantity: details.quantityTons,
            unit: 'MT',
            rate: details.unitPrice,
            amount: details.totalAmount,
          },
        ];

  // totalAmount = base pre-GST value; calculate GST breakdown
  const computedSubtotal = lineItems.reduce((s, i) => s + (Number(i.amount) || 0), 0) || details.totalAmount || 0;
  const breakdown = calculateQuotationBreakdown(computedSubtotal);

  const totalQuantity = lineItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const firstUnit = lineItems[0]?.unit || 'MT';
  const isSingleUnit = lineItems.every(i => (i.unit || 'MT').toUpperCase() === firstUnit.toUpperCase());

  const inquiryRefId = inquiry.id ? `#INQ-${inquiry.id.substring(0, 8).toUpperCase()}` : '#ENLIGHT-INQ';
  const createdDate = inquiry.created_at
    ? new Date(inquiry.created_at).toLocaleDateString('en-IN')
    : new Date().toLocaleDateString('en-IN');

  const handleCopyRef = () => {
    navigator.clipboard.writeText(inquiryRefId);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handlePrintDownload = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      
      {/* Print CSS to ensure only the document sheet prints */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-inquiry-pdf, #printable-inquiry-pdf * {
            visibility: visible !important;
          }
          #printable-inquiry-pdf {
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
        
        {/* Top Actions Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              PDF
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Inquiry Sales Quotation Document</h3>
              <p className="text-xs text-slate-400">Ref: {inquiryRefId} • {details.companyName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyRef}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors">
              {copiedRef ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copiedRef ? 'Copied!' : 'Copy Ref'}
            </button>

            <button
              type="button"
              onClick={handlePrintDownload}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors">
              <Download size={14} /> Download / Print PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable PDF Document Body */}
        <div id="printable-inquiry-pdf" className="p-6 sm:p-8 space-y-6 bg-white font-sans text-slate-800">
          
          {/* Company Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-5">
            <div>
              {!logoError ? (
                <img
                  src="/logo.png"
                  alt="Enlight Metals"
                  onError={() => setLogoError(true)}
                  className="h-10 w-auto object-contain max-w-[220px]"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="bg-slate-900 text-white font-black text-xl px-3 py-1 rounded-lg">ENLIGHT</span>
                  <span className="text-xl font-bold tracking-wider text-slate-800">METALS</span>
                </div>
              )}
              <p className="text-xs font-bold text-indigo-700 mt-1">ENLIGHT METALS PRIVATE LIMITED • INDUSTRIAL METAL SOLUTIONS</p>
              <p className="text-xs text-slate-500">MIDC Industrial Zone, Mumbai - 400001 • GSTIN: 27AAACE1234F1Z9</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-full border border-indigo-200 mb-1">
                📄 OFFICIAL SALES QUOTATION
              </span>
              <p className="text-xs text-slate-500 font-medium">Inquiry Ref: <span className="font-bold text-slate-800">{inquiryRefId}</span></p>
              <p className="text-xs text-slate-500">Date: <span className="font-semibold text-slate-700">{createdDate}</span></p>
            </div>
          </div>

          {/* Customer & Delivery Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Customer / Company Details</p>
              <h4 className="font-bold text-slate-900 text-base mt-0.5">{details.companyName}</h4>
              {details.customerPhone && (
                <p className="text-slate-600 font-mono mt-0.5">Phone: {details.customerPhone}</p>
              )}
              <p className="text-slate-400 mt-1">Channel Source: <span className="font-semibold text-slate-700 capitalize">{inquiry.source_channel || 'WhatsApp Bot'}</span></p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Delivery &amp; Commercial Terms</p>
              <h4 className="font-bold text-slate-900 text-sm mt-0.5">{details.deliveryLocation}</h4>
              <p className="text-purple-800 font-bold mt-1">Payment Terms: {details.paymentTerms || 'As agreed'}</p>
            </div>
          </div>

          {/* Quotation Line Items Table — Strict Reference Structure */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-700 text-white font-bold text-[11px] tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-center w-[5%] border-b border-slate-600">#</th>
                  <th className="px-4 py-2.5 w-[42%] border-b border-slate-600">Item &amp; Description</th>
                  <th className="px-3 py-2.5 text-center w-[15%] border-b border-slate-600">HSN/SAC</th>
                  <th className="px-4 py-2.5 text-right w-[12%] border-b border-slate-600">Qty</th>
                  <th className="px-4 py-2.5 text-right w-[12%] border-b border-slate-600">Rate</th>
                  <th className="px-4 py-2.5 text-right w-[14%] border-b border-slate-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-slate-900">
                {lineItems.map((item, idx) => {
                  const qty = Number(item.quantity) || 0;
                  const rate = Number(item.rate) || 0;
                  const amt = Number(item.amount) || (qty * rate) || 0;
                  const hsn = item.hsn_code || '72083730';
                  const unit = item.unit || 'MT';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="px-3 py-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 text-xs tracking-tight">{item.sku_text || 'HR - COIL / SHEET'}</div>
                        {item.dimensions && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.dimensions}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-slate-600 text-xs">{hsn}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-bold text-slate-900 font-mono text-xs">{formatIndianCurrency(qty, true)}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{unit}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-800 text-xs">
                        {rate > 0 ? formatIndianCurrency(rate, true) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono text-xs">
                        {amt > 0 ? formatIndianCurrency(amt, true) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer: Left total items & Right financial summary block */}
          <div className="flex flex-col sm:flex-row justify-between items-start pt-1 gap-6">
            
            {/* Bottom Left: Items in Total */}
            <div className="text-xs font-semibold text-slate-700 pt-1">
              <span>Items in Total {formatIndianCurrency(totalQuantity, true)} {isSingleUnit ? firstUnit : ''}</span>
              
              <div className="text-[11px] text-slate-500 mt-4 space-y-1">
                <p className="font-semibold text-slate-700">Commercial Terms &amp; Notes:</p>
                <p>1. Material meets IS 2062 / IS 1786 prime metal standards.</p>
                <p>2. Prices valid for 7 days from issue date.</p>
                <p>3. System generated official PDF quotation from Enlight Metals OS.</p>
              </div>
            </div>

            {/* Bottom Right: Financial Summary Block matching Reference Image */}
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 text-slate-700">
                <span className="font-medium">Sub Total</span>
                <span className="font-mono font-medium">{breakdown.formattedSubtotal}</span>
              </div>

              <div className="flex justify-between items-center py-1 text-slate-700">
                <span className="font-medium">CGST (9%)</span>
                <span className="font-mono font-medium">{breakdown.formattedCGST}</span>
              </div>

              <div className="flex justify-between items-center py-1 text-slate-700">
                <span className="font-medium">SGST (9%)</span>
                <span className="font-mono font-medium">{breakdown.formattedSGST}</span>
              </div>

              <div className="flex justify-between items-center py-1 text-slate-700">
                <span className="font-medium">Rounding</span>
                <span className="font-mono font-medium">{breakdown.formattedRounding}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-t border-slate-300 font-black text-slate-950 text-sm">
                <span>Total</span>
                <span className="font-mono text-base">{breakdown.formattedGrandTotal}</span>
              </div>
            </div>

          </div>

          {/* Signature Footer */}
          <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-800">Enlight Metals Sales Ops Team</p>
              <p>System Generated Inquiry Quotation PDF Document</p>
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
