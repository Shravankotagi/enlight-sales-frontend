import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Download, Check, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { customersApi } from '../lib/api';
import { calculateQuotationBreakdown, formatIndianCurrency } from '../utils/pricingEngine';

interface InquiryItem {
  id: string;
  sender_name?: string;
  customer_name?: string;
  customer_phone?: string;
  sender_phone?: string;
  salesperson_name?: string;
  assigned_salesperson_name?: string;
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

export default function InquiryPdfModal({ inquiry, details, onClose }: InquiryPdfModalProps) {
  const { employee, viewingAs } = useAuth();
  const [copiedRef, setCopiedRef] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const { data: customerList = [] } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await customersApi.getAll();
      return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!inquiry || !details) return null;

  const matchedCustomer = (customerList as any[]).find((c: any) => {
    const cName = (c.company_name || c.name || '').toLowerCase().trim();
    const targetName = (details.companyName || '').toLowerCase().trim();
    return cName && targetName && (cName === targetName || cName.includes(targetName) || targetName.includes(cName));
  });

  const customerAddress = details.deliveryLocation || matchedCustomer?.address || matchedCustomer?.billing_address || (inquiry as any)?.customer_address || '';
  const customerGstin = (details as any)?.gstin || matchedCustomer?.gstin || matchedCustomer?.gst_number || (inquiry as any)?.customer_gstin || (inquiry as any)?.ai_extraction_json?.gstin || (inquiry as any)?.ai_extraction_json?.gst_number || '';

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
  const primaryUnit = lineItems.find(i => i.unit)?.unit || lineItems[0]?.unit || 'MT';

  const piNumber = (() => {
    const inq = inquiry as any;
    if (inq.pi_number) return inq.pi_number;
    if (inq.quotation_number) return inq.quotation_number;
    if (inq.ai_extraction_json?.pi_number) return inq.ai_extraction_json.pi_number;
    if (inq.ai_extraction_json?.quotation_number) return inq.ai_extraction_json.quotation_number;
    if (inq.deal_number) return inq.deal_number.replace(/^DEAL-/i, 'PI-');
    if (typeof inq.id === 'string') {
      if (inq.id.startsWith('PI-')) return inq.id;
      const cleanHex = inq.id.replace(/[^0-9a-f]/gi, '');
      if (cleanHex.length >= 4) {
        const numericVal = parseInt(cleanHex.substring(0, 6), 16);
        const seq = (numericVal % 900) + 51;
        return `PI-00${String(seq).padStart(3, '0')}`;
      }
      return `PI-${inq.id.substring(0, 5).toUpperCase()}`;
    }
    return 'PI-00051';
  })();
  
  const createdDate = inquiry.created_at
    ? new Date(inquiry.created_at).toLocaleDateString('en-GB')
    : new Date().toLocaleDateString('en-GB');

  // Dynamic Sales Representative name from account / inquiry / logged in context
  const salesperson = (() => {
    const raw =
      details.salespersonName ||
      inquiry.salesperson_name ||
      inquiry.assigned_salesperson_name ||
      (inquiry as any)?.salesperson ||
      (inquiry as any)?.ai_extraction_json?.salespersonName ||
      (inquiry as any)?.ai_extraction_json?.salesperson_name ||
      (inquiry as any)?.ai_extraction_json?.salesperson ||
      viewingAs?.name ||
      employee?.name;
    if (raw && typeof raw === 'string' && raw.trim() && raw.trim().toLowerCase() !== 'sales representative') {
      return raw.trim();
    }
    return viewingAs?.name || employee?.name || 'Vedant Goel';
  })();

