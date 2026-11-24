import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { formatRelativeTime } from '../../lib/format.ts';

export function AnalyticsPanel() {
  const { analytics, vehicles, enquiries, wsConnected, wsClients } = useApp();

  if (!analytics) {
    return (
      <div
        className="rounded-2xl border p-8 text-center text-sm"
        style={{
          backgroundColor: 'var(--site-surface)',
          borderColor: 'var(--site-border)',
          color: 'var(--site-muted)',
        }}
      >
        Loading live site analytics…
      </div>
    );
  }

  const maxDailyViews = Math.max(10, ...analytics.dailySeries.map((d) => d.views));
  const availableCount = vehicles.filter((v) => v.status === 'Available').length;
  const totalInventoryValue = vehicles
    .filter((v) => v.status === 'Available')
    .reduce((sum, v) => sum + v.finalPrice, 0);

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--site-muted)' }}>
            Total Page & Vehicle Views
          </p>
          <p className="mt-2 font-mono-tabular text-2xl font-bold" style={{ color: 'var(--site-text)' }}>
            {analytics.totalPageViews.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs font-mono-tabular" style={{ color: 'var(--site-accent-bright)' }}>
            {analytics.uniqueSessions} unique sessions
          </p>
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--site-muted)' }}>
            Enquiries & Lead Conversion
          </p>
          <p className="mt-2 font-mono-tabular text-2xl font-bold" style={{ color: 'var(--site-text)' }}>
            {analytics.totalEnquiries}
          </p>
          <p className="mt-1 text-xs font-mono-tabular" style={{ color: 'var(--site-accent-bright)' }}>
            {analytics.conversionRate}% view-to-enquiry rate
          </p>
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--site-muted)' }}>
            Active Showroom Stock
          </p>
          <p className="mt-2 font-mono-tabular text-2xl font-bold" style={{ color: 'var(--site-text)' }}>
            {availableCount} / {vehicles.length}
          </p>
          <p className="mt-1 text-xs font-mono-tabular" style={{ color: 'var(--site-muted)' }}>
            ₹{(totalInventoryValue / 10_000_000).toFixed(2)} Cr total value
          </p>
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--site-muted)' }}>
            Real-Time Socket Stream
          </p>
          <p className="mt-2 flex items-center gap-2 font-mono-tabular text-2xl font-bold">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: wsConnected ? '#22c55e' : '#ef4444' }}
            />
            <span>{wsConnected ? 'Live' : 'Reconnecting'}</span>
          </p>
          <p className="mt-1 text-xs font-mono-tabular" style={{ color: 'var(--site-muted)' }}>
            {wsClients} active client{wsClients === 1 ? '' : 's'} · {enquiries.filter((e) => e.status !== 'Closed').length} open leads
          </p>
        </div>
      </div>

      {/* 7-Day Traffic Chart + Fuel Mix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div
          className="rounded-2xl border p-5 lg:col-span-8"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold">7-Day Traffic & Enquiry Trend</h3>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--site-muted)' }}>
                Daily storefront views paired with customer enquiry submissions
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--site-muted)' }}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--site-accent)' }} />
                Views
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
                Enquiries
              </span>
            </div>
          </div>

          <div className="mt-6 h-56 w-full">
            <svg viewBox="0 0 640 200" className="h-full w-full overflow-visible" role="img" aria-label="7 day traffic chart">
              {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
                const y = 165 - frac * 140;
                const val = Math.round(maxDailyViews * frac);
                return (
                  <g key={i}>
                    <line x1={38} x2={625} y1={y} y2={y} stroke="var(--site-border)" strokeWidth="1" />
                    <text x={30} y={y + 4} textAnchor="end" fontSize="10" fill="var(--site-muted)" fontFamily="var(--font-mono)">
                      {val}
                    </text>
                  </g>
                );
              })}

              {analytics.dailySeries.map((day, idx) => {
                const barSlot = (625 - 48) / Math.max(1, analytics.dailySeries.length);
                const xCenter = 48 + idx * barSlot + barSlot / 2;
                const barH = Math.max(3, (day.views / maxDailyViews) * 140);
                const enqH = Math.min(140, day.enquiries * 14);
                return (
                  <g key={day.date}>
                    <rect
                      x={xCenter - 16}
                      y={165 - barH}
                      width={20}
                      height={barH}
                      rx={4}
                      fill="var(--site-accent)"
                    />
                    <rect
                      x={xCenter + 8}
                      y={165 - enqH}
                      width={10}
                      height={Math.max(2, enqH)}
                      rx={3}
                      fill="#22c55e"
                    />
                    <text
                      x={xCenter}
                      y={186}
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--site-muted)"
                      fontFamily="var(--font-mono)"
                    >
                      {day.date.slice(5)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div
          className="rounded-2xl border p-5 lg:col-span-4"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <h3 className="font-display text-base font-semibold">Inventory Fuel Breakdown</h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--site-muted)' }}>
            Distribution across active showroom stock
          </p>
          <div className="mt-5 space-y-3.5">
            {analytics.fuelBreakdown.map((item) => {
              const pct = vehicles.length ? Math.round((item.count / vehicles.length) * 100) : 0;
              return (
                <div key={item.fuel}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{item.fuel}</span>
                    <span className="font-mono-tabular" style={{ color: 'var(--site-muted)' }}>
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--site-bg)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: 'var(--site-accent)' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Vehicles & Live Event Stream */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div
          className="rounded-2xl border p-5 lg:col-span-7"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <h3 className="font-display text-base font-semibold">Most Viewed Vehicles</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--site-border)', color: 'var(--site-muted)' }}>
                  <th className="py-2.5 pr-4 font-medium">Vehicle</th>
                  <th className="py-2.5 px-3 text-right font-medium">Views</th>
                  <th className="py-2.5 pl-3 text-right font-medium">Enquiries</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--site-border)' }}>
                {analytics.topVehicles.map((v) => (
                  <tr key={v.id} className="h-10">
                    <td className="py-2 pr-4 font-medium">{v.label}</td>
                    <td className="py-2 px-3 text-right font-mono-tabular">{v.views}</td>
                    <td className="py-2 pl-3 text-right font-mono-tabular" style={{ color: 'var(--site-accent-bright)' }}>
                      {v.enquiries}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div
          className="rounded-2xl border p-5 lg:col-span-5"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <h3 className="font-display text-base font-semibold">Recent Site Activity</h3>
          <div className="mt-4 space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {analytics.recentEvents.slice(0, 12).map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-3 border-b pb-2 text-xs last:border-0"
                style={{ borderColor: 'var(--site-border)' }}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{ev.label || ev.path}</p>
                  <p className="text-[11px]" style={{ color: 'var(--site-muted)' }}>
                    {ev.type.replace('_', ' ')} · {ev.device}
                  </p>
                </div>
                <span className="font-mono-tabular text-[11px] shrink-0" style={{ color: 'var(--site-muted)' }}>
                  {formatRelativeTime(ev.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
