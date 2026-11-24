import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  Car,
  CheckCheck,
  FileEdit,
  LayoutGrid,
  MessageSquare,
  Palette,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatRelativeTime } from '../lib/format.ts';
import type { UserAccount } from '../../shared/types.ts';
import { AnalyticsPanel } from './dashboard/AnalyticsPanel.tsx';
import { InventoryPanel } from './dashboard/InventoryPanel.tsx';
import { EnquiriesPanel } from './dashboard/EnquiriesPanel.tsx';
import { StaffUsersPanel } from './dashboard/StaffUsersPanel.tsx';
import { SiteCmsPanel } from './dashboard/SiteCmsPanel.tsx';
import { ThemeStudioPanel } from './dashboard/ThemeStudioPanel.tsx';

export type DashboardTabId =
  | 'analytics'
  | 'inventory'
  | 'enquiries'
  | 'users'
  | 'staff'
  | 'cms'
  | 'theme'
  | 'notifications';

type TabId = DashboardTabId;

export function AdminDashboard({
  onOpenStorefront,
  initialTab,
}: {
  onOpenStorefront: () => void;
  initialTab?: DashboardTabId;
}) {
  const {
    siteContent,
    user,
    token,
    notifications,
    unreadCount,
    wsConnected,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp();

  const [activeTab, setActiveTab] = useState<TabId>(initialTab || 'analytics');
  const [usersList, setUsersList] = useState<UserAccount[]>([]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const refreshUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest<{ users: UserAccount[] }>('/api/admin/users', { token });
      setUsersList(res.users);
    } catch {
      // Ignore if insufficient role
    }
  }, [token]);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return null;
  }

  const isAdmin = user.role === 'admin';
  const canEditSite = isAdmin || user.permissions.canEditSiteContent;
  const staffMembers = usersList.filter((u) => u.role === 'admin' || u.role === 'staff');

  const navItems: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; hidden?: boolean }> = [
    { id: 'analytics', label: 'Site Analytics', icon: BarChart3 },
    { id: 'inventory', label: 'Inventory', icon: Car },
    { id: 'enquiries', label: 'Enquiries CRM', icon: MessageSquare },
    { id: 'users', label: 'Customer Data', icon: Users },
    { id: 'staff', label: 'Staff Setup', icon: ShieldCheck, hidden: !isAdmin },
    { id: 'cms', label: 'Full-Page Editor', icon: FileEdit, hidden: !canEditSite },
    { id: 'theme', label: 'Website Colors', icon: Palette, hidden: !canEditSite },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const activeLabel = navItems.find((i) => i.id === activeTab)?.label || 'Console';

  return (
    <div
      className="min-h-[calc(100vh-65px)]"
      style={{ backgroundColor: 'var(--site-bg)', color: 'var(--site-text)' }}
    >
      <div className="mx-auto flex max-w-[1440px] flex-col lg:flex-row">
        {/* Sidebar */}
        <aside
          className="w-full shrink-0 border-b p-4 lg:w-64 lg:border-b-0 lg:border-r lg:min-h-[calc(100vh-65px)]"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          <div className="mb-4 flex items-center gap-3 px-2">
            {siteContent?.logoUrl && (
              <img
                src={siteContent.logoUrl}
                alt={siteContent.brandName}
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-full object-cover border shrink-0"
                style={{ borderColor: 'var(--site-accent)' }}
              />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--site-muted)' }}>
                {isAdmin ? 'Administrator Console' : 'Staff Workspace'}
              </p>
              <p className="mt-0.5 font-display text-sm font-bold truncate">{user.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--site-muted)' }}>
                {user.staffCode || user.email}
              </p>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {navItems
              .filter((item) => !item.hidden)
              .map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    style={
                      active
                        ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }
                        : { color: 'var(--site-muted)' }
                    }
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {item.id === 'notifications' && unreadCount > 0 && (
                      <span
                        className="rounded-md px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold"
                        style={
                          active
                            ? { backgroundColor: 'rgba(0,0,0,0.2)', color: 'inherit' }
                            : { backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }
                        }
                      >
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 p-6 lg:p-8 min-w-0">
          {/* Top Breadcrumb Header */}
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4"
            style={{ borderColor: 'var(--site-border)' }}
          >
            <div>
              <p className="text-xs" style={{ color: 'var(--site-muted)' }}>
                Operations / {activeLabel}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">{activeLabel}</h1>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--site-surface)',
                  borderColor: 'var(--site-border)',
                  color: 'var(--site-text)',
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: wsConnected ? '#22c55e' : '#ef4444' }}
                />
                <Bell className="h-3.5 w-3.5" />
                <span className="font-mono-tabular">{unreadCount} Unread</span>
              </button>

              <button
                type="button"
                onClick={onOpenStorefront}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--site-surface)',
                  borderColor: 'var(--site-border)',
                  color: 'var(--site-text)',
                }}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Open Storefront</span>
              </button>
            </div>
          </div>

          {activeTab === 'analytics' && <AnalyticsPanel />}
          {activeTab === 'inventory' && <InventoryPanel />}
          {activeTab === 'enquiries' && <EnquiriesPanel staffMembers={staffMembers} />}
          {activeTab === 'users' && (
            <StaffUsersPanel users={usersList} onRefreshUsers={refreshUsers} mode="users" />
          )}
          {activeTab === 'staff' && isAdmin && (
            <StaffUsersPanel users={usersList} onRefreshUsers={refreshUsers} mode="staff" />
          )}
          {activeTab === 'cms' && canEditSite && (
            <SiteCmsPanel onOpenStorefrontPreview={onOpenStorefront} />
          )}
          {activeTab === 'theme' && canEditSite && (
            <ThemeStudioPanel onOpenStorefrontPreview={onOpenStorefront} />
          )}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--site-muted)' }}>
                  Real-time WebSocket updates for enquiries, inventory mutations, user signups, and CMS edits.
                </p>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllNotificationsRead()}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--site-surface)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Mark All Read</span>
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div
                  className="rounded-2xl border p-10 text-center text-sm"
                  style={{
                    backgroundColor: 'var(--site-surface)',
                    borderColor: 'var(--site-border)',
                    color: 'var(--site-muted)',
                  }}
                >
                  No notifications yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notifications.map((n) => {
                    const isRead = n.readBy.includes(user.id);
                    return (
                      <div
                        key={n.id}
                        className="flex items-start justify-between gap-4 rounded-2xl border p-4"
                        style={{
                          backgroundColor: 'var(--site-surface)',
                          borderColor: isRead ? 'var(--site-border)' : 'var(--site-accent)',
                        }}
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-display text-sm font-semibold">{n.title}</span>
                            <span aria-hidden="true" style={{ color: 'var(--site-muted)' }}>·</span>
                            <span className="uppercase text-[11px]" style={{ color: 'var(--site-accent-bright)' }}>
                              {n.type}
                            </span>
                            <span aria-hidden="true" style={{ color: 'var(--site-muted)' }}>·</span>
                            <span className="font-mono-tabular text-[11px]" style={{ color: 'var(--site-muted)' }}>
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                            {n.message}
                          </p>
                        </div>

                        {!isRead && (
                          <button
                            type="button"
                            onClick={() => void markNotificationRead(n.id)}
                            className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold shrink-0"
                            style={{ borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
