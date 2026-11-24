import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../lib/api.ts';
import type {
  AnalyticsSummary,
  AppNotification,
  BootstrapStatus,
  Enquiry,
  SiteContent,
  ThemeColors,
  UserAccount,
  Vehicle,
} from '../../shared/types.ts';

interface LiveToast {
  id: string;
  title: string;
  message: string;
  type: AppNotification['type'];
}

interface AppContextValue {
  loading: boolean;
  siteContent: SiteContent | null;
  themeColors: ThemeColors | null;
  previewContent: SiteContent | null;
  previewTheme: ThemeColors | null;
  setPreviewContent: (c: SiteContent | null) => void;
  setPreviewTheme: (t: ThemeColors | null) => void;
  vehicles: Vehicle[];
  enquiries: Enquiry[];
  notifications: AppNotification[];
  unreadCount: number;
  analytics: AnalyticsSummary | null;
  wsConnected: boolean;
  wsClients: number;
  user: UserAccount | null;
  token: string | null;
  bootstrapStatus: BootstrapStatus;
  shortlist: string[];
  toasts: LiveToast[];
  dismissToast: (id: string) => void;
  pushToast: (toast: Omit<LiveToast, 'id'>) => void;
  setSession: (user: UserAccount | null, token: string | null) => void;
  logout: () => void;
  refreshPublic: () => Promise<void>;
  refreshProtected: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  prependEnquiry: (enquiry: Enquiry) => void;
  toggleShortlist: (vehicleId: string) => Promise<void>;
  trackAnalytics: (payload: {
    type: 'page_view' | 'vehicle_view' | 'search' | 'shortlist' | 'enquiry';
    path: string;
    vehicleId?: string;
    label?: string;
  }) => void;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function createSessionId(): string {
  return `ses-${Math.random().toString(36).slice(2, 10)}`;
}

function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'Mobile Web';
  if (/Tablet|iPad/i.test(ua)) return 'Tablet';
  return 'Desktop Web';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [siteContent, setSiteContent] = useState<SiteContent | null>(null);
  const [themeColors, setThemeColors] = useState<ThemeColors | null>(null);
  const [previewContent, setPreviewContent] = useState<SiteContent | null>(null);
  const [previewTheme, setPreviewTheme] = useState<ThemeColors | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsClients, setWsClients] = useState(1);

  // Token & user strictly in React memory (no localStorage)
  const [user, setUser] = useState<UserAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [guestShortlist, setGuestShortlist] = useState<string[]>([]);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus>({
    adminClaimed: true,
    envOverrideActive: false,
  });
  const [toasts, setToasts] = useState<LiveToast[]>([]);

  const sessionIdRef = useRef<string>(createSessionId());
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const pushToast = useCallback((toast: Omit<LiveToast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ id, ...toast }, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshBootstrap = useCallback(async () => {
    try {
      const status = await apiRequest<BootstrapStatus>('/api/auth/bootstrap-status');
      setBootstrapStatus(status);
    } catch {
      // Ignore transient error
    }
  }, []);

  const refreshPublic = useCallback(async () => {
    try {
      const siteRes = await apiRequest<{ content: SiteContent; theme: ThemeColors }>('/api/site');
      setSiteContent(siteRes.content);
      setThemeColors(siteRes.theme);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProtected = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;
    try {
      const [vehRes, notifRes] = await Promise.all([
        apiRequest<{ vehicles: Vehicle[] }>('/api/vehicles', { token: currentToken }),
        apiRequest<{ notifications: AppNotification[] }>('/api/notifications', { token: currentToken }),
      ]);
      setVehicles(vehRes.vehicles);
      setNotifications(notifRes.notifications);

      if (user && (user.role === 'admin' || user.role === 'staff')) {
        const [enqRes, analyticsRes] = await Promise.all([
          apiRequest<{ enquiries: Enquiry[] }>('/api/enquiries', { token: currentToken }),
          apiRequest<{ summary: AnalyticsSummary; wsClients: number }>('/api/admin/analytics', {
            token: currentToken,
          }),
        ]);
        setEnquiries(enqRes.enquiries);
        setAnalytics(analyticsRes.summary);
        setWsClients(analyticsRes.wsClients);
      } else if (user) {
        const myEnqRes = await apiRequest<{ enquiries: Enquiry[] }>('/api/me/enquiries', {
          token: currentToken,
        });
        setEnquiries(myEnqRes.enquiries);
      }
    } catch {
      // Ignore if session expired or role lacks access
    }
  }, [user]);

  useEffect(() => {
    void Promise.all([refreshPublic(), refreshBootstrap()]);
  }, [refreshPublic, refreshBootstrap]);

  useEffect(() => {
    if (token && user) {
      void refreshProtected();
    } else {
      setVehicles([]);
      setEnquiries([]);
      setNotifications([]);
      setAnalytics(null);
    }
  }, [token, user, refreshProtected]);

  // Apply live theme CSS variables whenever themeColors or previewTheme changes
  const activeTheme = previewTheme || themeColors;
  useEffect(() => {
    if (!activeTheme) return;
    const root = document.documentElement;
    root.style.setProperty('--site-bg', activeTheme.bg);
    root.style.setProperty('--site-surface', activeTheme.surface);
    root.style.setProperty('--site-surface-alt', activeTheme.surfaceAlt);
    root.style.setProperty('--site-border', activeTheme.border);
    root.style.setProperty('--site-text', activeTheme.text);
    root.style.setProperty('--site-muted', activeTheme.muted);
    root.style.setProperty('--site-accent', activeTheme.accent);
    root.style.setProperty('--site-accent-bright', activeTheme.accentBright);
    root.style.setProperty('--site-accent-contrast', activeTheme.accentContrast);
    if (activeTheme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [activeTheme]);

  // Real-time WebSocket connection
  useEffect(() => {
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const qs = tokenRef.current ? `?token=${encodeURIComponent(tokenRef.current)}` : '';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws${qs}`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setWsConnected(true);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as { event: string; payload: any };
          if (msg.event === 'content:updated' && msg.payload?.content) {
            setSiteContent(msg.payload.content);
          } else if (msg.event === 'theme:updated' && msg.payload?.theme) {
            setThemeColors(msg.payload.theme);
          } else if (msg.event === 'inventory:updated') {
            const { action, vehicle, id } = msg.payload || {};
            if (action === 'create' && vehicle) {
              setVehicles((prev) => (prev.some((v) => v.id === vehicle.id) ? prev : [vehicle, ...prev]));
            } else if (action === 'update' && vehicle) {
              setVehicles((prev) => prev.map((v) => (v.id === vehicle.id ? vehicle : v)));
            } else if (action === 'delete' && id) {
              setVehicles((prev) => prev.filter((v) => v.id !== id));
            }
          } else if (msg.event === 'enquiry:updated') {
            const { action, enquiry, id } = msg.payload || {};
            if (action === 'create' && enquiry) {
              setEnquiries((prev) => (prev.some((e) => e.id === enquiry.id) ? prev : [enquiry, ...prev]));
            } else if (action === 'update' && enquiry) {
              setEnquiries((prev) => prev.map((e) => (e.id === enquiry.id ? enquiry : e)));
            } else if (action === 'delete' && id) {
              setEnquiries((prev) => prev.filter((e) => e.id !== id));
            }
          } else if (msg.event === 'analytics:tick' && msg.payload?.summary) {
            setAnalytics(msg.payload.summary);
          } else if (msg.event === 'notification:new' && msg.payload?.id) {
            const notif = msg.payload as AppNotification;
            setNotifications((prev) => (prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]));
            pushToast({ title: notif.title, message: notif.message, type: notif.type });
          }
        } catch {
          // Ignore malformed WS frames
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closed && attempt < 3) {
          const delay = Math.min(10000, 1000 * Math.pow(1.6, attempt++));
          retryTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [pushToast]);

  // Sync WS auth when user signs in/out
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (token) {
        ws.send(JSON.stringify({ type: 'auth', token }));
      } else {
        ws.send(JSON.stringify({ type: 'auth:clear' }));
      }
    }
  }, [token]);

  const setSession = useCallback((nextUser: UserAccount | null, nextToken: string | null) => {
    setUser(nextUser);
    setToken(nextToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setPreviewContent(null);
    setPreviewTheme(null);
  }, []);

  const prependEnquiry = useCallback((enquiry: Enquiry) => {
    setEnquiries((prev) => (prev.some((e) => e.id === enquiry.id) ? prev : [enquiry, ...prev]));
  }, []);

  const trackAnalytics = useCallback(
    (payload: {
      type: 'page_view' | 'vehicle_view' | 'search' | 'shortlist' | 'enquiry';
      path: string;
      vehicleId?: string;
      label?: string;
    }) => {
      void fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          sessionId: sessionIdRef.current,
          device: detectDevice(),
        }),
      }).catch(() => {});
    },
    []
  );

  const shortlist = user ? user.shortlistedIds : guestShortlist;

  const toggleShortlist = useCallback(
    async (vehicleId: string) => {
      trackAnalytics({ type: 'shortlist', path: `/inventory/${vehicleId}`, vehicleId });
      if (token && user) {
        try {
          const res = await apiRequest<{ user: UserAccount }>('/api/me/shortlist', {
            method: 'POST',
            body: { vehicleId },
            token,
          });
          setUser(res.user);
        } catch {
          // Ignore
        }
      } else {
        setGuestShortlist((prev) =>
          prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId]
        );
      }
    },
    [token, user, trackAnalytics]
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      if (!token || !user) return;
      await apiRequest(`/api/notifications/${id}/read`, { method: 'POST', token });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id && !n.readBy.includes(user.id) ? { ...n, readBy: [...n.readBy, user.id] } : n))
      );
    },
    [token, user]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!token || !user) return;
    await apiRequest('/api/notifications/read-all', { method: 'POST', token });
    setNotifications((prev) =>
      prev.map((n) => (n.readBy.includes(user.id) ? n : { ...n, readBy: [...n.readBy, user.id] }))
    );
  }, [token, user]);

  const unreadCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter((n) => !n.readBy.includes(user.id)).length;
  }, [notifications, user]);

  const value: AppContextValue = {
    loading,
    siteContent: previewContent || siteContent,
    themeColors: activeTheme || null,
    previewContent,
    previewTheme,
    setPreviewContent,
    setPreviewTheme,
    vehicles,
    enquiries,
    notifications,
    unreadCount,
    analytics,
    wsConnected,
    wsClients,
    user,
    token,
    bootstrapStatus,
    shortlist,
    toasts,
    dismissToast,
    pushToast,
    setSession,
    logout,
    refreshPublic,
    refreshProtected,
    refreshBootstrap,
    prependEnquiry,
    toggleShortlist,
    trackAnalytics,
    markNotificationRead,
    markAllNotificationsRead,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
