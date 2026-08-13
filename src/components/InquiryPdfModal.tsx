import { useState } from 'react';
import { X, Download, Check, Copy } from 'lucide-react';

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

  const subtotal = Math.round(details.totalAmount / 1.18);
  const gstAmount = details.totalAmount - subtotal;
  const inquiryRefId = inquiry.id ? `#INQ-${inquiry.id.substring(0, 8).toUpperCase()}` : '#ENLIGHT-INQ';
  const createdDate = inquiry.created_at ? new Date(inquiry.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');

  const handleCopyRef = () => {
    navigator.clipboard.writeText(inquiryRefId);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handlePrintDownload = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] overflow-y-auto animate-in fade-in duration-200">
      
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
        <div id="printable-inquiry-pdf" className="p-6 sm:p-8 space-y-6 bg-white">
          
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
              <p className="text-slate-600 font-mono mt-0.5">Phone: {details.customerPhone}</p>
              <p className="text-slate-400 mt-1">Channel Source: <span className="font-semibold text-slate-700 capitalize">{inquiry.source_channel || 'WhatsApp Bot'}</span></p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Delivery &amp; Commercial Terms</p>
              <h4 className="font-bold text-slate-900 text-sm mt-0.5">{details.deliveryLocation}</h4>
              <p className="text-purple-800 font-bold mt-1">Payment Terms: {details.paymentTerms}</p>
              <p className="text-slate-500 mt-0.5">Form Specification: <span className="font-bold text-slate-800">{details.productForm}</span></p>
            </div>
          </div>

          {/* Quotation Line Items Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider">
                <tr className="divide-x divide-slate-700 border-b border-slate-800">
                  <th className="px-3 py-3 text-center w-[6%]">#</th>
                  <th className="px-4 py-3 w-[44%]">Material Description &amp; Specifications</th>
                  <th className="px-4 py-3 text-right w-[16%]">Quantity (MT)</th>
                  <th className="px-4 py-3 text-right w-[17%]">Unit Rate (₹/MT)</th>
                  <th className="px-4 py-3 text-right w-[17%]">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50 divide-x divide-slate-200">
                  <td className="px-3 py-3.5 text-center text-slate-500 font-medium">1</td>
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-slate-900">{details.productType} ({details.productForm})</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      Spec: {details.thickness} {details.width ? `x ${details.width}` : ''} {details.length ? `x ${details.length}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-indigo-900">
                    {details.quantityTons} MT
                    <span className="block text-[11px] text-slate-400 font-normal">({details.quantityUnits} units)</span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-700">
                    ₹{details.unitPrice.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3.5 text-right font-black text-slate-900">
                    ₹{details.totalAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Financial Calculation Box & Terms */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-2">
            <div className="text-xs text-slate-500 max-w-sm space-y-1">
              <p className="font-semibold text-slate-700">Commercial Terms &amp; Notes:</p>
              <p>1. Material meets IS 2062 / IS 1786 prime metal standards.</p>
              <p>2. Prices valid for 7 days from issue date.</p>
              <p>3. System generated official PDF quotation from Enlight Metals OS.</p>
            </div>

            <div className="w-full sm:w-80 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal (Base Value):</span>
                <span className="font-mono font-medium">
                  ₹{subtotal.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between text-xs text-slate-600">
                <span>GST (18% Estimated):</span>
                <span className="font-mono font-medium">
                  ₹{gstAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-300 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900">Total Quotation Amount:</span>
                <span className="text-lg font-bold text-emerald-700 font-mono">
                  ₹{details.totalAmount.toLocaleString('en-IN')}
                </span>
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
