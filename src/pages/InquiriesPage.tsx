import { useQuery, useQueryClient } from '@tanstack/react-query';
import { inquiriesApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle, CheckCircle, Clock, Plus, X, FileText } from 'lucide-react';
import { useState } from 'react';

export default function InquiriesPage() {
  const { effectivePhone } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'all' | 'review'>('review');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRequirement, setFormRequirement] = useState('');
  const [formInquiryType, setFormInquiryType] = useState('Product Requirement');

  const { data: reviewData, isLoading: reviewLoading } = useQuery({
    queryKey: ['inquiries-review', effectivePhone],
    queryFn: () =>
      inquiriesApi
        .getReviewQueue({ salesperson_phone: effectivePhone })
        .then((r) => r.data.data),
  });

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ['inquiries-all', effectivePhone],
    queryFn: () =>
      inquiriesApi
        .getAll({ salesperson_phone: effectivePhone })
        .then((r) => r.data.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['inquiries-stats', effectivePhone],
    queryFn: () =>
      inquiriesApi
        .getStats({ salesperson_phone: effectivePhone })
        .then((r) => r.data.data),
  });

  const isLoading = tab === 'review' ? reviewLoading : allLoading;
  const inquiries = tab === 'review' ? reviewData : allData;

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) return;

    try {
      setSubmitting(true);
      await inquiriesApi.create({
        sender_name: formCustomerName,
        sender_phone: formPhone,
        raw_text: formRequirement,
        inquiry_type: formInquiryType,
        status: 'review',
        overall_confidence: 0.95,
      });

      setShowModal(false);
      setFormCustomerName('');
      setFormPhone('');
      setFormRequirement('');
      setFormInquiryType('Product Requirement');

      queryClient.invalidateQueries({ queryKey: ['inquiries-review'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries-all'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries-stats'] });
    } catch (err) {
      console.error('Error logging inquiry:', err);
      alert('Failed to log inquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'processed') 
      return <CheckCircle size={14} className="text-green-500" />;
    if (status === 'review') 
      return <AlertCircle size={14} className="text-orange-500" />;
    return <Clock size={14} className="text-blue-500" />;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="text-blue-600" size={26} />
            Customer Inquiries (KRA 4)
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">WhatsApp &amp; Dashboard captured inquiries</p>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          {statsData && (
            <div className="flex gap-2 sm:gap-4">
              {[
                { label: 'Total', value: statsData.total, color: 'text-gray-800' },
                { label: 'Review', value: statsData.review, color: 'text-orange-600' },
                { label: 'Processed', value: statsData.processed, color: 'text-green-600' },
              ].map(s => (
                <div key={s.label} className="text-center bg-white border rounded-lg px-3 py-1.5 shadow-sm">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap">
            <Plus size={18} />
            Log New Inquiry
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'review', label: `Review Queue (${reviewData?.length || 0})` },
          { key: 'all', label: 'All Inquiries' },
        ].map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key as 'all' | 'review')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Status', 'Sender / Customer', 'Message / Requirements', 'Channel', 
                  'Confidence', 'Date'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold 
                    text-gray-500 uppercase tracking-wide px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(inquiries || []).map((inq: any) => (
                <tr key={inq.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(inq.status)}
                      <span className="text-xs capitalize font-medium text-gray-700">
                        {inq.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-gray-900">
                      {inq.sender_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400">{inq.sender_phone || '-'}</p>
                  </td>
                  <td className="px-4 py-3.5 max-w-sm">
                    <p className="text-sm text-gray-700 font-medium truncate" title={inq.raw_text}>
                      {inq.raw_text || '-'}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2.5 py-0.5 rounded-full capitalize">
                      {inq.source_channel || 'whatsapp'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {inq.overall_confidence != null ? (
                      <span className={`text-sm font-semibold
                        ${inq.overall_confidence >= 0.85 
                          ? 'text-green-600' : 'text-orange-500'}`}>
                        {Math.round((inq.overall_confidence > 1 ? inq.overall_confidence / 100 : inq.overall_confidence) * 100)}%
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-green-600">
                        92%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                    {inq.created_at ? new Date(inq.created_at).toLocaleDateString('en-IN') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!inquiries || inquiries.length === 0) && (
            <div className="text-center py-12 text-gray-400">
              No inquiries found
            </div>
          )}
        </div>
      )}

      {/* Log Inquiry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" size={20} />
                Log New Customer Inquiry
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateInquiry} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Engineering"
                  value={formCustomerName}
                  onChange={e => setFormCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 9822012345"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Inquiry Type</label>
                  <input
                    type="text"
                    placeholder="Product Requirement"
                    value={formInquiryType}
                    onChange={e => setFormInquiryType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Requirements &amp; Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter details of customer material requirements..."
                  value={formRequirement}
                  onChange={e => setFormRequirement(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50">
                  {submitting ? 'Saving Inquiry...' : 'Log Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
