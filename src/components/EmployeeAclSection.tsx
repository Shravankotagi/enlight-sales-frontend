import React from 'react';
import {
  getRoleTemplate,
  countOverrides,
} from '../utils/aclConstants';
import { ZohoPermissionsTable } from './ZohoPermissionsTable';
import {
  RotateCcw,
  Sliders,
  Check,
} from 'lucide-react';

interface EmployeeAclSectionProps {
  role: string;
  permissions: Record<string, boolean>;
  onChange: (updated: Record<string, boolean>) => void;
}

export const EmployeeAclSection: React.FC<EmployeeAclSectionProps> = ({
  role,
  permissions,
  onChange,
}) => {
  const template = getRoleTemplate(role);
  const overrides = countOverrides(role, permissions);

  const handleResetToTemplate = () => {
    onChange({ ...template });
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3.5">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Sliders size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Role &amp; Permissions (Zoho-Style ACL)
              </h4>
              {overrides > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Custom ACL ({overrides} user override{overrides > 1 ? 's' : ''})
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Check size={11} /> Standard Template
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Permissions loaded from <strong className="capitalize">{role.replace('_', ' ')}</strong> template. Click any bubble or checkbox to customize for this user.
            </p>
          </div>
        </div>

        {overrides > 0 && (
          <button
            type="button"
            onClick={handleResetToTemplate}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset to Role Template</span>
          </button>
        )}
      </div>

      {/* Zoho Books Table Grid for this Employee */}
      <div className="max-h-[380px] overflow-y-auto pr-1">
        <ZohoPermissionsTable
          permissions={permissions}
          onChange={onChange}
        />
      </div>
    </div>
  );
};
