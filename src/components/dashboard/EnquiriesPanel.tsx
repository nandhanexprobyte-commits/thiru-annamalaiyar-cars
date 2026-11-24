import React, { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Search, X } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { formatRelativeTime } from '../../lib/format.ts';
import type { Enquiry, EnquiryStatus, UserAccount } from '../../../shared/types.ts';

const STATUS_LIST: EnquiryStatus[] = [
  'New',
  'Contacted',
  'Test Drive',
  'Negotiation',
  'Closed',
  'Just Enquiry',
  'Enquiry',
  'Hot',
];
const CREATE_STATUS_LIST: EnquiryStatus[] = ['Just Enquiry', 'Enquiry', 'Hot'];
const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

export function EnquiriesPanel({ staffMembers }: { staffMembers: UserAccount[] }) {
  const { enquiries, vehicles, token, pushToast, refreshProtected } = useApp();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | EnquiryStatus>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [newForm, setNewForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    vehicleId: '',
    budget: '',
    location: '',
    date: TODAY_ISO(),
    olxId: '',
    status: 'Just Enquiry' as EnquiryStatus,
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    vehicleId: '',
    vehicleLabel: '',
    budget: '',
    location: '',
    date: '',
    olxId: '',
    message: '',
    notes: '',
    status: 'New' as EnquiryStatus,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enquiries.filter((e) => {
      if (statusFilter !== 'All' && e.status !== statusFilter) return false;
      if (!q) return true;
      return `${e.customerName} ${e.phone} ${e.vehicleLabel} ${e.location || ''} ${e.olxId || ''} ${e.message}`
        .toLowerCase()
        .includes(q);
    });
  }, [enquiries, query, statusFilter]);

  const handleUpdate = async (id: string, patch: { status?: EnquiryStatus; assignedStaffId?: string; notes?: string }) => {
    if (!token) return;
    try {
      await apiRequest(`/api/enquiries/${id}`, {
        method: 'PATCH',
        body: patch,
        token,
      });
    } catch (err: unknown) {
      pushToast({
        title: 'Update Error',
        message: err instanceof Error ? err.message : 'Unable to update enquiry',
        type: 'system',
      });
    }
  };

  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const selected = vehicles.find((v) => v.id === newForm.vehicleId);
      await apiRequest<{ enquiry: Enquiry }>('/api/enquiries', {
        method: 'POST',
        body: {
          vehicleId: selected?.id,
          vehicleLabel: selected ? `${selected.year} ${selected.brand} ${selected.model}` : 'General Showroom Enquiry',
          customerName: newForm.customerName,
          phone: newForm.phone,
          email: newForm.email,
          budget: newForm.budget,
          location: newForm.location,
          date: newForm.date,
          olxId: newForm.olxId,
          status: newForm.status,
          message: newForm.message,
          source: 'staff',
        },
        token,
      });
      setModalOpen(false);
      setNewForm({
        customerName: '',
        phone: '',
        email: '',
        vehicleId: '',
        budget: '',
        location: '',
        date: TODAY_ISO(),
        olxId: '',
        status: 'Just Enquiry',
        message: '',
      });
      pushToast({ title: 'Lead Logged', message: 'Walk-in / phone enquiry added.', type: 'enquiry' });
    } catch (err: unknown) {
      pushToast({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Unable to add enquiry',
        type: 'system',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (enquiry: Enquiry) => {
    setEditingEnquiry(enquiry);
    setEditForm({
      customerName: enquiry.customerName,
      phone: enquiry.phone,
      email: enquiry.email || '',
      vehicleId: enquiry.vehicleId || '',
      vehicleLabel: enquiry.vehicleLabel,
      budget: enquiry.budget || '',
      location: enquiry.location || '',
      date: enquiry.date || '',
      olxId: enquiry.olxId || '',
      message: enquiry.message,
      notes: enquiry.notes || '',
      status: enquiry.status,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingEnquiry) return;
    setEditSaving(true);
    try {
      await apiRequest(`/api/enquiries/${editingEnquiry.id}`, {
        method: 'PATCH',
        body: editForm,
        token,
      });
      await refreshProtected();
      setEditingEnquiry(null);
      pushToast({ title: 'Enquiry Updated', message: `${editForm.customerName}'s enquiry was saved.`, type: 'enquiry' });
    } catch (err: unknown) {
      pushToast({
        title: 'Update Error',
        message: err instanceof Error ? err.message : 'Unable to update enquiry',
        type: 'system',
      });
    } finally {
      setEditSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['ID', 'Customer', 'Phone', 'Email', 'Vehicle', 'Budget', 'Location', 'Date', 'OLX ID', 'Status', 'Source', 'Assigned', 'Created'],
      ...filtered.map((e) => [
        e.id,
        e.customerName,
        e.phone,
        e.email || '',
        e.vehicleLabel,
        e.budget || '',
        e.location || '',
        e.date || '',
        e.olxId || '',
        e.status,
        e.source,
        e.assignedStaffName || 'Unassigned',
        e.createdAt,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--site-muted)' }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer, phone, car…"
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-xs outline-none"
              style={{
                backgroundColor: 'var(--site-surface)',
                borderColor: 'var(--site-border)',
                color: 'var(--site-text)',
              }}
            />
          </div>

          <div
            className="flex items-center gap-1 overflow-x-auto rounded-xl border p-1"
            style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
          >
            {(['All', ...STATUS_LIST] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0"
                style={
                  statusFilter === s
                    ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }
                    : { color: 'var(--site-muted)' }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap"
            style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log Walk-in Lead</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-2xl border p-10 text-center text-sm"
          style={{
            backgroundColor: 'var(--site-surface)',
            borderColor: 'var(--site-border)',
            color: 'var(--site-muted)',
          }}
        >
          No enquiries match the active filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((enq) => (
            <div
              key={enq.id}
              className="rounded-2xl border p-5"
              style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-display text-base font-semibold">{enq.customerName}</span>
                    <span aria-hidden="true" style={{ color: 'var(--site-muted)' }}>·</span>
                    <span className="font-mono-tabular" style={{ color: 'var(--site-accent-bright)' }}>
                      {enq.phone}
                    </span>
                    {enq.email && (
                      <>
                        <span aria-hidden="true" style={{ color: 'var(--site-muted)' }}>·</span>
                        <span style={{ color: 'var(--site-muted)' }}>{enq.email}</span>
                      </>
                    )}
                    <span aria-hidden="true" style={{ color: 'var(--site-muted)' }}>·</span>
                    <span style={{ color: 'var(--site-muted)' }}>{formatRelativeTime(enq.createdAt)}</span>
                  </div>

                  <p className="text-xs font-medium" style={{ color: 'var(--site-accent-bright)' }}>
                    {enq.vehicleLabel} {enq.budget ? `· Target ${enq.budget}` : ''} · Source: {enq.source}
                  </p>
                  {(enq.location || enq.date || enq.olxId) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--site-muted)' }}>
                      {enq.location && <span>Location: {enq.location}</span>}
                      {enq.date && <span>Date: {enq.date}</span>}
                      {enq.olxId && <span>OLX ID: {enq.olxId}</span>}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--site-text)' }}>
                    {enq.message}
                  </p>
                  {enq.notes && (
                    <p className="text-xs italic" style={{ color: 'var(--site-muted)' }}>
                      Advisor note: {enq.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    aria-label={`Assign staff for ${enq.customerName}`}
                    value={enq.assignedStaffId || ''}
                    onChange={(e) => void handleUpdate(enq.id, { assignedStaffId: e.target.value })}
                    className="rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  >
                    <option value="">Unassigned</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.staffCode || s.role})
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label={`Status for ${enq.customerName}`}
                    value={enq.status}
                    onChange={(e) => void handleUpdate(enq.id, { status: e.target.value as EnquiryStatus })}
                    className="rounded-xl border px-3 py-2 text-xs font-semibold outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-accent-bright)',
                    }}
                  >
                    {STATUS_LIST.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openEdit(enq)}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
            style={{
              backgroundColor: 'var(--site-surface)',
              borderColor: 'var(--site-border)',
              color: 'var(--site-text)',
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Log Showroom / Phone Lead</h3>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" style={{ color: 'var(--site-muted)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateWalkIn} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Customer Name</label>
                <input
                  required
                  value={newForm.customerName}
                  onChange={(e) => setNewForm({ ...newForm, customerName: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Phone</label>
                <input
                  required
                  value={newForm.phone}
                  onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Interested Vehicle</label>
                <select
                  value={newForm.vehicleId}
                  onChange={(e) => setNewForm({ ...newForm, vehicleId: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                >
                  <option value="">General Showroom Consultation</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.year} {v.brand} {v.model} ({v.reg})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Customer Location</label>
                  <input
                    value={newForm.location}
                    onChange={(e) => setNewForm({ ...newForm, location: e.target.value })}
                    placeholder="e.g. Trichy"
                    className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Date</label>
                  <input
                    type="date"
                    value={newForm.date}
                    onChange={(e) => setNewForm({ ...newForm, date: e.target.value })}
                    className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>OLX ID</label>
                  <input
                    value={newForm.olxId}
                    onChange={(e) => setNewForm({ ...newForm, olxId: e.target.value })}
                    placeholder="e.g. OLX-123456"
                    className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Status</label>
                  <select
                    value={newForm.status}
                    onChange={(e) => setNewForm({ ...newForm, status: e.target.value as EnquiryStatus })}
                    className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  >
                    {CREATE_STATUS_LIST.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Notes</label>
                <textarea
                  rows={3}
                  value={newForm.message}
                  onChange={(e) => setNewForm({ ...newForm, message: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none resize-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl px-4 py-2.5 text-xs font-semibold"
                style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
              >
                {submitting ? 'Saving…' : 'Save Lead'}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Edit Enquiry</h3>
              <button type="button" onClick={() => setEditingEnquiry(null)} aria-label="Close" style={{ color: 'var(--site-muted)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Customer Name</label>
                <input required value={editForm.customerName} onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Phone</label>
                <input required value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Budget</label>
                <input value={editForm.budget} onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Vehicle / Model</label>
                <input value={editForm.vehicleLabel} onChange={(e) => setEditForm({ ...editForm, vehicleLabel: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Interested Vehicle</label>
                <select value={editForm.vehicleId} onChange={(e) => setEditForm({ ...editForm, vehicleId: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}>
                  <option value="">General Showroom Consultation</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.brand} {v.model} ({v.reg})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Customer Location</label>
                <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Date</label>
                <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>OLX ID</label>
                <input value={editForm.olxId} onChange={(e) => setEditForm({ ...editForm, olxId: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Customer Message</label>
                <textarea rows={3} value={editForm.message} onChange={(e) => setEditForm({ ...editForm, message: e.target.value })} className="w-full resize-none rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as EnquiryStatus })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}>
                  {STATUS_LIST.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Advisor Notes</label>
                <input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingEnquiry(null)} className="rounded-xl border px-4 py-2 text-xs font-semibold" style={{ borderColor: 'var(--site-border)' }}>Cancel</button>
                <button type="submit" disabled={editSaving} className="rounded-xl px-5 py-2 text-xs font-semibold" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}>{editSaving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
