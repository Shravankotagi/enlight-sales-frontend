import React, { useState } from 'react';
import { X, Upload, Download, FileSpreadsheet, Check, AlertCircle, Loader2, Users } from 'lucide-react';
import { customersApi } from '../lib/api';

interface Salesperson {
  name: string;
  phone: string;
  employee_id: string;
}

interface ImportClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  salespeople: Salesperson[];
  onSuccess?: () => void;
}

interface ParsedClient {
  customer_name: string;
  contact_person?: string;
  customer_phone?: string;
  customer_email?: string;
  address?: string;
  customer_gst?: string;
  industry?: string;
  assigned_salesperson_phone?: string;
}

export default function ImportClientsModal({
  isOpen,
  onClose,
  salespeople,
  onSuccess,
}: ImportClientsModalProps) {
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedClients, setParsedClients] = useState<ParsedClient[]>([]);
  const [parseError, setParseError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  // Download Sample CSV Template
  const handleDownloadSample = () => {
    const sampleCsv = `Company Name,Contact Person,Phone,Email,Address,GSTIN,Industry,Assigned Salesperson Phone
Supreme Enterprises,Rajesh Sharma,919876543210,rajesh@supreme.com,Mumbai,27AAAAA0000A1Z5,Manufacturing,919876543210
Apex Infra Pvt Ltd,Suresh Patel,919876543222,suresh@apex.com,Delhi,07BBBBB1111B2Z6,Construction,919876543222
Shiva Fabrication,Ramesh Verma,917896248624,ramesh@shiva.com,Pune,27CCCCC2222C3Z7,Industrial,917896248624`;

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'enlight_clients_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to parse CSV text
  const parseCSVText = (text: string): ParsedClient[] => {
    const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV file appears empty or missing headers');

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    
    // Map headers to key names
    const getHeaderIdx = (...aliases: string[]) => {
      return headers.findIndex(h => aliases.some(alias => h.includes(alias.toLowerCase())));
    };

    const nameIdx = getHeaderIdx('company name', 'customer name', 'company', 'customer', 'client');
    const contactIdx = getHeaderIdx('contact person', 'contact name', 'contact', 'person');
    const phoneIdx = getHeaderIdx('phone', 'mobile', 'whatsapp');
    const emailIdx = getHeaderIdx('email');
    const addressIdx = getHeaderIdx('address', 'city', 'location');
    const gstIdx = getHeaderIdx('gstin', 'gst');
    const industryIdx = getHeaderIdx('industry', 'segment');
    const salespersonIdx = getHeaderIdx('assigned salesperson phone', 'salesperson phone', 'salesperson');

    if (nameIdx === -1) {
      throw new Error('CSV missing required header: "Company Name" or "Customer Name"');
    }

    const rows: ParsedClient[] = [];
    for (let i = 1; i < lines.length; i++) {
      // Split comma considering quotes
      const values = lines[i].split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
      const customerName = values[nameIdx] || '';
      if (!customerName) continue;

      rows.push({
        customer_name: customerName,
        contact_person: contactIdx !== -1 ? values[contactIdx] : undefined,
        customer_phone: phoneIdx !== -1 ? values[phoneIdx] : undefined,
        customer_email: emailIdx !== -1 ? values[emailIdx] : undefined,
        address: addressIdx !== -1 ? values[addressIdx] : undefined,
        customer_gst: gstIdx !== -1 ? values[gstIdx] : undefined,
        industry: industryIdx !== -1 ? values[industryIdx] : undefined,
        assigned_salesperson_phone: salespersonIdx !== -1 ? values[salespersonIdx] : undefined,
      });
    }

    return rows;
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError('');
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const clients = parseCSVText(text);
        if (clients.length === 0) throw new Error('No valid client rows found in file');
        setParsedClients(clients);
      } catch (err: any) {
        setParseError(err.message || 'Failed to parse CSV file');
        setParsedClients([]);
      }
    };
    reader.readAsText(selectedFile);
  };

  // Submit Import
  const handleImportSubmit = async () => {
    if (parsedClients.length === 0) {
      setErrorMsg('Please select a valid CSV/XLSX file with client records');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await customersApi.importClients({
        default_salesperson_phone: selectedSalesperson || undefined,
        clients: parsedClients,
      });

      const count = res.data?.data?.count || res.data?.count || parsedClients.length;
      setSuccessMsg(`Successfully imported ${count} client(s) into database!`);
      
      if (onSuccess) onSuccess();

      setTimeout(() => {
        onClose();
        setFile(null);
        setParsedClients([]);
        setSuccessMsg('');
      }, 2000);

    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-2xl p-6 border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Import Existing Clients (CSV / XLSX)</h3>
              <p className="text-xs text-slate-400">Bulk upload clients and assign them to salespersons</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">

          {/* Salesperson Assignment & Download Template Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Users size={14} className="text-blue-400" />
                Assign All Clients To Salesperson
              </label>
              <select
                value={selectedSalesperson}
                onChange={e => setSelectedSalesperson(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Use CSV "Assigned Salesperson" Column / Unassigned</option>
                {salespeople.map(sp => (
                  <option key={sp.phone} value={sp.phone}>
                    {sp.name} ({sp.employee_id}) — +{sp.phone}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                If selected, overrides any unassigned rows in the spreadsheet.
              </p>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleDownloadSample}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                <Download size={14} className="text-green-400" />
                Download Sample Template (CSV)
              </button>
              <p className="text-[11px] text-slate-400 mt-1 text-center">
                Pre-formatted headers for easy editing
              </p>
            </div>
          </div>

          {/* File Upload Box */}
          <div className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl p-6 text-center bg-slate-700/30 transition-colors">
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={handleFileChange}
              id="csv-file-input"
              className="hidden"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center">
              <Upload size={32} className="text-blue-400 mb-2" />
              <span className="text-sm font-semibold text-white">
                {file ? file.name : 'Click to select CSV or XLSX file'}
              </span>
              <span className="text-xs text-slate-400 mt-1">
                Supports .csv, .xlsx format (Max 5MB)
              </span>
            </label>
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {parseError}
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-xs flex items-center gap-2">
              <Check size={16} className="shrink-0" />
              {successMsg}
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Preview Table */}
          {parsedClients.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">
                  Preview ({parsedClients.length} clients detected)
                </span>
                <span className="text-[11px] text-green-400 font-medium">Ready to import</span>
              </div>
              <div className="border border-slate-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-700 text-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Company Name</th>
                      <th className="p-2">Contact Person</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">City/Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 bg-slate-800">
                    {parsedClients.slice(0, 5).map((client, idx) => (
                      <tr key={idx} className="hover:bg-slate-700/50">
                        <td className="p-2 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-semibold text-white">{client.customer_name}</td>
                        <td className="p-2">{client.contact_person || '-'}</td>
                        <td className="p-2 font-mono">{client.customer_phone || '-'}</td>
                        <td className="p-2">{client.address || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedClients.length > 5 && (
                <p className="text-[11px] text-slate-400 mt-1 text-right">
                  + {parsedClients.length - 5} more clients
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImportSubmit}
            disabled={loading || parsedClients.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Importing...</>
            ) : (
              <>Confirm & Import {parsedClients.length > 0 ? `${parsedClients.length} Clients` : ''}</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
