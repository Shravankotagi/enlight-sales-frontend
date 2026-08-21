import { useState } from 'react';
import { X, Download, Check, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
  salespersonName?: string;
}

interface InquiryPdfModalProps {
  inquiry: InquiryItem | null;
  details: ExtractedDetails | null;
  onClose: () => void;
}

function resolvePlaceOfSupply(address?: string): string {
  if (!address) return 'Maharashtra (27)';
  const lower = address.toLowerCase();
  if (
    lower.includes('maharashtra') ||
    lower.includes('mumbai') ||
    lower.includes('pune') ||
    lower.includes('khopoli') ||
    lower.includes('raigad') ||
    lower.includes('thane') ||
    lower.includes('nagpur') ||
    lower.includes('nashik') ||
    lower.includes('chakan') ||
    lower.includes('taloja')
  ) {
    return 'Maharashtra (27)';
  }
  if (lower.includes('gujarat') || lower.includes('ahmedabad') || lower.includes('surat') || lower.includes('vadodara')) {
    return 'Gujarat (24)';
  }
  if (lower.includes('karnataka') || lower.includes('bangalore') || lower.includes('bengaluru')) {
    return 'Karnataka (29)';
  }
  if (lower.includes('tamil nadu') || lower.includes('chennai')) {
    return 'Tamil Nadu (33)';
  }
  if (lower.includes('delhi')) {
    return 'Delhi (07)';
  }
  if (lower.includes('haryana') || lower.includes('gurgaon') || lower.includes('faridabad')) {
    return 'Haryana (06)';
  }
  if (lower.includes('uttar pradesh') || lower.includes('noida') || lower.includes('kanpur')) {
    return 'Uttar Pradesh (09)';
  }
  if (lower.includes('rajasthan') || lower.includes('jaipur')) {
    return 'Rajasthan (08)';
  }
  if (lower.includes('madhya pradesh') || lower.includes('indore')) {
    return 'Madhya Pradesh (23)';
  }
  if (lower.includes('west bengal') || lower.includes('kolkata')) {
    return 'West Bengal (19)';
  }
  if (lower.includes('telangana') || lower.includes('hyderabad')) {
    return 'Telangana (36)';
  }
  return 'Maharashtra (27)';
}

