import {
  CheckCircle2,
  Edit3,
  XCircle,
  Menu,
  RotateCw,
  ArrowRight,
} from 'lucide-react';

export interface InteractiveButton {
  id: string;
  title: string;
  payload?: string;
}

interface InteractiveButtonsProps {
  buttons: InteractiveButton[];
  onSelect: (payload: string, title: string) => void;
  disabled?: boolean;
}

export default function InteractiveButtons({
  buttons,
  onSelect,
  disabled = false,
}: InteractiveButtonsProps) {
  if (!Array.isArray(buttons) || buttons.length === 0) return null;

  const getButtonConfig = (btn: InteractiveButton) => {
    const id = (btn.id || '').toLowerCase();
    const title = (btn.title || '').toLowerCase();

    // 1. Confirm / Yes / Save
    if (
      id.includes('confirm_yes') ||
      id.includes('cust_yes') ||
      id.includes('resume_yes') ||
      title.includes('yes') ||
      title.includes('save') ||
      title.includes('confirm')
    ) {
      return {
        icon: CheckCircle2,
        className: disabled
          ? 'bg-gray-100 text-gray-400 border-gray-200'
          : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-xs hover:shadow-sm active:scale-98',
        payload: btn.payload || 'yes',
      };
    }

    // 2. Edit Details
    if (id.includes('edit') || title.includes('edit')) {
      return {
        icon: Edit3,
        className: disabled
          ? 'bg-gray-100 text-gray-400 border-gray-200'
          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-2xs hover:shadow-xs active:scale-98',
        payload: btn.payload || 'edit',
      };
    }

    // 3. Cancel / Discard / No
    if (
      id.includes('cancel') ||
      id.includes('cust_no') ||
      title.includes('cancel') ||
      title.includes('discard') ||
      title.includes('no')
    ) {
      return {
        icon: XCircle,
        className: disabled
          ? 'bg-gray-100 text-gray-400 border-gray-200'
          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-2xs hover:shadow-xs active:scale-98',
        payload: btn.payload || 'cancel',
      };
    }

    // 4. Main Menu / Options
    if (
      id.includes('post_menu') ||
      id.includes('resume_no') ||
      title.includes('menu')
    ) {
      return {
        icon: Menu,
        className: disabled
          ? 'bg-gray-100 text-gray-400 border-gray-200'
          : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 shadow-2xs hover:shadow-xs active:scale-98',
        payload: btn.payload || 'menu',
      };
    }

    // 5. Repeat Actions / Log Another
    if (id.includes('repeat') || title.includes('another') || title.includes('log')) {
      return {
        icon: RotateCw,
        className: disabled
          ? 'bg-gray-100 text-gray-400 border-gray-200'
          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 shadow-2xs hover:shadow-xs active:scale-98',
        payload: btn.payload || btn.id,
      };
    }

    // 6. Default Fallback
    return {
      icon: ArrowRight,
      className: disabled
        ? 'bg-gray-100 text-gray-400 border-gray-200'
        : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-300 shadow-2xs hover:shadow-xs active:scale-98',
      payload: btn.payload || btn.id || btn.title,
    };
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-gray-100">
      {buttons.map((btn, idx) => {
        const config = getButtonConfig(btn);
        const Icon = config.icon;

        return (
          <button
            key={btn.id || idx}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(config.payload, btn.title)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              config.className
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            title={btn.title}
          >
            <Icon size={14} className="shrink-0" />
            <span>{btn.title}</span>
          </button>
        );
      })}
    </div>
  );
}
