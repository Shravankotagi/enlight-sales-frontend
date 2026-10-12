import { ArrowLeft } from 'lucide-react';

interface SalespersonContextBannerProps {
  name: string;
  onBack: () => void;
}

export default function SalespersonContextBanner({ name, onBack }: SalespersonContextBannerProps) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
        Viewing as: {name}
      </span>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
      >
        <ArrowLeft size={13} /> Back to Admin Overview
      </button>
    </div>
  );
}
