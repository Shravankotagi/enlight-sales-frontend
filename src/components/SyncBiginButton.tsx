import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { zohoApi } from '../lib/api';

export default function SyncBiginButton({
  show = true,
  onSynced,
}: {
  show?: boolean;
  onSynced?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (!show) return null;

  const run = async () => {
    try {
      setBusy(true);
      const res = await zohoApi.pullInitialSync();
      const data = res?.data?.data || res?.data || {};
      const notice = Array.isArray(data.errors) ? data.errors[0] : '';
      if (data.success === false || (notice && !data.companiesImported && !data.dealsImported)) {
        toast.error(notice || 'Could not sync with Zoho Bigin');
        return;
      }
      toast.success(
        `Bigin customers synced. Created: ${data.recordsCreated ?? data.companiesImported ?? 0}, Updated: ${data.recordsUpdated ?? 0}, Skipped: ${data.recordsSkipped ?? 0}.`,
      );
      await onSynced?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not sync with Zoho Bigin');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={run}
      className="h-9 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
    >
      <RefreshCw size={14} className={busy ? 'animate-spin text-blue-600' : 'text-slate-500'} />
      <span>{busy ? 'Syncing with Bigin...' : 'Sync Bigin'}</span>
    </button>
  );
}
