import React, { useMemo, useState } from 'react';
import { Download, Search, Shield, Trash2, UserPlus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { formatRelativeTime } from '../../lib/format.ts';
import type { StaffPermissions, UserAccount } from '../../../shared/types.ts';

interface StaffUsersPanelProps {
  users: UserAccount[];
  onRefreshUsers: () => Promise<void>;
  mode: 'users' | 'staff';
}

const PERMISSION_LABELS: Array<{ key: keyof StaffPermissions; label: string }> = [
  { key: 'canAddCar', label: 'Add Cars' },
  { key: 'canEditCar', label: 'Edit Cars' },
  { key: 'canEditPrice', label: 'Modify Pricing' },
  { key: 'canDeleteCar', label: 'Delete Cars' },
  { key: 'canViewAllEnquiries', label: 'View All Enquiries' },
  { key: 'canEditSiteContent', label: 'Edit CMS & Colors' },
];

export function StaffUsersPanel({ users, onRefreshUsers, mode }: StaffUsersPanelProps) {
  const { user: currentUser, token, pushToast } = useApp();
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [staffForm, setStaffForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    role: 'staff' as 'staff' | 'customer',
    staffCode: '',
    title: 'Sales Advisor',
    password: '',
    permissions: {
      canAddCar: true,
      canEditCar: true,
      canDeleteCar: false,
      canEditPrice: false,
      canViewAllEnquiries: false,
      canEditSiteContent: false,
    } as StaffPermissions,
  });

  const isAdmin = currentUser?.role === 'admin';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (mode === 'staff' && u.role === 'customer') return false;
      if (mode === 'users' && u.role !== 'customer') return false;
      if (!q) return true;
      return `${u.name} ${u.username || ''} ${u.email} ${u.phone || ''} ${u.staffCode || ''}`.toLowerCase().includes(q);
    });
  }, [users, query, mode]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      await apiRequest('/api/admin/staff', {
        method: 'POST',
        body: staffForm,
        token,
      });
      await onRefreshUsers();
      setModalOpen(false);
      const createdName = staffForm.name;
      setStaffForm({
        name: '',
        username: '',
        email: '',
        phone: '',
        role: mode === 'users' ? 'customer' : 'staff',
        staffCode: '',
        title: 'Sales Advisor',
        password: '',
        permissions: {
          canAddCar: true,
          canEditCar: true,
          canDeleteCar: false,
          canEditPrice: false,
          canViewAllEnquiries: false,
          canEditSiteContent: false,
        },
      });
      pushToast({ title: 'Portal Account Created', message: `${createdName} can now sign in.`, type: 'user' });
    } catch (err: unknown) {
      pushToast({
        title: 'Account Setup Error',
        message: err instanceof Error ? err.message : 'Unable to create account',
        type: 'system',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (target: UserAccount) => {
    if (!token || !isAdmin) return;
    try {
      await apiRequest(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        body: { active: !target.active },
        token,
      });
      await onRefreshUsers();
    } catch (err: unknown) {
      pushToast({
        title: 'Update Error',
        message: err instanceof Error ? err.message : 'Unable to update account',
        type: 'system',
      });
    }
  };

  const handleTogglePermission = async (target: UserAccount, key: keyof StaffPermissions) => {
    if (!token || !isAdmin) return;
    try {
      await apiRequest(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        body: {
          permissions: {
            ...target.permissions,
            [key]: !target.permissions[key],
          },
        },
        token,
      });
      await onRefreshUsers();
    } catch (err: unknown) {
      pushToast({
        title: 'Permission Error',
        message: err instanceof Error ? err.message : 'Unable to update permission',
        type: 'system',
      });
    }
  };

  const handleDeleteUser = async (target: UserAccount) => {
    if (!token || !isAdmin) return;
    try {
      await apiRequest(`/api/admin/users/${target.id}`, { method: 'DELETE', token });
      await onRefreshUsers();
      pushToast({ title: 'Account Deleted', message: `${target.name} removed.`, type: 'user' });
    } catch (err: unknown) {
      pushToast({
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Unable to delete account',
        type: 'system',
      });
    }
  };

  const exportCsv = () => {
    const rows = [
      ['ID', 'Name', 'Email', 'Phone', 'Role', 'Staff Code', 'Active', 'Shortlisted', 'Created'],
      ...filtered.map((u) => [
        u.id,
        u.name,
        u.email,
        u.phone || '',
        u.role,
        u.staffCode || '',
        u.active ? 'Active' : 'Suspended',
        String(u.shortlistedIds.length),
        u.createdAt,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--site-muted)' }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'staff' ? 'Search staff name, email, code…' : 'Search customer name, email, phone…'}
            className="w-full rounded-xl border py-2 pl-9 pr-3 text-xs outline-none"
            style={{
              backgroundColor: 'var(--site-surface)',
              borderColor: 'var(--site-border)',
              color: 'var(--site-text)',
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--site-surface)',
              borderColor: 'var(--site-border)',
              color: 'var(--site-text)',
            }}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setStaffForm((prev) => ({
                  ...prev,
                  role: mode === 'users' ? 'customer' : 'staff',
                }));
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap"
              style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{mode === 'users' ? 'Add Member Login' : 'Add Staff Member'}</span>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-2xl border p-10 text-center"
          style={{
            backgroundColor: 'var(--site-surface)',
            borderColor: 'var(--site-border)',
            color: 'var(--site-muted)',
          }}
        >
          <p className="text-sm font-medium">
            {mode === 'staff'
              ? 'No staff members configured yet.'
              : 'No registered customer accounts yet. Customer signups appear here automatically.'}
          </p>
        </div>
      ) : mode === 'staff' ? (
        <div className="space-y-4">
          {filtered.map((member) => (
            <div
              key={member.id}
              className="rounded-2xl border p-5"
              style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" style={{ color: 'var(--site-accent-bright)' }} />
                    <h3 className="font-display text-base font-bold">{member.name}</h3>
                    <span className="text-xs font-mono-tabular" style={{ color: 'var(--site-accent-bright)' }}>
                      {member.staffCode || member.role.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--site-muted)' }}>
                    {member.username ? `@${member.username} · ` : ''}
                    {member.title || (member.role === 'admin' ? 'Administrator' : 'Sales Advisor')} · {member.email}
                    {member.phone ? ` · ${member.phone}` : ''}
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: 'var(--site-muted)' }}>
                    Status: {member.active ? 'Active' : 'Suspended'} · Last login:{' '}
                    {member.lastLoginAt ? formatRelativeTime(member.lastLoginAt) : 'Never'}
                  </p>
                </div>

                {isAdmin && member.id !== currentUser?.id && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(member)}
                      className="rounded-xl border px-3 py-1.5 text-xs font-semibold"
                      style={{ borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
                    >
                      {member.active ? 'Suspend' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteUser(member)}
                      aria-label={`Remove ${member.name}`}
                      className="rounded-xl border p-1.5"
                      style={{ borderColor: 'var(--site-border)', color: '#f87171' }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {member.role === 'staff' && (
                <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--site-border)' }}>
                  <p className="text-xs font-medium mb-2.5" style={{ color: 'var(--site-muted)' }}>
                    Granular Role Permissions
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {PERMISSION_LABELS.map((perm) => {
                      const enabled = member.permissions[perm.key];
                      return (
                        <label
                          key={perm.key}
                          className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs cursor-pointer"
                          style={{
                            backgroundColor: 'var(--site-bg)',
                            borderColor: enabled ? 'var(--site-accent)' : 'var(--site-border)',
                          }}
                        >
                          <input
                            type="checkbox"
                            disabled={!isAdmin}
                            checked={enabled}
                            onChange={() => void handleTogglePermission(member, perm.key)}
                          />
                          <span>{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-2xl border"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--site-border)', color: 'var(--site-muted)' }}>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 text-right font-medium">Shortlisted</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--site-border)' }}>
              {filtered.map((cust) => (
                <tr key={cust.id}>
                  <td className="px-4 py-3 font-semibold">
                    {cust.name}
                    {cust.username && (
                      <span className="ml-2 text-[11px] font-mono-tabular" style={{ color: 'var(--site-accent-bright)' }}>
                        @{cust.username}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--site-muted)' }}>
                    {cust.email} {cust.phone ? `· ${cust.phone}` : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular">{cust.shortlistedIds.length}</td>
                  <td className="px-4 py-3">{cust.active ? 'Active' : 'Suspended'}</td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(cust)}
                        className="rounded-lg border px-2.5 py-1 text-xs font-medium"
                        style={{ borderColor: 'var(--site-border)' }}
                      >
                        {cust.active ? 'Suspend' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl"
            style={{
              backgroundColor: 'var(--site-surface)',
              borderColor: 'var(--site-border)',
              color: 'var(--site-text)',
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">
                {staffForm.role === 'customer' ? 'Create Portal Member Login' : 'Onboard Staff Member'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" style={{ color: 'var(--site-muted)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Account Type</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as 'staff' | 'customer' })}
                    className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  >
                    <option value="staff">Showroom Staff</option>
                    <option value="customer">Customer / Member Portal Access</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Username (Login ID)</label>
                  <input
                    required
                    minLength={3}
                    value={staffForm.username}
                    onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                    placeholder="e.g. karthik01"
                    className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Full Name</label>
                  <input
                    required
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder="e.g. Karthik M"
                    className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Email (Optional)</label>
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="user@annamalaiyarcars.in"
                    className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  />
                </div>
                {staffForm.role === 'staff' && (
                  <>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Staff Code</label>
                      <input
                        value={staffForm.staffCode}
                        onChange={(e) => setStaffForm({ ...staffForm, staffCode: e.target.value })}
                        placeholder="TAC-STF-02"
                        className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                        style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Role Title</label>
                      <input
                        value={staffForm.title}
                        onChange={(e) => setStaffForm({ ...staffForm, title: e.target.value })}
                        className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                        style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Phone</label>
                  <input
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Login Password (6+ chars)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  />
                </div>
              </div>

              {staffForm.role === 'staff' && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--site-muted)' }}>Assign Permissions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PERMISSION_LABELS.map((perm) => (
                      <label
                        key={perm.key}
                        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs cursor-pointer"
                        style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                      >
                        <input
                          type="checkbox"
                          checked={staffForm.permissions[perm.key]}
                          onChange={(e) =>
                            setStaffForm({
                              ...staffForm,
                              permissions: { ...staffForm.permissions, [perm.key]: e.target.checked },
                            })
                          }
                        />
                        <span>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl px-4 py-2.5 text-xs font-semibold"
                style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
              >
                {saving ? 'Creating Account…' : staffForm.role === 'customer' ? 'Create Member Login' : 'Create Staff Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
