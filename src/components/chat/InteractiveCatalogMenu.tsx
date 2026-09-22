import {
  FilePlus,
  FileEdit,
  ShoppingCart,
  PackageCheck,
  MapPin,
  CalendarCheck,
  UserPlus,
  AlertCircle,
  CheckSquare,
  HelpCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export interface CatalogMenuRow {
  id: string;
  title: string;
  description?: string;
}

export interface CatalogMenuSection {
  title: string;
  rows: CatalogMenuRow[];
}

export interface InteractiveListData {
  bodyText?: string;
  buttonText?: string;
  sections?: CatalogMenuSection[];
}

interface InteractiveCatalogMenuProps {
  interactiveList: InteractiveListData;
  onSelect: (payload: string, title: string) => void;
  disabled?: boolean;
}

export default function InteractiveCatalogMenu({
  interactiveList,
  onSelect,
  disabled = false,
}: InteractiveCatalogMenuProps) {
  const sections = interactiveList.sections || [];
  if (!Array.isArray(sections) || sections.length === 0) return null;

  const getRowIcon = (id: string, title: string) => {
    const key = `${id} ${title}`.toLowerCase();
    if (key.includes('1') || key.includes('log new inquiry') || key.includes('log inquiry')) return FilePlus;
    if (key.includes('2') || key.includes('update inquiry')) return FileEdit;
    if (key.includes('3') || key.includes('log new order') || key.includes('log order')) return ShoppingCart;
    if (key.includes('4') || key.includes('update order')) return PackageCheck;
    if (key.includes('5') || key.includes('field visit') || key.includes('log visit')) return MapPin;
    if (key.includes('6') || key.includes('update field visit') || key.includes('update visit')) return CalendarCheck;
    if (key.includes('7') || key.includes('new customer') || key.includes('acquisition')) return UserPlus;
    if (key.includes('8') || key.includes('log complaint')) return AlertCircle;
    if (key.includes('9') || key.includes('update complaint')) return CheckSquare;
    if (key.includes('10') || key.includes('general query') || key.includes('query')) return HelpCircle;
    return Sparkles;
  };

  const getSectionBadgeStyle = (sectionTitle: string) => {
    const t = sectionTitle.toLowerCase();
    if (t.includes('inquir') || t.includes('order')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (t.includes('visit') || t.includes('customer')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (t.includes('complaint') || t.includes('quer')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-4 pt-3 mt-2 border-t border-gray-100 w-full max-w-2xl">
      {sections.map((sec, sIdx) => {
        const badgeStyle = getSectionBadgeStyle(sec.title || '');

        return (
          <div key={sec.title || sIdx} className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeStyle}`}
              >
                {sec.title}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(sec.rows || []).map((row, rIdx) => {
                const Icon = getRowIcon(row.id || '', row.title || '');
                const rawNum = row.id ? row.id.replace(/^menu_/, '') : String(rIdx + 1);

                return (
                  <button
                    key={row.id || rIdx}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(rawNum, row.title)}
                    className={`flex items-start gap-2.5 p-2.5 text-left rounded-xl border transition-all ${
                      disabled
                        ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                        : 'bg-white hover:bg-blue-50/70 border-gray-200 hover:border-blue-300 shadow-2xs hover:shadow-xs active:scale-98 cursor-pointer group'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 transition-colors ${
                        disabled
                          ? 'bg-gray-100 text-gray-400'
                          : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                      }`}
                    >
                      <Icon size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold leading-tight truncate ${
                            disabled
                              ? 'text-gray-500'
                              : 'text-gray-900 group-hover:text-blue-700'
                          }`}
                        >
                          {row.title}
                        </span>
                        {!disabled && (
                          <ChevronRight
                            size={14}
                            className="text-gray-300 group-hover:text-blue-600 transition-colors shrink-0 ml-1"
                          />
                        )}
                      </div>
                      {row.description && (
                        <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                          {row.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
