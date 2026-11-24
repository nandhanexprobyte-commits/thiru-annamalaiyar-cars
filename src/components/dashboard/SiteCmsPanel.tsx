import React, { useEffect, useState } from 'react';
import { Eye, RotateCcw, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import type { SiteContent } from '../../../shared/types.ts';

export function SiteCmsPanel({ onOpenStorefrontPreview }: { onOpenStorefrontPreview: () => void }) {
  const { siteContent, setPreviewContent, token, user, pushToast } = useApp();
  const [draft, setDraft] = useState<SiteContent | null>(siteContent);
  const [activeSection, setActiveSection] = useState<'brand' | 'hero' | 'metrics' | 'story' | 'contact'>('hero');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (siteContent && !draft) {
      setDraft(siteContent);
    }
  }, [siteContent, draft]);

  if (!draft) return null;

  const canEdit = user?.role === 'admin' || user?.permissions.canEditSiteContent;

  const updateDraft = (patch: Partial<SiteContent>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setPreviewContent(next);
  };

  const handlePublish = async () => {
    if (!token || !canEdit) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ content: SiteContent }>('/api/admin/content', {
        method: 'PUT',
        body: draft,
        token,
      });
      setDraft(res.content);
      setPreviewContent(null);
      pushToast({
        title: 'Storefront Published',
        message: 'Full-page content changes are now live for all visitors.',
        type: 'cms',
      });
    } catch (err: unknown) {
      pushToast({
        title: 'Publish Failed',
        message: err instanceof Error ? err.message : 'Unable to save content',
        type: 'system',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!token || user?.role !== 'admin') return;
    try {
      const res = await apiRequest<{ content: SiteContent }>('/api/admin/content/reset', {
        method: 'POST',
        token,
      });
      setDraft(res.content);
      setPreviewContent(null);
      pushToast({ title: 'Defaults Restored', message: 'Storefront copy reset to default.', type: 'cms' });
    } catch (err: unknown) {
      pushToast({
        title: 'Reset Failed',
        message: err instanceof Error ? err.message : 'Unable to reset content',
        type: 'system',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex items-center gap-1 overflow-x-auto rounded-xl border p-1"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          {(
            [
              ['hero', 'Hero & Banner'],
              ['brand', 'Brand & Catalog'],
              ['metrics', 'Trust Metrics'],
              ['story', 'Process Story'],
              ['contact', 'Showroom & Footer'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0"
              style={
                activeSection === id
                  ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }
                  : { color: 'var(--site-muted)' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenStorefrontPreview}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--site-surface)',
              borderColor: 'var(--site-border)',
              color: 'var(--site-text)',
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Preview Live Page</span>
          </button>
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => void handleReset()}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
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
            onClick={() => void handlePublish()}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap disabled:opacity-60"
            style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Publishing…' : 'Publish Live'}</span>
          </button>
        </div>
      </div>

      <div
        className="rounded-2xl border p-6"
        style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
      >
        {activeSection === 'hero' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold">Top Announcement Banner</label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.announcementEnabled}
                    onChange={(e) => updateDraft({ announcementEnabled: e.target.checked })}
                  />
                  <span>Visible</span>
                </label>
              </div>
              <input
                value={draft.announcementText}
                onChange={(e) => updateDraft({ announcementText: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />

              <div>
                <label className="block text-xs font-semibold mb-1.5">Hero Kicker</label>
                <input
                  value={draft.heroKicker}
                  onChange={(e) => updateDraft({ heroKicker: e.target.value })}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Hero Headline</label>
                <input
                  value={draft.heroHeadline}
                  onChange={(e) => updateDraft({ heroHeadline: e.target.value })}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Hero Subheadline</label>
                <textarea
                  rows={3}
                  value={draft.heroSubheadline}
                  onChange={(e) => updateDraft({ heroSubheadline: e.target.value })}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none resize-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Primary Button Text</label>
                  <input
                    value={draft.heroPrimaryCta}
                    onChange={(e) => updateDraft({ heroPrimaryCta: e.target.value })}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Secondary Button Text</label>
                  <input
                    value={draft.heroSecondaryCta}
                    onChange={(e) => updateDraft({ heroSecondaryCta: e.target.value })}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Hero Image URL</label>
                <input
                  value={draft.heroImageUrl}
                  onChange={(e) => updateDraft({ heroImageUrl: e.target.value })}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-xs font-mono-tabular outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>

              <div className="overflow-hidden rounded-xl border aspect-[16/9]" style={{ borderColor: 'var(--site-border)' }}>
                <img
                  src={draft.heroImageUrl}
                  alt="Hero preview"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'brand' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Dealership Brand Name</label>
              <input
                value={draft.brandName}
                onChange={(e) => updateDraft({ brandName: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Tagline</label>
              <input
                value={draft.tagline}
                onChange={(e) => updateDraft({ tagline: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Brand Logo URL</label>
              <input
                value={draft.logoUrl}
                onChange={(e) => updateDraft({ logoUrl: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs font-mono-tabular outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Showroom Card / Banner URL</label>
              <input
                value={draft.bannerUrl}
                onChange={(e) => updateDraft({ bannerUrl: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs font-mono-tabular outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Inventory Section Title</label>
              <input
                value={draft.catalogTitle}
                onChange={(e) => updateDraft({ catalogTitle: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Inventory Section Subtitle</label>
              <textarea
                rows={2}
                value={draft.catalogSubtitle}
                onChange={(e) => updateDraft({ catalogSubtitle: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none resize-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
          </div>
        )}

        {activeSection === 'metrics' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {draft.trustMetrics.map((m, idx) => (
              <div
                key={idx}
                className="rounded-xl border p-4 space-y-3"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              >
                <p className="text-xs font-semibold" style={{ color: 'var(--site-accent-bright)' }}>
                  Metric Slot 0{idx + 1}
                </p>
                <input
                  value={m.value}
                  onChange={(e) => {
                    const copy = [...draft.trustMetrics];
                    copy[idx] = { ...copy[idx], value: e.target.value };
                    updateDraft({ trustMetrics: copy });
                  }}
                  placeholder="Headline stat"
                  className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none"
                  style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
                />
                <input
                  value={m.label}
                  onChange={(e) => {
                    const copy = [...draft.trustMetrics];
                    copy[idx] = { ...copy[idx], label: e.target.value };
                    updateDraft({ trustMetrics: copy });
                  }}
                  placeholder="Supporting label"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
                />
              </div>
            ))}
          </div>
        )}

        {activeSection === 'story' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Process Section Title</label>
              <input
                value={draft.storyTitle}
                onChange={(e) => updateDraft({ storyTitle: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Process Narrative</label>
              <textarea
                rows={3}
                value={draft.storyBody}
                onChange={(e) => updateDraft({ storyBody: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none resize-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {draft.storyHighlights.map((h, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border p-4 space-y-2.5"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                >
                  <input
                    value={h.title}
                    onChange={(e) => {
                      const copy = [...draft.storyHighlights];
                      copy[idx] = { ...copy[idx], title: e.target.value };
                      updateDraft({ storyHighlights: copy });
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-xs font-semibold outline-none"
                    style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
                  />
                  <textarea
                    rows={3}
                    value={h.detail}
                    onChange={(e) => {
                      const copy = [...draft.storyHighlights];
                      copy[idx] = { ...copy[idx], detail: e.target.value };
                      updateDraft({ storyHighlights: copy });
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-xs outline-none resize-none"
                    style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'contact' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Showroom Street Address</label>
              <input
                value={draft.showroomAddress}
                onChange={(e) => updateDraft({ showroomAddress: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">City & Pincode</label>
              <input
                value={draft.showroomCity}
                onChange={(e) => updateDraft({ showroomCity: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Call Numbers (separate multiple numbers with /)</label>
              <input
                value={draft.contactPhone}
                onChange={(e) => updateDraft({ contactPhone: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs font-mono-tabular outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">WhatsApp Number</label>
              <input
                value={draft.whatsappNumber}
                onChange={(e) => updateDraft({ whatsappNumber: e.target.value })}
                placeholder="919385588888"
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs font-mono-tabular outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
              <p className="mt-1 text-[11px]" style={{ color: 'var(--site-muted)' }}>
                Include country code. Used by the WhatsApp buttons on every car card.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Card Call Number</label>
              <input
                value={draft.cardCallNumber}
                onChange={(e) => updateDraft({ cardCallNumber: e.target.value })}
                placeholder="9385588888"
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs font-mono-tabular outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
              <p className="mt-1 text-[11px]" style={{ color: 'var(--site-muted)' }}>
                Constant number used by the Call button on every car card. Default: 93855 88888.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Card WhatsApp Number</label>
              <input
                value={draft.cardWhatsappNumber}
                onChange={(e) => updateDraft({ cardWhatsappNumber: e.target.value })}
                placeholder="9385588888"
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs font-mono-tabular outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
              <p className="mt-1 text-[11px]" style={{ color: 'var(--site-muted)' }}>
                Constant number used by the WhatsApp button on every car card. Default: 93855 88888.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Contact Email</label>
              <input
                value={draft.contactEmail}
                onChange={(e) => updateDraft({ contactEmail: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Business Hours</label>
              <input
                value={draft.businessHours}
                onChange={(e) => updateDraft({ businessHours: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Footer Legal / Copyright Line</label>
              <input
                value={draft.footerNote}
                onChange={(e) => updateDraft({ footerNote: e.target.value })}
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
