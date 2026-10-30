import React, { useState, useEffect } from 'react';
import {
  getAllRoles,
  DEFAULT_ROLE_TEMPLATES,
  setRolesCache,
  isSystemRoleId,
  type RoleItem,
} from '../utils/aclConstants';
import { ZohoPermissionsTable } from './ZohoPermissionsTable';
import { RoleSelectDropdown } from './RoleSelectDropdown';
import { Select } from './ui/select';
import { employeesApi, rolesApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Shield,
  Users,
  Plus,
  Save,
  Check,
  AlertCircle,
  Search,
  Trash2,
  Phone,
  KeyRound,
  UserPlus,
  Edit2,
  Loader2,
  Mail,
  Lock,
} from 'lucide-react';

interface EmployeeItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  employee_id: string;
  manager_id?: string | null;
  manager_phone?: string | null;
}

interface RolePermissionsMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees?: EmployeeItem[];
  onEmployeeRoleUpdated?: (empId: string, newRole: string) => void;
  asPage?: boolean;
}

export const RolePermissionsMatrixModal: React.FC<
  RolePermissionsMatrixModalProps
> = ({ isOpen, onClose, employees: propEmployees, onEmployeeRoleUpdated, asPage = false }) => {
  const { can } = useAuth();
  // Top 2 Main Tabs: 'roles' vs 'users'
  const [mainTab, setMainTab] = useState<'roles' | 'users'>('roles');

  // Roles Tab State
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('salesperson');
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [cloneFromRoleId, setCloneFromRoleId] = useState('salesperson');
  const [activePermissions, setActivePermissions] = useState<
    Record<string, boolean>
  >({});
  const [visibilityScope, setVisibilityScope] = useState<Record<string, string[]>>({});
  const [dataScope, setDataScope] = useState<'own' | 'team' | 'all'>('own');
  const [localImportCount, setLocalImportCount] = useState(0);
  const [feedback, setFeedback] = useState<{ msg: string; isError?: boolean } | null>(null);

  // Users Tab State
  const [userList, setUserList] = useState<EmployeeItem[]>(propEmployees || []);
  const [userSearch, setUserSearch] = useState('');

  // Invite / Assign Role Modal State (Matching img2 Zoho Books style)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<EmployeeItem | null>(null);
  const [inviteForm, setInviteForm] = useState<{
    name: string;
    email: string;
    phone: string;
    role: string;
    manager_id?: string;
    manager_phone?: string;
  }>({
    name: '',
    email: '',
    phone: '91',
    role: 'salesperson',
    manager_id: '',
    manager_phone: '',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Load roles & employees on open
  useEffect(() => {
    if (isOpen || asPage) {
      rolesApi
        .list()
        .then((res) => {
          const items: RoleItem[] = (Array.isArray(res.data) ? res.data : [])
            .filter((row: any) => row.is_active !== false)
            .map((row: any) => ({
              id: row.id,
              name: row.name,
              description: row.description || '',
              isSystem: Boolean(row.is_system ?? row.isSystem),
              data_scope: row.data_scope || 'own',
              permissions: row.permissions || {},
              visibility_scope: row.visibility_scope || {},
            }));
          if (items.length) {
            setRolesCache(items);
            setRoles(items);
          } else {
            setRoles(getAllRoles());
          }
          const saved = localStorage.getItem('enlight_custom_roles_list');
          const local = saved ? JSON.parse(saved) : [];
          const known = new Set(items.map((role) => role.id));
          setLocalImportCount(
            Array.isArray(local)
              ? local.filter((role: any) => role?.id && !known.has(role.id) && !role.isSystem).length
              : 0,
          );
        })
        .catch(() => setRoles(getAllRoles()));

      if (!propEmployees || propEmployees.length === 0) {
        employeesApi
          .getAll()
          .then((res) => {
            const raw = res?.data;
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            setUserList(list.filter((e: any) => e.is_active !== false));
          })
          .catch((err) => console.warn('Could not load employees in ACL modal', err));
      } else {
        setUserList(propEmployees);
      }
    }
  }, [isOpen, asPage, propEmployees]);

  // Sync active permissions when selected role changes
  useEffect(() => {
    if (isCreatingRole) {
      const source = roles.find((r) => r.id === cloneFromRoleId);
      const base = source?.permissions || DEFAULT_ROLE_TEMPLATES.salesperson;
      setActivePermissions({ ...base });
      setVisibilityScope({ ...(source?.visibility_scope || {}) });
    } else {
      const current = roles.find((r) => r.id === selectedRoleId);
      if (current) {
        setActivePermissions({ ...current.permissions });
        setVisibilityScope({ ...(current.visibility_scope || {}) });
        setDataScope(current.data_scope || (current.id === 'admin' ? 'all' : current.id === 'sales_manager' ? 'team' : 'own'));
      }
    }
  }, [selectedRoleId, isCreatingRole, cloneFromRoleId, roles]);

  if (!isOpen && !asPage) return null;

  const showToast = (msg: string, isError: boolean = false) => {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Roles Tab Actions
  const handleSaveCurrentRolePermissions = async () => {
    if (isCreatingRole) {
      if (!newRoleName.trim()) {
        showToast('Please enter a role name', true);
        return;
      }
      const nameTaken = roles.some(
        (role) =>
          role.name.trim().toLowerCase() === newRoleName.trim().toLowerCase(),
      );
      if (nameTaken) {
        showToast(`A role named "${newRoleName.trim()}" already exists.`, true);
        return;
      }
      try {
        const res = await rolesApi.create({
          name: newRoleName.trim(),
          description: newRoleDesc.trim(),
          data_scope: dataScope,
          permissions: activePermissions,
          visibility_scope: visibilityScope,
        });
        const created = res.data;
        if (!created?.id || !created?.name) {
          showToast('Could not create role', true);
          return;
        }
        const next = [
          ...roles,
          {
            id: created.id,
            name: created.name,
            description: created.description || '',
            isSystem: false,
            data_scope: created.data_scope,
            permissions: created.permissions,
            visibility_scope: created.visibility_scope || {},
          },
        ];
        setRolesCache(next);
        setRoles(next);
        setSelectedRoleId(created.id);
        setIsCreatingRole(false);
        setNewRoleName('');
        setNewRoleDesc('');
        showToast(`Role "${created.name}" created successfully!`);
      } catch (err: any) {
        showToast(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            'Could not create role',
          true,
        );
      }
    } else {
      if (isSystemRoleId(selectedRoleId) || roles.find((r) => r.id === selectedRoleId)?.isSystem) {
        showToast('Default system roles are fixed and non-editable. Create a new custom role to customize permissions.', true);
        return;
      }
      try {
        await rolesApi.update(selectedRoleId, {
          permissions: activePermissions,
          data_scope: dataScope,
          visibility_scope: visibilityScope,
        });
        const next = roles.map((role) =>
          role.id === selectedRoleId
            ? {
                ...role,
                permissions: activePermissions,
                data_scope: dataScope,
                visibility_scope: visibilityScope,
              }
            : role,
        );
        setRolesCache(next);
        setRoles(next);
        showToast('Permissions saved successfully!');
      } catch (err: any) {
        showToast(err?.response?.data?.message || 'Could not save permissions', true);
      }
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this custom role?')) return;
    try {
      const count = await rolesApi.assignees(id);
      if ((count.data?.count || 0) > 0) {
        showToast(`This role is still assigned to ${count.data.count} people.`, true);
        return;
      }
      await rolesApi.remove(id);
      const remaining = roles.filter((role) => role.id !== id);
      setRolesCache(remaining);
      setRoles(remaining);
      setSelectedRoleId(remaining[0]?.id || 'salesperson');
      showToast('Role deleted.');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Could not delete role', true);
    }
  };

  const handleImportLocalRoles = async () => {
    const saved = localStorage.getItem('enlight_custom_roles_list');
    const local = saved ? JSON.parse(saved) : [];
    const known = new Set(roles.map((role) => role.id));
    let imported = 0;
    for (const role of Array.isArray(local) ? local : []) {
      if (!role?.id || role.isSystem || known.has(role.id)) continue;
      try {
        await rolesApi.create({
          name: role.name,
          description: role.description,
          data_scope: 'own',
          permissions: role.permissions || {},
        });
        imported += 1;
      } catch {
        /* skip a role the server rejected */
      }
    }
    localStorage.removeItem('enlight_custom_roles_list');
    localStorage.removeItem('enlight_role_template_salesperson');
    setLocalImportCount(0);
    const res = await rolesApi.list();
    const items = (res.data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      isSystem: Boolean(row.is_system),
      data_scope: row.data_scope,
      permissions: row.permissions || {},
      visibility_scope: row.visibility_scope || {},
    }));
    setRolesCache(items);
    setRoles(items);
    showToast(`Imported ${imported} roles from this browser.`);
  };

  // Open "Invite User" Modal (Matching img2)
  const handleOpenInviteUser = () => {
    if (!can('staff.create')) return;
    setEditingUser(null);
    setInviteForm({
      name: '',
      email: '',
      phone: '91',
      role: roles[0]?.id || 'salesperson',
      manager_id: '',
      manager_phone: '',
    });
    setInviteError('');
    setShowInviteModal(true);
  };

  // Open "Assign Role" Modal for existing user (Matching img2)
  const handleOpenAssignRole = (user: EmployeeItem) => {
    if (!can('staff.manage')) return;
    setEditingUser(user);
    setInviteForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '91',
      role: user.role === 'manager' ? 'sales_manager' : user.role || 'salesperson',
      manager_id: user.manager_id || '',
      manager_phone: user.manager_phone || '',
    });
    setInviteError('');
    setShowInviteModal(true);
  };

  // Save / Invite User (Matching img2)
  const handleSaveInviteUser = async () => {
    if (!inviteForm.name.trim()) {
      setInviteError('Name is required');
      return;
    }
    if (!inviteForm.email.trim()) {
      setInviteError('Email Address is required');
      return;
    }
    const cleanPhone = inviteForm.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 12 || !cleanPhone.startsWith('91')) {
      setInviteError('WhatsApp Number must be 12 digits starting with 91 (e.g. 919876543210)');
      return;
    }
    if (!inviteForm.role) {
      setInviteError('Role is required');
      return;
    }

    if (editingUser && !can('staff.manage')) return;
    if (!editingUser && !can('staff.create')) return;

    setInviteLoading(true);
    setInviteError('');
    try {
      if (editingUser) {
        // Update user role & details
        await employeesApi.update(editingUser.id, {
          name: inviteForm.name.trim(),
          email: inviteForm.email.trim(),
          phone: cleanPhone,
          role: inviteForm.role,
          manager_id: inviteForm.manager_id || null,
          manager_phone: inviteForm.manager_phone || null,
        });

        setUserList((prev) =>
          prev.map((u) =>
            u.id === editingUser.id
              ? {
                  ...u,
                  name: inviteForm.name.trim(),
                  email: inviteForm.email.trim(),
                  phone: cleanPhone,
                  role: inviteForm.role,
                  manager_id: inviteForm.manager_id || null,
                  manager_phone: inviteForm.manager_phone || null,
                }
              : u,
          ),
        );

        if (onEmployeeRoleUpdated) {
          onEmployeeRoleUpdated(editingUser.id, inviteForm.role);
        }
        showToast(`Role updated for ${inviteForm.name}!`);
      } else {
        // Invite new user
        const nextIdRes = await employeesApi.getNextId();
        const nextId =
          nextIdRes?.data?.data?.next_employee_id ||
          nextIdRes?.data?.next_id ||
          'EMP' + Math.floor(100 + Math.random() * 900);

        const res = await employeesApi.create({
          name: inviteForm.name.trim(),
          email: inviteForm.email.trim(),
          phone: cleanPhone,
          role: inviteForm.role,
          employee_id: nextId,
          manager_id: inviteForm.manager_id || null,
          manager_phone: inviteForm.manager_phone || null,
        });

        const createdUser = res?.data?.data || res?.data;
        if (createdUser) {
          const { email_sent: _sent, email_notice: _notice, ...user } = createdUser;
          if (user?.id || user?.employee_id) {
            setUserList((prev) => [...prev, user]);
          }
        }
        const sent = createdUser?.email_sent !== false;
        showToast(
          createdUser?.email_notice ||
            `User ${inviteForm.name} invited successfully!`,
          !sent,
        );
      }

      setShowInviteModal(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save user role';
      setInviteError(msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const filteredUsers = userList.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.employee_id?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  const selectedRoleObj = roles.find((r) => r.id === selectedRoleId);
  const isCurrentRoleSystem =
    !isCreatingRole &&
    (Boolean(selectedRoleObj?.isSystem) || isSystemRoleId(selectedRoleId));

  const salesManagers = userList.filter(
    (u) => u.role === 'sales_manager' || u.role === 'manager',
  );
  const procurementManagers = userList.filter(
    (u) => u.role === 'procurement_manager',
  );

  const availableSalesManagers = salesManagers.filter(
    (m) =>
      !editingUser ||
      (m.id !== editingUser.id &&
        m.employee_id !== editingUser.employee_id &&
        m.phone?.replace(/\D/g, '').slice(-10) !==
          editingUser.phone?.replace(/\D/g, '').slice(-10)),
  );
  const availableProcurementManagers = procurementManagers.filter(
    (m) =>
      !editingUser ||
      (m.id !== editingUser.id &&
        m.employee_id !== editingUser.employee_id &&
        m.phone?.replace(/\D/g, '').slice(-10) !==
          editingUser.phone?.replace(/\D/g, '').slice(-10)),
  );

  return (
    <div className={asPage ? 'w-full min-w-0' : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150'}>
      <div className={asPage
        ? 'bg-white rounded-2xl border border-slate-200 shadow-xs w-full min-w-0 flex flex-col'
        : 'bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150'}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs">
              <KeyRound size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`${asPage ? 'text-2xl tracking-tight' : 'text-base'} font-bold text-slate-900`}>
                  Roles and Permissions
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage roles and permission templates, and invite or assign roles to team members.
              </p>
            </div>
          </div>
          {!asPage && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
          )}
        </div>

        {/* Primary Navigation Tabs */}
        <div className="px-6 pt-3 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMainTab('roles');
                setIsCreatingRole(false);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                mainTab === 'roles'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield size={15} />
              <span>Roles &amp; Permission Templates</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold">
                {roles.length}
              </span>
            </button>

            <button
              onClick={() => setMainTab('users')}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                mainTab === 'users'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users size={15} />
              <span>Users</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold">
                {userList.length}
              </span>
            </button>
          </div>

          {feedback && (
            <div
              className={`text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 animate-in fade-in ${
                feedback.isError
                  ? 'text-rose-700 bg-rose-50 border border-rose-200'
                  : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              }`}
            >
              {feedback.isError ? <AlertCircle size={13} /> : <Check size={13} />}
              <span>{feedback.msg}</span>
            </div>
          )}
        </div>

        {/* TAB 1: ROLES MANAGEMENT */}
        {mainTab === 'roles' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Roles Bar & New Role Button */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Role:
                  </span>
                  <div className="w-72">
                    <RoleSelectDropdown
                      value={isCreatingRole ? '' : selectedRoleId}
                      roles={roles}
                      label=""
                      required={false}
                      onChange={(roleId) => {
                        setIsCreatingRole(false);
                        setSelectedRoleId(roleId);
                      }}
                    />
                  </div>
                  
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  Data scope
                  <Select
                    value={dataScope}
                    disabled={isCurrentRoleSystem}
                    onChange={(event) =>
                      setDataScope(event.target.value as 'own' | 'team' | 'all')
                    }
                    wrapperClassName="inline-flex"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-medium gap-1.5"
                    menuClassName="w-36"
                  >
                    <option value="own">Own records</option>
                    <option value="team">Team records</option>
                    <option value="all">All records</option>
                  </Select>
                </label>
                {localImportCount > 0 && (
                  <button
                    type="button"
                    onClick={handleImportLocalRoles}
                    className="text-xs font-semibold text-indigo-700 underline"
                  >
                    Import {localImportCount} roles saved in this browser
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingRole(true);
                    setNewRoleName('');
                    setNewRoleDesc('');
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                    isCreatingRole
                      ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <Plus size={14} />
                  <span>Create New Role</span>
                </button>
              </div>

              {/* Action buttons for selected role */}
              <div className="flex items-center gap-2">
                {!isCreatingRole && selectedRoleObj && (
                  <>
                    {isCurrentRoleSystem ? (
                      <div
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold border border-slate-200 cursor-not-allowed select-none"
                        title="Default system roles are fixed and non-editable"
                      >
                        <Lock size={12} className="text-slate-400" />
                        <span>Fixed (Non-editable)</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDeleteRole(selectedRoleObj.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Delete Role</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Create New Role Meta Form */}
            {isCreatingRole && (
              <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in">
                <div>
                  <label className="block text-xs font-bold text-indigo-950 uppercase mb-1">
                    Role Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Senior Sales Specialist"
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-950 uppercase mb-1">
                    Description <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    placeholder="e.g. Can view orders and create quotations"
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-950 uppercase mb-1">
                    Clone Baseline From
                  </label>
                  <Select
                    value={cloneFromRoleId}
                    onChange={(e) => setCloneFromRoleId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer font-medium"
                    menuClassName="w-full"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}

            {/* Permissions Table */}
            <div className={`p-4 sm:p-6 space-y-4 overflow-x-auto ${asPage ? '' : 'overflow-y-auto flex-1'}`}>
              

              <ZohoPermissionsTable
                permissions={activePermissions}
                onChange={setActivePermissions}
                readOnly={isCurrentRoleSystem}
              />
            </div>
          </div>
        )}

        {/* TAB 2: USERS & ROLE ASSIGNMENT (Zoho Books Style matching img2) */}
        {mainTab === 'users' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search & Top Action Bar */}
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[280px]">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  name="team-member-filter"
                  autoComplete="off"
                  value={userSearch}
                  onChange={(e) => {
                    // Browser contact fill also writes this box because the placeholder mentions phone.
                    if (showInviteModal) {
                      e.currentTarget.value = userSearch;
                      return;
                    }
                    setUserSearch(e.target.value);
                  }}
                  placeholder="Search team member by name, ID, or phone..."
                  className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Zoho "+ Invite User" Button */}
              {can('staff.create') && (
              <button
                type="button"
                onClick={handleOpenInviteUser}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer active:scale-95"
              >
                <UserPlus size={15} />
                <span>Invite User</span>
              </button>
              )}
            </div>

            {/* Clean Zoho Books Users Table */}
            <div className="overflow-y-auto flex-1 p-6">
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-3 px-5">User</th>
                      <th className="py-3 px-4">Email Address</th>
                      <th className="py-3 px-4">WhatsApp Phone</th>
                      <th className="py-3 px-4">Assigned Role</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                          No team members match your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((emp) => {
                        const matchedRole = roles.find((r) => r.id === emp.role);
                        const roleLabel = matchedRole?.name || emp.role;
                        const isEmpAdmin = emp.role === 'admin';
                        const isSalesMgr =
                          emp.role === 'sales_manager' || emp.role === 'manager';
                        const isProcMgr = emp.role === 'procurement_manager';
                        const isProcPerson = emp.role === 'procurement_person';

                        return (
                          <tr
                            key={emp.id}
                            className="hover:bg-slate-50/70 transition-colors group"
                          >
                            {/* User Name & ID */}
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs ${
                                    isEmpAdmin
                                      ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                                      : isSalesMgr
                                        ? 'bg-gradient-to-br from-indigo-600 to-purple-600'
                                        : isProcMgr
                                          ? 'bg-gradient-to-br from-teal-600 to-emerald-700'
                                          : isProcPerson
                                            ? 'bg-gradient-to-br from-emerald-600 to-teal-600'
                                            : 'bg-gradient-to-br from-blue-600 to-cyan-600'
                                  }`}
                                >
                                  {emp.name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                    {emp.name}
                                  </div>
                                  <span className="font-mono text-slate-400 text-[11px]">
                                    {emp.employee_id}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Email */}
                            <td className="py-3.5 px-4 text-slate-600">
                              {emp.email ? (
                                <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                  <Mail size={12} className="text-slate-400 shrink-0" />
                                  <span className="truncate">{emp.email}</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 italic">No email</span>
                              )}
                            </td>

                            {/* WhatsApp Phone */}
                            <td className="py-3.5 px-4 font-mono text-slate-700">
                              <div className="flex items-center gap-1.5">
                                <Phone size={12} className="text-slate-400 shrink-0" />
                                <span>+{emp.phone}</span>
                              </div>
                            </td>

                            {/* Assigned Role */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  isEmpAdmin
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : isSalesMgr
                                      ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                      : isProcMgr
                                        ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                        : isProcPerson
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                                }`}
                              >
                                {roleLabel}
                              </span>
                            </td>

                            {/* Action: Open Zoho Books Assign Role Modal */}
                            <td className="py-3.5 px-5 text-right">
                              {can('staff.manage') && (
                              <button
                                type="button"
                                onClick={() => handleOpenAssignRole(emp)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Edit Role and User Information"
                              >
                                <Edit2 size={12} />
                                <span>Assign Role</span>
                              </button>
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
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <p className="text-slate-500">
            {mainTab === 'roles' ? (
              <span>
                💡 <strong>Roles Tab:</strong> Create and customize permissions using above permission matrix.
              </span>
            ) : (
              <span>
                💡 <strong>Users Tab:</strong> Click <strong>Invite User</strong> or <strong>Assign Role</strong> to manage team roles.
              </span>
            )}
          </p>
          <div className="flex items-center gap-2.5">
            {mainTab === 'roles' && (
              isCurrentRoleSystem ? (
                <div
                  className="px-4 py-2 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs border border-slate-200 flex items-center gap-1.5 cursor-not-allowed select-none"
                  title="Default system roles cannot be modified"
                >
                  <Lock size={13} />
                  <span>Fixed System Role</span>
                </div>
              ) : (
                <button
                  onClick={handleSaveCurrentRolePermissions}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/20 active:scale-95 flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>
                    {isCreatingRole ? 'Create & Save Role' : 'Save Template'}
                  </span>
                </button>
              )
            )}
            
          </div>
        </div>
      </div>

      {/* Zoho Books "Invite User" / "Assign Role" Modal (EXACTLY matching img2) */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg animate-in zoom-in-95 duration-150">
            {/* Card Header matching img2 */}
            <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-900">
                {editingUser ? 'Edit User & Role' : 'Invite User'}
              </h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form matching img2. A real form keeps browser contact fill inside this dialog. */}
            <form
              autoComplete="on"
              className="p-6 space-y-4.5"
              onSubmit={(e) => e.preventDefault()}
            >
              {inviteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
                  {inviteError}
                </div>
              )}

              {/* Name* */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  autoFocus
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder=""
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Email Address* */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder=""
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* WhatsApp Number* (Required for Enlight Sigma WhatsApp OTP) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  WhatsApp Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  name="tel"
                  autoComplete="tel"
                  value={inviteForm.phone}
                  onChange={(e) =>
                    setInviteForm((prev) => ({
                      ...prev,
                      phone: e.target.value.replace(/\D/g, ''),
                    }))
                  }
                  placeholder="919876543210"
                  maxLength={12}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <p className="text-slate-400 text-[11px] mt-1 font-sans">
                  Must start with 91 followed by 10 digits (used for WhatsApp OTP login)
                </p>
              </div>

              {/* Role* matching img2 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Role <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm((prev) => ({
                      ...prev,
                      role: e.target.value,
                      manager_id: e.target.value === prev.role ? prev.manager_id : '',
                      manager_phone: e.target.value === prev.role ? prev.manager_phone : '',
                    }))
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer font-medium"
                  menuClassName="w-full"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Notice for Procurement Manager role */}
              {inviteForm.role === 'procurement_manager' && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-xs flex items-start gap-2">
                  <Shield size={14} className="shrink-0 mt-0.5 text-teal-600" />
                  <span>
                    <strong>Procurement Manager:</strong> Reviews raw customer inquiries, coordinates &amp; provides base product purchase rates for their assigned procurement team, and forwards to sales.
                  </span>
                </div>
              )}

              {/* Notice for Procurement Person role */}
              {inviteForm.role === 'procurement_person' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs flex items-start gap-2">
                  <Shield size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    <strong>Procurement Person:</strong> Dedicated to inquiries. Receives raw customer inquiries, inputs product base purchase rates, and forwards to salesperson. Scoped only to inquiries received by them.
                  </span>
                </div>
              )}

              {/* Assigned Sales Manager (for salesperson) */}
              {inviteForm.role === 'salesperson' && availableSalesManagers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Assigned Sales Manager{' '}
                    <span className="text-slate-400 text-xs font-normal">(optional)</span>
                  </label>
                  <Select
                    value={inviteForm.manager_id || ''}
                    onChange={(e) => {
                      const mgr = availableSalesManagers.find((m) => m.id === e.target.value);
                      setInviteForm((prev) => ({
                        ...prev,
                        manager_id: e.target.value,
                        manager_phone: mgr?.phone || '',
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer font-medium"
                    menuClassName="w-full"
                  >
                    <option value="">-- None (Direct to Admin) --</option>
                    {availableSalesManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.employee_id})
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Assigned Procurement Manager (for procurement_person) */}
              {inviteForm.role === 'procurement_person' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Assigned Procurement Manager{' '}
                    <span className="text-slate-400 text-xs font-normal">(optional)</span>
                  </label>
                  <Select
                    value={inviteForm.manager_id || ''}
                    onChange={(e) => {
                      const mgr = availableProcurementManagers.find((m) => m.id === e.target.value);
                      setInviteForm((prev) => ({
                        ...prev,
                        manager_id: e.target.value,
                        manager_phone: mgr?.phone || '',
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer font-medium"
                    menuClassName="w-full"
                  >
                    <option value="">-- None (Direct to Admin) --</option>
                    {availableProcurementManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.employee_id})
                      </option>
                    ))}
                  </Select>
                  <p className="text-slate-400 text-[11px] mt-1 font-sans">
                    Procurement Manager who oversees this person&apos;s inquiries and provides team base rates.
                  </p>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  disabled={inviteLoading}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveInviteUser}
                  disabled={inviteLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {inviteLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : editingUser ? (
                    'Save Changes'
                  ) : (
                    'Invite User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