  const handleCopyRef = () => {
    navigator.clipboard.writeText(piNumber);
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
      {/* Print CSS to ensure exact sheet printing */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 15mm;
          }
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
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 my-auto">
        
        {/* Top Actions Bar (Hidden on print) */}
        <div className="bg-slate-900 px-6 py-3.5 flex items-center justify-between no-print shrink-0 border-b border-slate-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-xs">
              PI
            </div>
            <div>
              <h3 className="font-bold text-white text-sm leading-tight">Proforma Invoice Preview</h3>
              <p className="text-xs text-slate-400">PI Number: {piNumber} • {details.companyName || 'Quotation'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyRef}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors">
              {copiedRef ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copiedRef ? 'Copied!' : 'Copy PI#'}
            </button>

            <button
              type="button"
              onClick={handlePrintDownload}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors">
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

        {/* Printable PDF Document Body - Exact Reference Match */}
        <div id="printable-inquiry-pdf" className="overflow-y-auto flex-1 p-8 sm:p-12 space-y-4 bg-white font-sans text-slate-800 text-[13px] leading-relaxed">
          
          {/* ================= PAGE 1 ================= */}
          <div className="space-y-4">
            {/* Header Section: Company Monogram/Details (Left) & Proforma Invoice (Right) */}
            <div className="flex justify-between items-start pb-3">
              {/* Left: Enlight Metals Monogram + Address */}
              <div className="space-y-0.5 text-slate-700 text-[12px]">
                {!logoError ? (
                  <div className="mb-2">
                    <img
                      src="/logo.png"
                      alt="Enlight Metals"
                      onError={() => setLogoError(true)}
                      className="h-10 w-auto object-contain max-w-[210px]"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 mb-2">
                    <svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 20H35V45L50 25L65 45V20H85V80H65V55L50 75L35 55V80H15V20Z" fill="#1E293B"/>
                    </svg>
                    <div className="flex flex-col">
                      <span className="font-extrabold text-slate-900 text-base tracking-wider leading-none">ENLIGHT</span>
                      <span className="font-semibold text-slate-600 text-[10px] tracking-[0.25em] leading-tight">METALS</span>
                    </div>
                  </div>
                )}
                <h2 className="font-bold text-slate-900 text-[13px] pt-1">Enlight Metals Private Limited</h2>
                <p className="text-slate-600 leading-tight">606 Clover Hills Plaza</p>
                <p className="text-slate-600 leading-tight">NIBM Road</p>
                <p className="text-slate-600 leading-tight">Pune Maharashtra 411048</p>
                <p className="text-slate-600 leading-tight">India</p>
                <p className="text-slate-700 font-medium text-[12px] pt-0.5">GSTIN 27AAICE5263E1ZN</p>
                <p className="text-slate-600 text-[12px]">accounts@enlightmetals.com</p>
                <p className="text-slate-600 text-[12px]">https://enlightmetals.com/</p>
              </div>

              {/* Right: Proforma Invoice & PI Number */}
              <div className="text-right">
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Proforma Invoice</h1>
                <p className="text-slate-700 text-[13px] font-semibold mt-1.5">
                  PI Number# <span className="text-slate-900">{piNumber}</span>
                </p>
              </div>
            </div>

            {/* Addresses & Supply Section: Bill To, Ship To, Place of Supply (Left) & Order Date, Salesperson (Right) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-1 pb-1">
              {/* Left Column: Bill To, Ship To, Place of Supply */}
              <div className="space-y-3 text-slate-700 text-[12px]">
                {/* Bill To */}
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-800 mb-0.5">Bill To</p>
                  <p className="font-bold text-slate-900 uppercase text-[12px]">{details.companyName || (inquiry as any)?.customer_name || 'Customer'}</p>
                  {customerAddress && customerAddress.split(',').map((part: string, idx: number) => (
                    <p key={idx} className="text-slate-600 leading-tight">{part.trim()}</p>
                  ))}
                  {customerGstin && (
                    <p className="text-slate-700 font-medium text-[12px] pt-0.5">GSTIN {customerGstin}</p>
                  )}
                </div>

                {/* Ship To */}
                <div className="space-y-0.5 pt-0.5">
                  <p className="font-bold text-slate-800 mb-0.5">Ship To</p>
                  <p className="font-bold text-slate-900 uppercase text-[12px]">{details.companyName || (inquiry as any)?.customer_name || 'Customer'}</p>
                  {details.deliveryLocation ? (
                    details.deliveryLocation.split(',').map((part: string, idx: number) => (
                      <p key={idx} className="text-slate-600 leading-tight">{part.trim()}</p>
                    ))
                  ) : (customerAddress && customerAddress !== details.deliveryLocation) ? (
                    customerAddress.split(',').map((part: string, idx: number) => (
                      <p key={idx} className="text-slate-600 leading-tight">{part.trim()}</p>
                    ))
                  ) : null}
                </div>

                {/* Place Of Supply */}
                <div className="pt-1">
                  <p className="font-medium text-slate-800 text-[12px]">
                    Place Of Supply: <span className="font-normal text-slate-700">Maharashtra (27)</span>
                  </p>
                </div>
              </div>

              {/* Right Column: Order Date & Salesperson (Neatly aligned one below the other) */}
              <div className="flex flex-col items-start sm:items-end justify-end pb-1">
                <div className="grid grid-cols-[85px_auto] gap-x-3 gap-y-1.5 text-[12px]">
                  <span className="font-normal text-slate-700">Order Date :</span>
                  <span className="font-normal text-slate-900">{createdDate}</span>
                  <span className="font-normal text-slate-700">Sales person :</span>
                  <span className="font-normal text-slate-900 capitalize">{salesperson}</span>
                </div>
              </div>
            </div>

            {/* Quotation Line Items Table — Exact Dark Header Reference Style */}
            <div className="pt-1 overflow-x-auto">
              <table className="w-full text-left text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#525E6F] text-white font-bold text-[12px]">
                    <th className="px-3 py-2.5 text-center w-[5%] font-bold">#</th>
                    <th className="px-4 py-2.5 w-[39%] font-bold">Item &amp; Description</th>
                    <th className="px-3 py-2.5 text-center w-[15%] font-bold">HSN/SAC</th>
                    <th className="px-4 py-2.5 text-right w-[13%] font-bold">Qty</th>
                    <th className="px-4 py-2.5 text-right w-[13%] font-bold">Rate</th>
                    <th className="px-4 py-2.5 text-right w-[15%] font-bold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-900 bg-white">
                  {lineItems.map((item, idx) => {
                    const qty = Number(item.quantity) || 0;
                    const rate = Number(item.rate) || 0;
                    const amt = Number(item.amount) || (qty * rate) || 0;
                    const hsn = item.hsn_code || '72083730';
                    const unit = item.unit || 'MT';

                    return (
                      <tr key={idx} className="align-top">
                        <td className="px-3 py-3 text-center text-slate-600 font-medium">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 text-[12px] uppercase">
                            {item.sku_text || 'HR - COIL / SHEET'}
                          </div>
                          {item.dimensions && (
                            <div className="text-[11px] text-slate-600 font-normal mt-0.5">
                              {item.dimensions}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-normal text-slate-700 text-[12px]">{hsn}</td>
                        <td className="px-4 py-3 text-right font-normal text-slate-900 text-[12px] whitespace-nowrap">
                          {formatIndianCurrency(qty, true)} {unit}
                        </td>
                        <td className="px-4 py-3 text-right font-normal text-slate-800 text-[12px]">
                          {rate > 0 ? formatIndianCurrency(rate, true) : '0.00'}
                        </td>
                        <td className="px-4 py-3 text-right font-normal text-slate-900 text-[12px]">
                          {amt > 0 ? formatIndianCurrency(amt, true) : '0.00'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Totals & Summary Block — Exact Reference Style */}
            <div className="flex flex-col sm:flex-row justify-between items-start pt-4 gap-6 border-t border-slate-200 mt-2">
              {/* Bottom Left: Total Items & Payment Terms in Same Text Color */}
              <div className="space-y-1.5 text-[12px] text-slate-800 pt-1">
                <div>
                  <span>Items in Total <strong className="font-bold">{formatIndianCurrency(totalQuantity, true)} {primaryUnit}</strong></span>
                </div>
                {details.paymentTerms && (
                  <div>
                    <span>Payment Terms : </span>
                    <span className="font-medium text-slate-900">{details.paymentTerms}</span>
                  </div>
                )}
              </div>

              {/* Bottom Right: Financial Breakdown Calculation */}
              <div className="w-full sm:w-72 space-y-2 text-[12px] text-slate-700">
                <div className="flex justify-between items-center py-0.5">
                  <span className="font-normal text-slate-700">Sub Total</span>
                  <span className="font-normal text-slate-900 text-right">{breakdown.formattedSubtotal}</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="font-normal text-slate-700">CGST9 (9%)</span>
                  <span className="font-normal text-slate-900 text-right">{breakdown.formattedCGST}</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="font-normal text-slate-700">SGST9 (9%)</span>
                  <span className="font-normal text-slate-900 text-right">{breakdown.formattedSGST}</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="font-normal text-slate-700">Rounding</span>
                  <span className="font-normal text-slate-900 text-right">{breakdown.formattedRounding}</span>
                </div>

                <div className="flex justify-between items-center pt-2 font-bold text-slate-900 text-[13px]">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-[14px]">{breakdown.formattedGrandTotal.startsWith('₹') ? breakdown.formattedGrandTotal : `₹${breakdown.formattedGrandTotal}`}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ================= PAGE 2 ================= */}
          <div className="pt-10 border-t border-slate-200 space-y-6 page-break-before">
            {/* Notes & Bank Details */}
            <div className="space-y-1 text-[12px] text-slate-700">
              <p className="font-bold text-slate-900 text-[13px]">Notes</p>
              <p className="font-normal text-slate-800 pt-0.5">Bank Details: -</p>
              <div className="space-y-0.5 pl-0.5">
                <p>Bank Name: <span className="font-normal text-slate-800">HDFC Bank</span></p>
                <p>IFSC Code: <span className="font-normal text-slate-800">HDFC0002454</span></p>
                <p>Account Number: <span className="font-normal text-slate-800">50200107323747</span></p>
                <p>Account Name: <span className="font-normal text-slate-800">Enlight Metals Private Limited</span></p>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-2 text-[12px] text-slate-700 pt-2">
              <p className="font-bold text-slate-900 text-[13px]">Terms &amp; Conditions</p>
              <p className="text-slate-700 leading-snug">
                <strong className="font-normal text-slate-800">Declaration:</strong><br />
                Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged and there is no flow of additional consideration directly or indirectly from the buyer.
              </p>

              <div className="pt-2 text-[12px] text-slate-700 leading-snug space-y-1">
                <p className="font-normal text-slate-800">Note:</p>
                <p>1) Interest @24% p.a. will be charged if the payment is not made with stipulated date.</p>
                <p>2) All disputes are Subject to Pune Jurisdiction only.</p>
              </div>
            </div>

            {/* Authorized Signature */}
            <div className="pt-12 flex justify-start items-center">
              <div>
                <p className="font-bold text-slate-800 text-[13px]">Authorized Signature</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
