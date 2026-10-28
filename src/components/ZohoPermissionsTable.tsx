import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { cascadeCrudPermission, SCOPE_ASSIGNED_PROMPTS, ZOHO_ACL_SECTIONS } from '../utils/aclConstants';
import { Check, Minus } from 'lucide-react';

function TruncatedLabel({ text }: { text: string }) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  return (
    <span
      className="text-[11px] text-slate-600 truncate max-w-[140px]"
      onMouseEnter={(event) => {
        const el = event.currentTarget;
        if (el.scrollWidth <= el.clientWidth) return;
        const box = el.getBoundingClientRect();
        setTip({ x: box.left + box.width / 2, y: box.top });
      }}
      onMouseLeave={() => setTip(null)}
    >
      {text}
      {tip &&
        createPortal(
          <span
            className="fixed z-[80] max-w-xs -translate-x-1/2 -translate-y-full whitespace-normal rounded-md bg-slate-900 px-2 py-1 text-left text-[11px] font-normal leading-snug text-white shadow-lg pointer-events-none"
            style={{ left: tip.x, top: tip.y - 6 }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}

interface ZohoPermissionsTableProps {
  permissions: Record<string, boolean>;
  onChange: (updated: Record<string, boolean>) => void;
  readOnly?: boolean;
  users?: { id: string; name: string; employee_id?: string }[];
  visibilityScope?: Record<string, string[]>;
  onVisibilityChange?: (next: Record<string, string[]>) => void;
}

export const ZohoPermissionsTable: React.FC<ZohoPermissionsTableProps> = ({
  permissions,
  onChange,
  readOnly = false,
  users = [],
  visibilityScope = {},
  onVisibilityChange,
}) => {
  const [picker, setPicker] = useState<{ key: string; selected: string[] } | null>(null);
  const clearInquiryDependents = (
    updated: Record<string, boolean>,
    key: string,
    next: boolean,
  ) => {
    if (next) return updated;
    if (key === 'inquiries.view') {
      for (const dependent of [
        'inquiries.manage',
        'inquiries.edit',
        'inquiries.delete',
        'inquiries.send_quote',
        'inquiries.scope_assigned',
      ]) {
        updated[dependent] = false;
      }
    }
    return updated;
  };

  const toggleKey = (key: string) => {
    if (readOnly) return;
    const prompt = SCOPE_ASSIGNED_PROMPTS[key];
    if (prompt && permissions[key] && onVisibilityChange) {
      setPicker({
        key,
        selected: [...(visibilityScope[prompt.module] || [])],
      });
      return;
    }
    const next = !permissions[key];
    const updated = cascadeCrudPermission(permissions, key, next);
    if (!next) {
      clearInquiryDependents(updated, key, false);
      if (!updated['inquiries.edit']) {
        clearInquiryDependents(updated, 'inquiries.edit', false);
      }
      if (!updated['inquiries.view']) {
        clearInquiryDependents(updated, 'inquiries.view', false);
      }
    }
    onChange(updated);
  };

  const handleToggleFullRow = (crudKeys: {
    view: string;
    create: string;
    edit: string;
    delete: string;
  }) => {
    if (readOnly) return;
    const allActive =
      Boolean(permissions[crudKeys.view]) &&
      Boolean(permissions[crudKeys.create]) &&
      Boolean(permissions[crudKeys.edit]) &&
      Boolean(permissions[crudKeys.delete]);

    const targetVal = !allActive;
    let updated = { ...permissions };
    for (const key of [crudKeys.view, crudKeys.create, crudKeys.edit, crudKeys.delete]) {
      updated = cascadeCrudPermission(updated, key, targetVal);
    }
    if (!targetVal && crudKeys.view === 'inquiries.view') {
      clearInquiryDependents(updated, 'inquiries.view', false);
    }
    onChange(updated);
  };

  const renderBubble = (
    checked: boolean,
    indeterminate: boolean,
    onClick: () => void,
    disabled = false,
  ) => {
    return (
      <button
        type="button"
        disabled={disabled || readOnly}
        onClick={onClick}
        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
          disabled || readOnly ? 'cursor-default' : 'cursor-pointer'
        } ${
          checked || indeterminate
            ? 'bg-blue-600 text-white shadow-2xs hover:bg-blue-700'
            : 'border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50'
        }`}
      >
        {checked ? (
          <Check size={13} strokeWidth={3} />
        ) : indeterminate ? (
          <Minus size={13} strokeWidth={3} />
        ) : null}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {picker &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">
                  Whose else {SCOPE_ASSIGNED_PROMPTS[picker.key]?.noun} should this user see?
                </h3>
              </div>
              <div className="max-h-72 overflow-y-auto px-5 py-3 space-y-2">
                {users.length === 0 && (
                  <p className="text-xs text-slate-500">No users are available.</p>
                )}
                {users.map((user) => {
                  const checked = picker.selected.includes(user.id);
                  return (
                    <label key={user.id} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setPicker((current) =>
                            current
                              ? {
                                  ...current,
                                  selected: checked
                                    ? current.selected.filter((id) => id !== user.id)
                                    : [...current.selected, user.id],
                                }
                              : current,
                          )
                        }
                      />
                      <span>
                        {user.name}
                        {user.employee_id ? ` (${user.employee_id})` : ''}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600"
                  onClick={() => setPicker(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                  onClick={() => {
                    const prompt = SCOPE_ASSIGNED_PROMPTS[picker.key];
                    if (prompt && onVisibilityChange) {
                      onVisibilityChange({
                        ...visibilityScope,
                        [prompt.module]: picker.selected,
                      });
                    }
                    const updated = cascadeCrudPermission(permissions, picker.key, false);
                    onChange(updated);
                    setPicker(null);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {ZOHO_ACL_SECTIONS.map((section) => (
        <div
          key={section.id}
          className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs"
        >
          {/* Section Title Header (Matching Image 2) */}
          <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {section.title}
            </h4>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-slate-600 font-bold">
                  <th className="py-3 px-5 w-1/4">Particulars</th>
                  <th className="py-3 px-3 text-center w-12">Full</th>
                  <th className="py-3 px-3 text-center w-12">View</th>
                  <th className="py-3 px-3 text-center w-12">Create</th>
                  <th className="py-3 px-3 text-center w-12">Edit</th>
                  <th className="py-3 px-3 text-center w-12">Delete</th>
                  <th className="py-3 px-4 text-center w-36">
                    {section.rows[0]?.otherAction?.headerLabel || 'Special Action'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {section.rows.map((row) => {
                  const isView = Boolean(permissions[row.crud.view]);
                  const isCreate = Boolean(permissions[row.crud.create]);
                  const isEdit = Boolean(permissions[row.crud.edit]);
                  const isDelete = Boolean(permissions[row.crud.delete]);

                  const activeCount =
                    (isView ? 1 : 0) +
                    (isCreate ? 1 : 0) +
                    (isEdit ? 1 : 0) +
                    (isDelete ? 1 : 0);

                  const isFullChecked = activeCount === 4;
                  const isFullIndeterminate = activeCount > 0 && activeCount < 4;

                  return (
                    <React.Fragment key={row.id}>
                      {/* Primary Particular Row */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-5 font-bold text-slate-900">
                          {row.name}
                        </td>

                        {/* Full Bubble */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex justify-center">
                            {renderBubble(
                              isFullChecked,
                              isFullIndeterminate,
                              () => handleToggleFullRow(row.crud),
                            )}
                          </div>
                        </td>

                        {/* View Bubble */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex justify-center">
                            {renderBubble(isView, false, () =>
                              toggleKey(row.crud.view),
                            )}
                          </div>
                        </td>

                        {/* Create Bubble */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex justify-center">
                            {renderBubble(isCreate, false, () =>
                              toggleKey(row.crud.create),
                            )}
                          </div>
                        </td>

                        {/* Edit Bubble */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex justify-center">
                            {renderBubble(isEdit, false, () =>
                              toggleKey(row.crud.edit),
                            )}
                          </div>
                        </td>

                        {/* Delete Bubble */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex justify-center">
                            {renderBubble(isDelete, false, () =>
                              toggleKey(row.crud.delete),
                            )}
                          </div>
                        </td>

                        {/* Special Action (e.g. Assign owner / Send Quote) */}
                        <td className="py-3 px-4 text-center">
                          {row.otherAction ? (
                            <div className="flex items-center justify-center gap-2">
                              {renderBubble(
                                Boolean(permissions[row.otherAction.key]),
                                false,
                                () => toggleKey(row.otherAction!.key),
                              )}
                              <TruncatedLabel text={row.otherAction.label} />
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Sub-options Rows (Indented with description, Matching Image 2) */}
                      {row.subOptions && row.subOptions.length > 0 && (
                        <tr className="bg-slate-50/40">
                          <td colSpan={7} className="py-2.5 px-5 pl-10 border-t border-slate-100">
                            <div className="space-y-1.5">
                              {row.subOptions.map((sub) => {
                                const isSubActive = Boolean(permissions[sub.key]);
                                return (
                                  <label
                                    key={sub.key}
                                    className={`flex items-center gap-2.5 cursor-pointer select-none text-slate-700 text-xs hover:text-slate-900 transition-colors py-0.5 ${
                                      readOnly ? 'cursor-default' : ''
                                    }`}
                                  >
                                    {renderBubble(isSubActive, false, () =>
                                      toggleKey(sub.key),
                                    )}
                                    <span className={isSubActive ? 'font-medium text-slate-900' : 'text-slate-600'}>
                                      {sub.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
