import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  startIndex?: number;
  endIndex?: number;
  itemLabel?: string;
  className?: string;
  showItemCount?: boolean;
}

export function getPaginationRange(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // Near the beginning: [1, 2, 3, 4, 5, '...', totalPages]
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }

  // Near the end: [1, '...', totalPages-4, totalPages-3, totalPages-2, totalPages-1, totalPages]
  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  // In the middle: [1, '...', currentPage-1, currentPage, currentPage+1, '...', totalPages]
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export default function PaginationControl({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  startIndex,
  endIndex,
  itemLabel = 'items',
  className = '',
  showItemCount = true,
}: PaginationControlProps) {
  if (totalPages <= 0) return null;

  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginationRange = getPaginationRange(validCurrentPage, totalPages);

  const calculatedStart = startIndex !== undefined ? startIndex : 0;
  const calculatedEnd = endIndex !== undefined ? endIndex : 0;
  const calculatedTotal = totalItems !== undefined ? totalItems : 0;

  return (
    <div
      className={`shrink-0 px-5 py-3.5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 ${className}`}>
      {showItemCount && (
        <div className="font-medium text-slate-600">
          Showing{' '}
          <span className="font-bold text-slate-900">
            {calculatedTotal === 0 ? 0 : calculatedStart}
          </span>{' '}
          to <span className="font-bold text-slate-900">{calculatedEnd}</span> of{' '}
          <span className="font-bold text-slate-900">{calculatedTotal}</span> {itemLabel}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {/* Prev Button */}
        <button
          type="button"
          disabled={validCurrentPage <= 1}
          onClick={() => onPageChange(Math.max(1, validCurrentPage - 1))}
          className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer flex items-center gap-1">
          <ChevronLeft size={14} className="text-slate-500" />
          <span>Prev</span>
        </button>

        {/* Page Blocks & Ellipsis */}
        <div className="flex items-center gap-1.5">
          {paginationRange.map((item, index) => {
            if (typeof item === 'string') {
              return (
                <div
                  key={`ellipsis-${index}`}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 font-bold text-xs select-none tracking-wider">
                  ...
                </div>
              );
            }

            const pageNum = item as number;
            const isActive = pageNum === validCurrentPage;

            return (
              <button
                key={`page-${pageNum}`}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                  isActive
                    ? 'bg-[#004d71] text-white shadow-xs font-bold'
                    : 'bg-[#eef3f7] hover:bg-[#dfe9f2] text-slate-700 font-semibold border border-slate-200/60 hover:border-slate-300'
                }`}>
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          disabled={validCurrentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, validCurrentPage + 1))}
          className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer flex items-center gap-1">
          <span>Next</span>
          <ChevronRight size={14} className="text-slate-500" />
        </button>
      </div>
    </div>
  );
}
