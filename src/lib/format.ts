export function formatInrLakhs(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '₹—';
  if (amount >= 10_000_000) {
    return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
  }
  if (amount >= 100_000) {
    return `₹${(amount / 100_000).toFixed(2)} L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatInrFull(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '₹—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatKm(km: string): string {
  const numeric = Number(String(km).replace(/[^0-9]/g, ''));
  if (!numeric) return km || '—';
  return `${numeric.toLocaleString('en-IN')} km`;
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function safeExternalHref(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('tel:') || trimmed.startsWith('mailto:') || trimmed.startsWith('#')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString();
  } catch {
    return '#';
  }
  return '#';
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const srgb = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 1;
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}
