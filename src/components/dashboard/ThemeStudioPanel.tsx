import React, { useEffect, useState } from 'react';
import { Eye, Palette, RotateCcw, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { getContrastRatio } from '../../lib/format.ts';
import type { ThemeColors } from '../../../shared/types.ts';

const THEME_PRESETS: Array<{ name: string; description: string; theme: ThemeColors }> = [
  {
    name: 'Obsidian Gold',
    description: 'Signature dark showroom slate with warm amber-gold accents',
    theme: {
      presetId: 'obsidian-gold',
      mode: 'dark',
      bg: '#0b0b0c',
      surface: '#161514',
      surfaceAlt: '#1d1b19',
      border: '#2c251e',
      text: '#f6efe6',
      muted: '#a99f92',
      accent: '#c98a4b',
      accentBright: '#e8b06a',
      accentContrast: '#12100e',
    },
  },
  {
    name: 'Alpine Ivory',
    description: 'High-contrast daylight gallery with warm bronze actions',
    theme: {
      presetId: 'alpine-ivory',
      mode: 'light',
      bg: '#f7f5f0',
      surface: '#ffffff',
      surfaceAlt: '#efeae1',
      border: '#dfd7ca',
      text: '#171512',
      muted: '#665e53',
      accent: '#9a5b1e',
      accentBright: '#7c4512',
      accentContrast: '#ffffff',
    },
  },
  {
    name: 'Midnight Cobalt',
    description: 'Deep marine slate paired with crisp cobalt CTA focus',
    theme: {
      presetId: 'midnight-cobalt',
      mode: 'dark',
      bg: '#090d16',
      surface: '#111827',
      surfaceAlt: '#182235',
      border: '#26334d',
      text: '#f1f5f9',
      muted: '#94a3b8',
      accent: '#3b82f6',
      accentBright: '#60a5fa',
      accentContrast: '#ffffff',
    },
  },
  {
    name: 'Heritage Emerald',
    description: 'Dark racing green canvas with crisp mint-silver accents',
    theme: {
      presetId: 'heritage-emerald',
      mode: 'dark',
      bg: '#09110e',
      surface: '#111e19',
      surfaceAlt: '#172922',
      border: '#223b31',
      text: '#ecfdf5',
      muted: '#93b3a6',
      accent: '#10b981',
      accentBright: '#34d399',
      accentContrast: '#052e1e',
    },
  },
];

const COLOR_FIELDS: Array<{ key: keyof Omit<ThemeColors, 'presetId' | 'mode'>; label: string }> = [
  { key: 'bg', label: 'Page Canvas Background' },
  { key: 'surface', label: 'Card & Panel Surface' },
  { key: 'surfaceAlt', label: 'Secondary Surface' },
  { key: 'border', label: 'Hairline Border Tone' },
  { key: 'text', label: 'Primary Text' },
  { key: 'muted', label: 'Muted Metadata Text' },
  { key: 'accent', label: 'Primary Accent / CTA' },
  { key: 'accentBright', label: 'Highlight / Price Text' },
  { key: 'accentContrast', label: 'Button Text on Accent' },
];

export function ThemeStudioPanel({ onOpenStorefrontPreview }: { onOpenStorefrontPreview: () => void }) {
  const { themeColors, setPreviewTheme, token, user, pushToast } = useApp();
  const [draft, setDraft] = useState<ThemeColors | null>(themeColors);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (themeColors && !draft) {
      setDraft(themeColors);
    }
  }, [themeColors, draft]);

  if (!draft) return null;

  const canEdit = user?.role === 'admin' || user?.permissions.canEditSiteContent;
  const textContrast = getContrastRatio(draft.text, draft.bg);
  const btnContrast = getContrastRatio(draft.accentContrast, draft.accent);

  const applyDraft = (next: ThemeColors) => {
    setDraft(next);
    setPreviewTheme(next);
  };

  const handleSave = async () => {
    if (!token || !canEdit) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ theme: ThemeColors }>('/api/admin/theme', {
        method: 'PUT',
        body: draft,
        token,
      });
      setDraft(res.theme);
      setPreviewTheme(null);
      pushToast({
        title: 'Website Colors Applied',
        message: 'New color palette is now active across the entire platform.',
        type: 'cms',
      });
    } catch (err: unknown) {
      pushToast({
        title: 'Save Failed',
        message: err instanceof Error ? err.message : 'Unable to save theme colors',
        type: 'system',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!token || user?.role !== 'admin') return;
    try {
      const res = await apiRequest<{ theme: ThemeColors }>('/api/admin/theme/reset', {
        method: 'POST',
        token,
      });
      setDraft(res.theme);
      setPreviewTheme(null);
      pushToast({ title: 'Colors Reset', message: 'Default Obsidian Gold palette restored.', type: 'cms' });
    } catch (err: unknown) {
      pushToast({
        title: 'Reset Failed',
        message: err instanceof Error ? err.message : 'Unable to reset theme',
        type: 'system',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">Live Website Color Studio</h3>
          <p className="text-xs" style={{ color: 'var(--site-muted)' }}>
            Select a curated showroom preset or fine-tune individual color tokens with live contrast checks.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenStorefrontPreview}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--site-surface)',
              borderColor: 'var(--site-border)',
              color: 'var(--site-text)',
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Preview Storefront</span>
          </button>
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => void handleReset()}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--site-surface)',
                borderColor: 'var(--site-border)',
                color: 'var(--site-muted)',
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
          <button
            type="button"
            disabled={!canEdit || saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-60"
            style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving…' : 'Save Colors'}</span>
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {THEME_PRESETS.map((preset) => {
          const active = draft.presetId === preset.theme.presetId;
          return (
            <button
              key={preset.theme.presetId}
              type="button"
              onClick={() => applyDraft(preset.theme)}
              className="flex flex-col justify-between rounded-2xl border p-4 text-left transition-transform hover:-translate-y-0.5"
              style={{
                backgroundColor: preset.theme.surface,
                borderColor: active ? preset.theme.accent : preset.theme.border,
                color: preset.theme.text,
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold">{preset.name}</span>
                  <Palette className="h-4 w-4" style={{ color: preset.theme.accentBright }} />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: preset.theme.muted }}>
                  {preset.description}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {[preset.theme.bg, preset.theme.surface, preset.theme.accent, preset.theme.accentBright].map((hex, i) => (
                  <span
                    key={i}
                    className="h-5 w-5 rounded-full border"
                    style={{ backgroundColor: hex, borderColor: preset.theme.border }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Token Pickers + Contrast Audit */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div
          className="rounded-2xl border p-5 lg:col-span-8"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-display text-sm font-semibold">Custom Palette Tokens</h4>
            <div className="flex items-center gap-2 text-xs">
              <span>Mode:</span>
              <button
                type="button"
                onClick={() => applyDraft({ ...draft, presetId: 'custom', mode: draft.mode === 'dark' ? 'light' : 'dark' })}
                className="rounded-lg border px-2.5 py-1 font-semibold capitalize"
                style={{ borderColor: 'var(--site-border)', backgroundColor: 'var(--site-bg)' }}
              >
                {draft.mode}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {COLOR_FIELDS.map((field) => (
              <div
                key={field.key}
                className="rounded-xl border p-3"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              >
                <label className="block text-[11px] font-medium mb-2" style={{ color: 'var(--site-muted)' }}>
                  {field.label}
                </label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={draft[field.key]}
                    onChange={(e) =>
                      applyDraft({ ...draft, presetId: 'custom', [field.key]: e.target.value })
                    }
                    className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={draft[field.key]}
                    onChange={(e) =>
                      applyDraft({ ...draft, presetId: 'custom', [field.key]: e.target.value })
                    }
                    className="w-full rounded-lg border px-2.5 py-1.5 font-mono-tabular text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl border p-5 lg:col-span-4 space-y-4"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <h4 className="font-display text-sm font-semibold">Accessibility & Live Specimen</h4>
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{ backgroundColor: draft.bg, borderColor: draft.border, color: draft.text }}
          >
            <p className="text-xs font-medium" style={{ color: draft.accentBright }}>
              2024 Toyota Innova Crysta
            </p>
            <p className="font-display text-lg font-bold">₹33.00 L</p>
            <p className="text-xs" style={{ color: draft.muted }}>
              Diesel · Manual · 18,000 km · 1st Owner
            </p>
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-xs font-semibold"
              style={{ backgroundColor: draft.accent, color: draft.accentContrast }}
            >
              Inspect Vehicle
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--site-muted)' }}>Body Text Contrast</span>
              <span className="font-mono-tabular font-semibold">
                {textContrast}:1 ({textContrast >= 4.5 ? 'AA Pass' : 'Low'})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--site-muted)' }}>Button CTA Contrast</span>
              <span className="font-mono-tabular font-semibold">
                {btnContrast}:1 ({btnContrast >= 4.5 ? 'AA Pass' : 'Low'})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
