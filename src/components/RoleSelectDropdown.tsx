import React, { useState, useRef, useEffect } from 'react';
import { getAllRoles, type RoleItem } from '../utils/aclConstants';
import { ChevronDown, Search, Check, Shield } from 'lucide-react';

interface RoleSelectDropdownProps {
  value: string;
  onChange: (roleId: string) => void;
  roles?: RoleItem[];
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const RoleSelectDropdown: React.FC<RoleSelectDropdownProps> = ({
  value,
  onChange,
  roles: propRoles,
  label = 'Role',
  required = true,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [rolesList, setRolesList] = useState<RoleItem[]>(propRoles || getAllRoles());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync roles if updated externally or via custom event
  useEffect(() => {
    if (propRoles) {
      setRolesList(propRoles);
    } else {
      setRolesList(getAllRoles());
    }

    const handleRolesUpdated = () => {
      setRolesList(propRoles || getAllRoles());
    };
    window.addEventListener('enlight_roles_updated', handleRolesUpdated);
    return () => window.removeEventListener('enlight_roles_updated', handleRolesUpdated);
  }, [propRoles]);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const selectedRole = rolesList.find(
    (r) =>
      r.id === value ||
      (value === 'manager' && r.id === 'sales_manager'),
  );

  const filteredRoles = rolesList.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.id.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Main Select Button (Matching Image 2) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 bg-white border border-blue-500/80 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 flex items-center justify-between transition-all cursor-pointer shadow-2xs"
      >
        <div className="flex items-center gap-2 truncate">
          <Shield size={15} className="text-blue-600 shrink-0" />
          <span className="font-semibold text-slate-900 truncate">
            {selectedRole ? selectedRole.name : value || 'Select Role'}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-blue-600 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu (Matching Image 2) */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Roles List */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredRoles.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-slate-400">
                No roles match &quot;{search}&quot;
              </div>
            ) : (
              filteredRoles.map((role) => {
                const isSelected =
                  role.id === value ||
                  (value === 'manager' && role.id === 'sales_manager');

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      onChange(role.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <div className="truncate">
                      <span>{role.name}</span>
                      {!role.isSystem && (
                        <span
                          className={`ml-1.5 text-[10px] px-1 py-0.2 rounded font-normal ${
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          Custom
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={14} className="shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
