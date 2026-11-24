import React, { useMemo, useState } from 'react';
import { ImagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { apiRequest, uploadVehicleImage } from '../../lib/api.ts';
import { formatInrLakhs, formatKm } from '../../lib/format.ts';
import type { Vehicle, VehicleBoardType } from '../../../shared/types.ts';

const VEHICLE_BOARD_TYPES: VehicleBoardType[] = ['Tboard Vehicles', 'Non Tboard Vehicles'];

const IMAGE_PRESETS = [
  { label: 'Flagship SUV Studio', url: '/src/assets/images/vehicle_suv_flagship_1795250937139.jpg' },
  { label: 'Silver Crossover Studio', url: '/src/assets/images/vehicle_crossover_silver_1795250937315.jpg' },
  { label: 'Crimson EV / Sport Studio', url: '/src/assets/images/vehicle_electric_crimson_1795250939150.jpg' },
];

interface InventoryPanelProps {
  initialAction?: 'create' | null;
  initialEditVehicle?: Vehicle | null;
  onClearInitial?: () => void;
}

export function InventoryPanel({ initialAction, initialEditVehicle, onClearInitial }: InventoryPanelProps = {}) {
  const { vehicles, user, token, pushToast, refreshProtected } = useApp();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Vehicle['status']>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  const canAdd = user?.role === 'admin' || user?.permissions.canAddCar;
  const canEdit = user?.role === 'admin' || user?.permissions.canEditCar;
  const canEditPrice = user?.role === 'admin' || user?.permissions.canEditPrice;
  const canDelete = user?.role === 'admin' || user?.permissions.canDeleteCar;

  const [form, setForm] = useState({
    brand: '',
    model: '',
    year: '2024',
    variant: '',
    reg: '',
    owner: '1',
    colour: 'White',
    fuel: 'Diesel',
    trans: 'AT',
    km: '',
    price: '',
    finalPrice: '',
    dealer: '',
    phone: '',
    fc: '',
    insurance: '',
    permit: '',
    boardType: 'Non Tboard Vehicles' as VehicleBoardType,
    status: 'Available' as Vehicle['status'],
    featured: false,
    imageUrl: IMAGE_PRESETS[0].url,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter !== 'All' && v.status !== statusFilter) return false;
      if (!q) return true;
      return `${v.brand} ${v.model} ${v.reg} ${v.dealer}`.toLowerCase().includes(q);
    });
  }, [vehicles, query, statusFilter]);

  const openCreate = () => {
    setEditingVehicle(null);
    setForm({
      brand: '',
      model: '',
      year: '2024',
      variant: '',
      reg: 'TN-',
      owner: '1',
      colour: 'White',
      fuel: 'Petrol',
      trans: 'MT',
      km: '',
      price: '',
      finalPrice: '',
      dealer: user?.name || '',
      phone: '',
      fc: '',
      insurance: '',
      permit: '',
      boardType: 'Non Tboard Vehicles',
      status: 'Available',
      featured: false,
      imageUrl: IMAGE_PRESETS[0].url,
    });
    setModalOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setForm({
      brand: v.brand,
      model: v.model,
      year: v.year,
      variant: v.variant,
      reg: v.reg,
      owner: v.owner,
      colour: v.colour,
      fuel: v.fuel,
      trans: v.trans,
      km: v.km,
      price: String(v.price),
      finalPrice: String(v.finalPrice),
      dealer: v.dealer,
      phone: v.phone,
      fc: v.fc || '',
      insurance: v.insurance || '',
      permit: v.permit || '',
      boardType: v.boardType || 'Non Tboard Vehicles',
      status: v.status,
      featured: v.featured,
      imageUrl: v.imageUrl,
    });
    setModalOpen(true);
  };

  React.useEffect(() => {
    if (initialAction === 'create' && canAdd) {
      openCreate();
      onClearInitial?.();
    } else if (initialEditVehicle && canEdit) {
      openEdit(initialEditVehicle);
      onClearInitial?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction, initialEditVehicle]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        brand: form.brand,
        model: form.model,
        year: form.year,
        variant: form.variant,
        reg: form.reg,
        owner: form.owner,
        colour: form.colour,
        fuel: form.fuel,
        trans: form.trans,
        km: form.km,
        dealer: form.dealer,
        phone: form.phone,
        fc: form.fc,
        insurance: form.insurance,
        permit: form.permit,
        boardType: form.boardType,
        status: form.status,
        featured: form.featured,
        imageUrl: form.imageUrl,
      };
      if (!editingVehicle || canEditPrice) {
        payload.price = Number(form.price);
        payload.finalPrice = Number(form.finalPrice || form.price);
      }

      if (editingVehicle) {
        await apiRequest(`/api/vehicles/${editingVehicle.id}`, {
          method: 'PATCH',
          body: payload,
          token,
        });
        pushToast({ title: 'Vehicle Updated', message: `${form.year} ${form.brand} ${form.model} saved.`, type: 'inventory' });
      } else {
        await apiRequest('/api/vehicles', {
          method: 'POST',
          body: payload,
          token,
        });
        pushToast({ title: 'Vehicle Added', message: `${form.year} ${form.brand} ${form.model} published.`, type: 'inventory' });
      }
      await refreshProtected();
      setModalOpen(false);
    } catch (err: unknown) {
      pushToast({
        title: 'Inventory Error',
        message: err instanceof Error ? err.message : 'Unable to save vehicle',
        type: 'system',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setImageUploading(true);
    try {
      const { url } = await uploadVehicleImage(file, token);
      setForm((prev) => ({ ...prev, imageUrl: url }));
      pushToast({ title: 'Image Uploaded', message: 'Car image is ready to publish.', type: 'inventory' });
    } catch (err: unknown) {
      pushToast({
        title: 'Upload Failed',
        message: err instanceof Error ? err.message : 'Unable to upload image',
        type: 'system',
      });
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const handleStatusChange = async (v: Vehicle, status: Vehicle['status']) => {
    if (!token || !canEdit) return;
    try {
      await apiRequest(`/api/vehicles/${v.id}`, {
        method: 'PATCH',
        body: { status },
        token,
      });
      await refreshProtected();
    } catch (err: unknown) {
      pushToast({
        title: 'Update Failed',
        message: err instanceof Error ? err.message : 'Unable to update status',
        type: 'system',
      });
    }
  };

  const handleDelete = async (v: Vehicle) => {
    if (!token || !canDelete) return;
    try {
      await apiRequest(`/api/vehicles/${v.id}`, { method: 'DELETE', token });
      await refreshProtected();
      pushToast({ title: 'Vehicle Removed', message: `${v.brand} ${v.model} deleted.`, type: 'inventory' });
    } catch (err: unknown) {
      pushToast({
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Unable to delete vehicle',
        type: 'system',
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--site-muted)' }}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter brand, model, reg…"
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-xs outline-none"
              style={{
                backgroundColor: 'var(--site-surface)',
                borderColor: 'var(--site-border)',
                color: 'var(--site-text)',
              }}
            />
          </div>

          <div
            className="flex items-center gap-1 rounded-xl border p-1"
            style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
          >
            {(['All', 'Available', 'Reserved', 'Sold'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
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

        {canAdd && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
          >
            <Plus className="h-4 w-4" />
            <span>Add New Car</span>
          </button>
        )}
      </div>

      <div
        className="overflow-x-auto rounded-2xl border"
        style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
      >
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--site-border)', color: 'var(--site-muted)' }}>
              <th className="px-4 py-3 font-medium">Vehicle</th>
              <th className="px-4 py-3 font-medium">Registration</th>
              <th className="px-4 py-3 font-medium">Specs</th>
              <th className="px-4 py-3 text-right font-medium">Final Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--site-border)' }}>
            {filtered.map((v) => (
              <tr key={v.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-semibold">
                    {v.year} {v.brand} {v.model}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--site-muted)' }}>
                    {v.variant || 'Standard'} · {v.dealer}
                  </p>
                </td>
                <td className="px-4 py-3 font-mono-tabular">{v.reg}</td>
                <td className="px-4 py-3" style={{ color: 'var(--site-muted)' }}>
                  {v.fuel} · {v.trans} · <span className="font-mono-tabular">{formatKm(v.km)}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono-tabular font-semibold" style={{ color: 'var(--site-accent-bright)' }}>
                  {formatInrLakhs(v.finalPrice)}
                </td>
                <td className="px-4 py-3">
                  <select
                    disabled={!canEdit}
                    value={v.status}
                    onChange={(e) => void handleStatusChange(v, e.target.value as Vehicle['status'])}
                    className="rounded-lg border px-2.5 py-1 text-xs outline-none disabled:opacity-60"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  >
                    <option value="Available">Available</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Sold">Sold</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEdit(v)}
                        aria-label={`Edit ${v.brand} ${v.model}`}
                        className="rounded-lg border p-1.5 hover:opacity-80"
                        style={{ borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(v)}
                        aria-label={`Delete ${v.brand} ${v.model}`}
                        className="rounded-lg border p-1.5 hover:opacity-80"
                        style={{ borderColor: 'var(--site-border)', color: '#f87171' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Vehicle Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl"
            style={{
              backgroundColor: 'var(--site-surface)',
              borderColor: 'var(--site-border)',
              color: 'var(--site-text)',
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">
                {editingVehicle ? `Edit ${editingVehicle.brand} ${editingVehicle.model}` : 'Add Vehicle to Inventory'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close modal" style={{ color: 'var(--site-muted)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Brand</label>
                <input
                  required
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="Toyota"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Model</label>
                <input
                  required
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="Innova Crysta"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Year</label>
                <input
                  required
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  placeholder="2024"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Variant</label>
                <input
                  value={form.variant}
                  onChange={(e) => setForm({ ...form, variant: e.target.value })}
                  placeholder="ZX"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Registration</label>
                <input
                  value={form.reg}
                  onChange={(e) => setForm({ ...form, reg: e.target.value })}
                  placeholder="TN-41-BQ-0007"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Odometer (KM)</label>
                <input
                  value={form.km}
                  onChange={(e) => setForm({ ...form, km: e.target.value })}
                  placeholder="18000"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Fuel</label>
                <select
                  value={form.fuel}
                  onChange={(e) => setForm({ ...form, fuel: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="EV">EV</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="PET / CNG">PET / CNG</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Transmission</label>
                <select
                  value={form.trans}
                  onChange={(e) => setForm({ ...form, trans: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                >
                  <option value="MT">Manual (MT)</option>
                  <option value="AT">Automatic (AT)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Colour</label>
                <input
                  value={form.colour}
                  onChange={(e) => setForm({ ...form, colour: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>
                  Asking Price (₹) {!canEditPrice && editingVehicle ? '(Locked)' : ''}
                </label>
                <input
                  type="number"
                  required
                  disabled={Boolean(editingVehicle) && !canEditPrice}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="3350000"
                  className="w-full rounded-xl border px-3 py-2 text-xs font-mono-tabular outline-none disabled:opacity-50"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>
                  Final Price (₹) {!canEditPrice && editingVehicle ? '(Locked)' : ''}
                </label>
                <input
                  type="number"
                  required
                  disabled={Boolean(editingVehicle) && !canEditPrice}
                  value={form.finalPrice}
                  onChange={(e) => setForm({ ...form, finalPrice: e.target.value })}
                  placeholder="3300000"
                  className="w-full rounded-xl border px-3 py-2 text-xs font-mono-tabular outline-none disabled:opacity-50"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Dealer / Source</label>
                <input
                  value={form.dealer}
                  onChange={(e) => setForm({ ...form, dealer: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>FC</label>
                <input
                  value={form.fc}
                  onChange={(e) => setForm({ ...form, fc: e.target.value })}
                  placeholder="e.g. 04/2028"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Insurance</label>
                <input
                  value={form.insurance}
                  onChange={(e) => setForm({ ...form, insurance: e.target.value })}
                  placeholder="e.g. 12/2026 · Full Coverage"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Permit</label>
                <input
                  value={form.permit}
                  onChange={(e) => setForm({ ...form, permit: e.target.value })}
                  placeholder="e.g. TN · 05/2027"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Vehicle Board Type</label>
                <select
                  value={form.boardType}
                  onChange={(e) => setForm({ ...form, boardType: e.target.value as VehicleBoardType })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                >
                  {VEHICLE_BOARD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3 space-y-3 rounded-xl border p-3" style={{ borderColor: 'var(--site-border)' }}>
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer"
                    style={{ borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    <span>{imageUploading ? 'Uploading…' : 'Upload Car Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={imageUploading}
                      onChange={(e) => void handleImageUpload(e)}
                    />
                  </label>
                  <span className="text-[11px]" style={{ color: 'var(--site-muted)' }}>
                    JPG, PNG, WEBP or GIF · up to 4 MB
                  </span>
                </div>
                {form.imageUrl && (
                  <img
                    src={form.imageUrl}
                    alt="Selected car preview"
                    referrerPolicy="no-referrer"
                    className="h-28 w-full rounded-lg object-cover"
                  />
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Or choose a studio image preset</label>
                <select
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                >
                  {IMAGE_PRESETS.map((p) => (
                    <option key={p.url} value={p.url}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  />
                  <span>Featured on Storefront</span>
                </label>
              </div>

              <div className="sm:col-span-3 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border px-4 py-2 text-xs font-semibold"
                  style={{ borderColor: 'var(--site-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl px-5 py-2 text-xs font-semibold"
                  style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
                >
                  {saving ? 'Saving…' : editingVehicle ? 'Save Changes' : 'Publish Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
