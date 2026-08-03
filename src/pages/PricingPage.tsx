import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pricingApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { Tag, Lock, Plus, Save } from 'lucide-react';

import toast from 'react-hot-toast';

const CATEGORIES = ['HR Coil', 'MS Sheet', 'MS Flat', 'TMT Bars', 'Structural'];

interface RateRow {
  sku_text: string;
  category: string;
  price_per_kg: string;
  price_per_mt: string;
}

function emptyRow(): RateRow {
  return { sku_text: '', category: '', price_per_kg: '', price_per_mt: '' };
}

export default function PricingPage() {
  const [tab, setTab] = useState<'rate' | 'margins'>('rate');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<RateRow[]>([...Array(5)].map(() => emptyRow()));
  const { employee } = useAuth();
  const isAdmin = employee?.role === 'admin';
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = 'Pricing — Enlight Sales OS';
  }, []);

  const { data: todaySheet, isLoading: sheetLoading } = useQuery({
    queryKey: ['pricing-today'],
    queryFn: () => pricingApi.getToday().then(r => r.data.data),
  });

  const { data: margins, isLoading: marginsLoading } = useQuery({
    queryKey: ['floor-margins'],
    queryFn: () => pricingApi.getFloorMargins().then(r => r.data.data),
    enabled: tab === 'margins',
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const items = rows
        .filter(r => r.sku_text.trim())
        .map(r => ({
          sku_text: r.sku_text,
          category: r.category,
          price_per_kg: r.price_per_kg ? parseFloat(r.price_per_kg) : null,
          price_per_mt: r.price_per_mt ? parseFloat(r.price_per_mt) : null,
        }));
      return pricingApi.createRateSheet(items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-today'] });
      toast.success('Rate sheet created');
      setCreating(false);
    },
    onError: () => toast.error('Failed to create rate sheet'),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const items = rows
        .filter(r => r.sku_text.trim())
        .map(r => ({
          sku_text: r.sku_text,
          category: r.category,
          price_per_kg: r.price_per_kg ? parseFloat(r.price_per_kg) : null,
          price_per_mt: r.price_per_mt ? parseFloat(r.price_per_mt) : null,
        }));
      return pricingApi.updateRateSheet(todaySheet.id, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-today'] });
      toast.success('Rate sheet updated and unlocked');
      setCreating(false);
      setEditing(false);
    },
    onError: () => toast.error('Failed to update rate sheet'),
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => pricingApi.lockRateSheet(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-today'] });
      toast.success('Rate sheet locked!');
    },
    onError: () => toast.error('Failed to lock rate sheet'),
  });

  const marginMutation = useMutation({
    mutationFn: ({ id, floor_pct }: { id: string; floor_pct: number }) =>
      pricingApi.updateFloorMargin(id, floor_pct),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor-margins'] });
      toast.success('Floor margin updated');
    },
    onError: () => toast.error('Failed to update margin'),
  });

  const updateRow = (i: number, field: keyof RateRow, value: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const handleStartEdit = () => {
    if (todaySheet?.rate_sheet_items) {
      setRows(
        todaySheet.rate_sheet_items.map((item: any) => ({
          sku_text: item.sku_text || '',
          category: item.category || '',
          price_per_kg: item.price_per_kg !== null ? String(item.price_per_kg) : '',
          price_per_mt: item.price_per_mt !== null ? String(item.price_per_mt) : '',
        }))
      );
    } else {
      setRows([...Array(5)].map(() => emptyRow()));
    }
    setCreating(true);
    setEditing(true);
  };

  const formatLockedBy = (lockedBy: string) => {
    if (lockedBy === '919187305823') return 'Shravan';
    return lockedBy;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Tag size={22} className="text-blue-500" /> Pricing
        </h1>
        <p className="text-gray-500 text-sm">Manage daily rate sheets and floor margins</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'rate', label: 'Rate Sheet' },
          { key: 'margins', label: 'Floor Margins' },
        ].map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key as 'rate' | 'margins')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1 — RATE SHEET */}
      {tab === 'rate' && (
        sheetLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded-xl" />
            ))}
          </div>
        ) : (
          <div>
            {todaySheet && !creating ? (
              <div>
                {/* Locked/Unlocked status */}
                <div className="flex items-center justify-between mb-4">
                  {todaySheet.locked_at ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
                        <Lock size={16} />
                        Locked at {new Date(todaySheet.locked_at).toLocaleTimeString('en-IN')} by {formatLockedBy(todaySheet.locked_by)}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={handleStartEdit}
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                          Edit Rate Sheet
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-orange-600 font-medium bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                        ⚠ Not locked yet
                      </span>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => lockMutation.mutate(todaySheet.id)}
                            disabled={lockMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            <Lock size={14} /> Lock Rate Sheet
                          </button>
                          <button
                            onClick={handleStartEdit}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            Edit Rate Sheet
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-gray-500">
                    {todaySheet.rate_sheet_items?.length || 0} items for {new Date(todaySheet.date).toLocaleDateString('en-IN')}
                  </p>
                </div>

                {/* Rate sheet table */}
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {['SKU', 'Category', 'Price/KG (₹)', 'Price/MT (₹)'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(todaySheet.rate_sheet_items || []).map((item: any) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{item.sku_text}</td>
                          <td className="px-4 py-3 text-gray-600">
                            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{item.category || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-800 font-medium">
                            {item.price_per_kg ? `₹${item.price_per_kg}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-800 font-medium">
                            {item.price_per_mt ? `₹${Number(item.price_per_mt).toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : !creating ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                <Tag size={40} className="mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-700 mb-1">No rate sheet for today</h3>
                <p className="text-gray-400 text-sm mb-4">Create today's rate sheet to enable quoting</p>
                {isAdmin && (
                  <button
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors mx-auto"
                  >
                    <Plus size={16} /> Create Rate Sheet
                  </button>
                )}
              </div>
            ) : (
              /* Create form */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-800">
                    {editing ? 'Edit Rate Sheet' : 'New Rate Sheet'} — {new Date().toLocaleDateString('en-IN')}
                  </h2>
                  <button onClick={() => { setCreating(false); setEditing(false); }} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
                <div className="border rounded-xl overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {['SKU Text', 'Category', 'Price/KG (₹)', 'Price/MT (₹)'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">
                            <input
                              value={row.sku_text}
                              onChange={e => updateRow(i, 'sku_text', e.target.value)}
                              placeholder="e.g. HR Coil 2mm"
                              className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.category}
                              onChange={e => updateRow(i, 'category', e.target.value)}
                              className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                            >
                              <option value="">Select...</option>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={row.price_per_kg}
                              onChange={e => updateRow(i, 'price_per_kg', e.target.value)}
                              placeholder="0.00"
                              className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={row.price_per_mt}
                              onChange={e => updateRow(i, 'price_per_mt', e.target.value)}
                              placeholder="0.00"
                              className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRows(prev => [...prev, emptyRow()])}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                  <button
                    onClick={() => {
                      if (editing) {
                        updateMutation.mutate();
                      } else {
                        createMutation.mutate();
                      }
                    }}
                    disabled={editing ? updateMutation.isPending : createMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save size={14} /> Save Rate Sheet
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 2 — FLOOR MARGINS */}
      {tab === 'margins' && (
        !isAdmin ? (
          <div className="text-center py-16 text-gray-400">
            <Lock size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">Admin access required</p>
            <p className="text-sm mt-1">Contact admin to view or edit floor margins</p>
          </div>
        ) : marginsLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Category', 'Floor %', 'Effective From', 'Set By'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(margins || []).map((margin: any) => (
                  <MarginRow key={margin.id} margin={margin} onUpdate={marginMutation.mutate} />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function MarginRow({ margin, onUpdate }: { margin: any; onUpdate: (v: { id: string; floor_pct: number }) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(margin.floor_pct));

  const handleBlur = () => {
    setEditing(false);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed !== margin.floor_pct) {
      onUpdate({ id: margin.id, floor_pct: parsed });
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-800">{margin.category}</td>
      <td className="px-4 py-3">
        {editing ? (
          <input
            autoFocus
            type="number"
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={handleBlur}
            className="w-20 px-2 py-1 border border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            {margin.floor_pct}%
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {margin.effective_from ? new Date(margin.effective_from).toLocaleDateString('en-IN') : '—'}
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">{margin.set_by}</td>
    </tr>
  );
}