export default function InquiryPdfModal({ inquiry, details, onClose }: InquiryPdfModalProps) {
  const { employee, viewingAs } = useAuth();
  const [copiedRef, setCopiedRef] = useState(false);
  const [logoError, setLogoError] = useState(false);

  if (!inquiry || !details) return null;

  // Build line items list — prefer dynamic lineItems, fall back to single item
  const lineItems: LineItemDetail[] =
    details.lineItems && details.lineItems.length > 0
      ? details.lineItems
      : [
          {
            sku_text: details.productType || 'HR - COIL / SHEET',
            dimensions: [details.thickness, details.width ? `x ${details.width}` : '', details.length ? `x ${details.length}` : '']
              .filter(Boolean)
              .join(' ')
              .trim() || undefined,
            hsn_code: '72083730',
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
  const piNumber = `PI-${inquiry.id ? inquiry.id.substring(0, 5).toUpperCase() : '00051'}`;
  
  const createdDate = inquiry.created_at
    ? new Date(inquiry.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const salesperson = details.salespersonName || viewingAs?.name || employee?.name || (inquiry as any)?.salesperson_name || 'Sales Representative';
  const placeOfSupply = resolvePlaceOfSupply(details.deliveryLocation);

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
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[9999] animate-in fade-in duration-200"
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
            padding: 24px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 my-auto">
        
        {/* Top Actions Header */}
        <div className="bg-slate-900 px-6 py-3.5 flex items-center justify-between no-print shrink-0 border-b border-slate-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
              PI
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">Proforma Invoice / Sales Quotation</h3>
              <p className="text-xs text-slate-400">PI Number: {piNumber} • Ref: {inquiryRefId} • {details.companyName}</p>
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
        <div id="printable-inquiry-pdf" className="overflow-y-auto flex-1 p-6 sm:p-8 space-y-6 bg-white font-sans text-slate-800 text-xs">
          
          {/* Header Section: Company Profile (Left) & Document Title/Meta (Right) */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-5">
            <div className="space-y-1">
              {!logoError ? (
                <img
                  src="/logo.png"
                  alt="Enlight Metals"
                  onError={() => setLogoError(true)}
                  className="h-10 w-auto object-contain max-w-[220px] mb-2"
                />
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-slate-900 text-white font-black text-xl px-3 py-1 rounded-lg">ENLIGHT</span>
                  <span className="text-xl font-bold tracking-wider text-slate-800">METALS</span>
                </div>
              )}
              <h2 className="font-extrabold text-slate-900 text-sm">Enlight Metals Private Limited</h2>
              <p className="text-slate-600 leading-tight">606 Clover Hills Plaza, NIBM Road</p>
              <p className="text-slate-600 leading-tight">Pune Maharashtra 411048, India</p>
              <p className="text-slate-700 font-semibold font-mono text-[11px] pt-0.5">GSTIN 27AAICE5263E1ZN</p>
              <p className="text-slate-500 font-mono text-[11px]">accounts@enlightmetals.com • https://enlightmetals.com/</p>
            </div>

            <div className="text-right space-y-1.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Proforma Invoice</h1>
              <p className="font-mono text-slate-700 text-xs font-semibold">PI Number# <span className="font-bold text-slate-900">{piNumber}</span></p>
              <p className="text-slate-500 text-[11px]">Quotation Ref: <span className="font-mono font-bold text-slate-800">{inquiryRefId}</span></p>
              
              <div className="pt-2 space-y-1 text-[11px]">
                <div className="flex justify-end gap-2 text-slate-600">
                  <span className="font-medium">Order Date :</span>
                  <span className="font-bold text-slate-900 font-mono">{createdDate}</span>
                </div>
                <div className="flex justify-end gap-2 text-slate-600">
                  <span className="font-medium">Sales person :</span>
                  <span className="font-bold text-slate-900">{salesperson}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Address & Supply Section: Bill To, Ship To & Place of Supply */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {/* Bill To */}
              <div className="space-y-1">
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Bill To</p>
                <h4 className="font-extrabold text-slate-900 text-sm uppercase">{details.companyName}</h4>
                <p className="text-slate-600 leading-snug">
                  {details.deliveryLocation || 'MIDC Industrial Area, Maharashtra, India'}
                </p>
                {details.customerPhone && (
                  <p className="text-slate-600 font-mono text-[11px]">Phone: {details.customerPhone}</p>
                )}
                <p className="text-slate-700 font-mono text-[11px]">GSTIN: 27AAOCS2064H1Z4</p>
              </div>

              {/* Ship To */}
              <div className="space-y-1">
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Ship To</p>
                <h4 className="font-extrabold text-slate-900 text-sm uppercase">{details.companyName}</h4>
                <p className="text-slate-600 font-medium">C/O Site Incharge / Delivery Warehouse</p>
                <p className="text-slate-700 font-semibold text-xs leading-snug">
                  {details.deliveryLocation || 'Customer Delivery Site, Maharashtra, India'}
                </p>
                <p className="text-purple-800 font-bold text-[11px] pt-1">
                  Payment Terms: <span className="font-semibold">{details.paymentTerms || 'As per agreed terms'}</span>
                </p>
              </div>
            </div>

            {/* Place Of Supply Indicator */}
            <div className="px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200/80 text-[11px] font-semibold text-slate-700 flex items-center justify-between">
              <span>Place Of Supply: <strong className="text-slate-900 font-bold">{placeOfSupply}</strong></span>
              <span className="text-slate-500 font-mono text-[10px]">Currency: INR (₹)</span>
            </div>
          </div>

          {/* Quotation Line Items Table — Strict Reference Structure */}
          <div className="border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-700 text-white font-bold text-[11px] tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-center w-[5%] border-b border-slate-600">#</th>
                  <th className="px-4 py-2.5 w-[40%] border-b border-slate-600">Item &amp; Description</th>
                  <th className="px-3 py-2.5 text-center w-[15%] border-b border-slate-600">HSN/SAC</th>
                  <th className="px-4 py-2.5 text-right w-[13%] border-b border-slate-600">Qty</th>
                  <th className="px-4 py-2.5 text-right w-[13%] border-b border-slate-600">Rate</th>
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

          {/* Table Footer: Left Total Items & Right Financial Summary Block */}
          <div className="flex flex-col sm:flex-row justify-between items-start pt-1 gap-6">
            {/* Bottom Left: Total Items */}
            <div className="text-xs font-semibold text-slate-700 pt-1">
              <span>Items in Total <strong className="font-mono text-slate-900 font-bold">{formatIndianCurrency(totalQuantity, true)} {isSingleUnit ? firstUnit : ''}</strong></span>
            </div>

            {/* Bottom Right: Financial Summary Block */}
            <div className="w-full sm:w-72 space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between items-center py-0.5">
                <span className="font-medium text-slate-600">Sub Total</span>
                <span className="font-mono font-medium text-slate-900">{breakdown.formattedSubtotal}</span>
              </div>

              <div className="flex justify-between items-center py-0.5">
                <span className="font-medium text-slate-600">CGST9 (9%)</span>
                <span className="font-mono font-medium text-slate-900">{breakdown.formattedCGST}</span>
              </div>

              <div className="flex justify-between items-center py-0.5">
                <span className="font-medium text-slate-600">SGST9 (9%)</span>
                <span className="font-mono font-medium text-slate-900">{breakdown.formattedSGST}</span>
              </div>

              <div className="flex justify-between items-center py-0.5">
                <span className="font-medium text-slate-600">Rounding</span>
                <span className="font-mono font-medium text-slate-900">{breakdown.formattedRounding}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-300 font-black text-slate-950 text-sm">
                <span className="font-bold">Total</span>
                <span className="font-mono text-base font-black text-slate-950">{breakdown.formattedGrandTotal}</span>
              </div>
            </div>
          </div>

          {/* Bank Details & Terms Section (Direct Match with PDF 2 Page 2) */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 text-[11px] text-slate-700">
            {/* Notes & Bank Details */}
            <div className="space-y-1.5">
              <p className="font-bold text-slate-900 text-xs">Notes</p>
              <p className="font-bold text-slate-800">Bank Details:-</p>
              <div className="font-mono text-slate-700 space-y-0.5 pl-1">
                <p>Bank Name: <span className="font-semibold text-slate-900">HDFC Bank</span></p>
                <p>IFSC Code: <span className="font-semibold text-slate-900">HDFC0002454</span></p>
                <p>Account Number: <span className="font-semibold text-slate-900">50200107323747</span></p>
                <p>Account Name: <span className="font-semibold text-slate-900">Enlight Metals Private Limited</span></p>
              </div>
            </div>

            {/* Terms & Conditions / Declaration */}
            <div className="space-y-1.5">
              <p className="font-bold text-slate-900 text-xs">Terms &amp; Conditions</p>
              <p className="text-slate-600 leading-tight">
                <strong className="text-slate-800 font-semibold">Declaration:</strong> Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged and there is no flow of additional consideration directly or indirectly from the buyer.
              </p>
              <div className="pt-1 text-[10px] text-slate-500 leading-tight space-y-0.5">
                <p className="font-semibold text-slate-700">Note:</p>
                <p>1) Interest @24% p.a. will be charged if the payment is not made with stipulated date.</p>
                <p>2) All disputes are Subject to Pune Jurisdiction only.</p>
              </div>
            </div>
          </div>

          {/* Authorized Signature Section with Official Stamp */}
          <div className="pt-6 border-t border-slate-200 flex justify-between items-end">
            <div>
              <p className="font-extrabold text-slate-900 text-xs">Enlight Metals Private Limited</p>
              <p className="text-[10px] text-slate-400">MIDC Zone, Pune / Mumbai Operations</p>
            </div>

            <div className="text-right flex flex-col items-center sm:items-end">
              {/* Stamp Graphic & Signature Line */}
              <div className="relative flex items-center justify-center mb-1">
                <div className="w-28 h-14 border-2 border-indigo-700/80 rounded-full flex flex-col items-center justify-center p-1 text-center rotate-[-4deg] shadow-2xs">
                  <span className="text-[7px] font-extrabold text-indigo-900 uppercase tracking-tighter">ENLIGHT METALS PVT. LTD.</span>
                  <span className="text-[9px] font-serif italic text-indigo-800 font-bold my-[-2px]">Authorized</span>
                  <span className="text-[6.5px] font-bold text-indigo-700 uppercase tracking-widest">★ PUNE ★</span>
                </div>
              </div>
              <div className="h-0.5 bg-slate-300 w-36 mb-1"></div>
              <p className="font-bold text-slate-800 text-xs">Authorized Signature</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
