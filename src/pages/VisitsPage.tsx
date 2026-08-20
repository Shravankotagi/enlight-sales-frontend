import { useState, useEffect } from 'react';
import { MapPin, Plus, Search, CheckCircle2, Clock, ThumbsUp, RefreshCw, X, User, Phone, Map } from 'lucide-react';
import { visitsApi } from '../lib/api';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { getFirstDayOfMonth, getLastDayOfMonth, formatLocalDate } from '../utils/dateUtils';

interface CustomerVisit {
  id: string;
  customer_name: string;
  person_met?: string;
  contact_phone?: string;
  contact_no?: string;
  location?: string;
  customer_address?: string;
  outcome?: 'positive' | 'neutral' | 'negative' | string;
  remarks?: string;
  raw_remarks?: string;
  material_requirement?: string;
  requirement?: string;
  follow_up_action?: string;
  follow_up?: string;
  followup?: string;
  visited_at: string;
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
  });

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formPersonMet, setFormPersonMet] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formOutcome, setFormOutcome] = useState('positive');
  const [formRemarks, setFormRemarks] = useState('');
  const [formFollowup, setFormFollowup] = useState('');
  const [formVisitDate, setFormVisitDate] = useState(formatLocalDate());

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to;
      const res = await visitsApi.getAll(params);
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
      setVisits(list);
    } catch (err) {
      console.error('Error fetching visits:', err);
      setVisits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, [dateRange]);

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) return;

    try {
      setSubmitting(true);
      await visitsApi.create({
        customer_name: formCustomerName,
        person_met: formPersonMet,
        contact_phone: formContactPhone,
        location: formLocation,
        outcome: formOutcome,
        remarks: formRemarks,
        follow_up_action: formFollowup,
        visited_at: new Date(formVisitDate).toISOString(),
      });

      setShowModal(false);
      // Reset form
      setFormCustomerName('');
      setFormPersonMet('');
      setFormContactPhone('');
      setFormLocation('');
      setFormOutcome('positive');
      setFormRemarks('');
      setFormFollowup('');

      fetchVisits();
    } catch (err) {
      console.error('Error creating visit:', err);
      alert('Failed to log visit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const safeVisits = Array.isArray(visits) ? visits : [];

  // Filter visits by date range, search, & outcome
  const filtered = safeVisits.filter(v => {
    // Date filter
    if (dateRange.from && dateRange.to) {
      const dateStr = v.visited_at;
      if (dateStr) {
        const itemDate = new Date(dateStr).toISOString().split('T')[0];
        if (itemDate < dateRange.from || itemDate > dateRange.to) return false;
      }
    }

    const matchesSearch =
      (v?.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.person_met || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.customer_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.remarks || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.follow_up_action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.material_requirement || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOutcome = filterOutcome === 'all' || (v?.outcome || '').toLowerCase() === filterOutcome.toLowerCase();
    return matchesSearch && matchesOutcome;
  });

  const totalVisits = filtered.length;

  const getNormalizedOutcome = (v: any) => {
    const o = (v?.outcome || '').toLowerCase();
    const r = (v?.remarks || '').toLowerCase();
    if (o === 'neutral' || r.includes('neutral')) return 'neutral';
    if (o === 'negative' || o === 'closed' || r.includes('negative') || r.includes('closed')) return 'negative';
    return 'positive';
  };

  const positiveVisits = filtered.filter(v => getNormalizedOutcome(v) === 'positive').length;
  const neutralVisits = filtered.filter(v => getNormalizedOutcome(v) === 'neutral').length;
  const negativeVisits = filtered.filter(v => getNormalizedOutcome(v) === 'negative').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="text-emerald-600" size={28} />
            Field Customer Visits
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Log and manage customer visits, meeting notes, outcomes, and follow-up actions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateFilterControl onChange={setDateRange} />
          <button
            onClick={fetchVisits}
            className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg flex items-center gap-2 shadow-sm transition-colors">
            <Plus size={18} />
            Log Customer Visit
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Visits Logged</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalVisits}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <MapPin size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Positive Outcomes 🟢</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{positiveVisits}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <ThumbsUp size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Neutral / Discussion 🟡</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{neutralVisits}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Not Interested / Closed 🔴</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{negativeVisits}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, person met, city, remarks..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={filterOutcome}
            onChange={e => setFilterOutcome(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="all">All Outcomes</option>
            <option value="positive">Positive 🟢</option>
            <option value="neutral">Neutral / Follow-up 🟡</option>
            <option value="negative">Not Interested 🔴</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Customer &amp; Date</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Discussion &amp; Requirements</th>
                <th className="px-4 py-3">Next Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Loading visit logs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No visit logs found.
                  </td>
                </tr>
              ) : (
                filtered.map((v, idx) => {
                  const outcomeLower = getNormalizedOutcome(v);
                  const phone = v.contact_phone || (v as any).phone || (v as any).customer_phone || (v as any).contact_no || '-';
                  const loc = v.location || (v as any).city || (v as any).customer_address || '-';
                  const rawRemarks = v.raw_remarks || v.remarks || '';

                  // Structured Requirement Extraction
                  const reqMatch =
                    v.material_requirement ||
                    (v as any).requirement ||
                    rawRemarks.match(/\[Requirement:\s*([^\]]+)\]/i)?.[1] ||
                    rawRemarks.match(/\[Interests:\s*([^\]]+)\]/i)?.[1] ||
                    null;

                  // Follow-up Action Extraction
                  const followUp =
                    v.follow_up_action ||
                    (v as any).follow_up ||
                    (v as any).followup ||
                    rawRemarks.match(/\[FollowUp:\s*([^\]]+)\]/i)?.[1] ||
                    rawRemarks.match(/\[Follow-up:\s*([^\]]+)\]/i)?.[1] ||
                    (rawRemarks.match(/\[Interests:\s*([^\]]+)\]/i)?.[1]
                      ? `Follow-up on ${rawRemarks.match(/\[Interests:\s*([^\]]+)\]/i)?.[1]} requirement`
                      : null) ||
                    '-';

                  // Clean Remarks (strip bracket metadata tags for clear, human-readable display)
                  const cleanRemarks =
                    rawRemarks
                      .replace(
                        /\[(Outcome|Requirement|FollowUp|Follow-up|Interests|Location):\s*[^\]]+\]\s*/gi,
                        '',
                      )
                      .trim() || rawRemarks || '-';

                  return (
                    <tr key={v.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Customer & Date */}
                      <td className="px-4 py-3.5 min-w-[180px]">
                        <div className="font-bold text-slate-900 text-sm">{v.customer_name || 'Customer'}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>📅 {v.visited_at ? new Date(v.visited_at).toLocaleDateString('en-IN') : '-'}</span>
                          {loc && loc !== '-' && (
                            <span className="flex items-center gap-1">
                              • <Map size={11} className="text-slate-400 shrink-0" /> {loc}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Contact Details */}
                      <td className="px-4 py-3.5 text-xs min-w-[150px]">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          {v.person_met && v.person_met !== 'null' ? v.person_met : '-'}
                        </div>
                        {phone && phone !== '-' && (
                          <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <Phone size={11} className="text-slate-400 shrink-0" /> {phone}
                          </div>
                        )}
                      </td>

                      {/* 3. Outcome */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {outcomeLower === 'positive' ? (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                            Positive 🟢
                          </span>
                        ) : outcomeLower === 'neutral' ? (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                            Neutral 🟡
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 inline-flex items-center gap-1">
                            Closed 🔴
                          </span>
                        )}
                      </td>

                      {/* 4. Discussion & Requirements */}
                      <td className="px-4 py-3.5 text-xs max-w-md">
                        {reqMatch && (
                          <div className="mb-1">
                            <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px]">
                              📦 {reqMatch}
                            </span>
                          </div>
                        )}
                        <p className="text-slate-700 leading-relaxed break-words whitespace-normal">
                          {cleanRemarks}
                        </p>
                      </td>

                      {/* 5. Next Action */}
                      <td className="px-4 py-3.5 text-xs whitespace-normal min-w-[160px]">
                        {followUp && followUp !== '-' ? (
                          <span className="font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 text-xs">
                            📅 {followUp}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Visit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="text-emerald-600" size={20} />
                Log Customer Field Visit
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateVisit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vardhman Steels"
                  value={formCustomerName}
                  onChange={e => setFormCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Person Met</label>
                  <input
                    type="text"
                    placeholder="e.g. Suresh Patel"
                    value={formPersonMet}
                    onChange={e => setFormPersonMet(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 9822012345"
                    value={formContactPhone}
                    onChange={e => setFormContactPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Chakan, Pune"
                    value={formLocation}
                    onChange={e => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Visit Date</label>
                  <input
                    type="date"
                    value={formVisitDate}
                    onChange={e => setFormVisitDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Visit Outcome</label>
                  <select
                    value={formOutcome}
                    onChange={e => setFormOutcome(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    <option value="positive">Positive 🟢</option>
                    <option value="neutral">Neutral 🟡</option>
                    <option value="negative">Negative 🔴</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-up Action</label>
                  <input
                    type="text"
                    placeholder="e.g. Send rate quotation"
                    value={formFollowup}
                    onChange={e => setFormFollowup(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meeting Remarks &amp; Requirements</label>
                <textarea
                  rows={2}
                  placeholder="Details of discussion, product requirements..."
                  value={formRemarks}
                  onChange={e => setFormRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Save Visit Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
