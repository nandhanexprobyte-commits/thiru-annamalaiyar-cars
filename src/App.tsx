import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { StorefrontView } from './components/StorefrontView.tsx';
import { AdminDashboard, type DashboardTabId } from './components/AdminDashboard.tsx';
import { AuthModal } from './components/AuthModal.tsx';

import { LandingGateView } from './components/LandingGateView.tsx';

function MainShell() {
  const { loading, user, toasts, dismissToast } = useApp();
  const [activeView, setActiveView] = useState<'storefront' | 'dashboard'>('storefront');
  const [dashboardTab, setDashboardTab] = useState<DashboardTabId>('analytics');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'claim'>('login');
  const [enquiryTrigger, setEnquiryTrigger] = useState(0);

  const isOperator = user && (user.role === 'admin' || user.role === 'staff');

  const handleOpenAuth = (mode: 'login' | 'register' | 'claim' = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-6 text-sm"
        style={{ backgroundColor: 'var(--site-bg)', color: 'var(--site-muted)' }}
      >
        Loading showroom platform…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--site-bg)', color: 'var(--site-text)' }}>
      {!user ? (
        <LandingGateView
          onUnlocked={() => {
            setActiveView('storefront');
          }}
        />
      ) : (
        <>
          <Navbar
            activeView={isOperator && activeView === 'dashboard' ? 'dashboard' : 'storefront'}
            onSwitchView={(v) => {
              if (v === 'dashboard') setDashboardTab('analytics');
              setActiveView(v);
            }}
            onOpenAuth={handleOpenAuth}
            onOpenEnquiry={() => {
              setActiveView('storefront');
              setEnquiryTrigger((n) => n + 1);
            }}
          />

          {isOperator && activeView === 'dashboard' ? (
            <AdminDashboard
              initialTab={dashboardTab}
              onOpenStorefront={() => setActiveView('storefront')}
            />
          ) : (
            <StorefrontView
              externalEnquiryTrigger={enquiryTrigger}
              onOpenManageStaff={() => {
                setDashboardTab('staff');
                setActiveView('dashboard');
              }}
            />
          )}

          <AuthModal
            open={authModalOpen}
            initialMode={authMode}
            onClose={() => setAuthModalOpen(false)}
            onSuccess={(loggedInUser) => {
              if (loggedInUser.role === 'admin' || loggedInUser.role === 'staff') {
                setActiveView('dashboard');
              } else {
                setActiveView('storefront');
              }
            }}
          />
        </>
      )}

      {/* Real-time Notification Toast Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 pointer-events-none px-4 sm:px-0"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start justify-between gap-3 rounded-xl border p-3.5 shadow-xl backdrop-blur-md"
              style={{
                backgroundColor: 'var(--site-surface)',
                borderColor: 'var(--site-accent)',
                color: 'var(--site-text)',
              }}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--site-accent-bright)' }}>
                  {t.title}
                </p>
                <p className="mt-0.5 text-xs leading-snug" style={{ color: 'var(--site-muted)' }}>
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 p-1 hover:opacity-80"
                style={{ color: 'var(--site-muted)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}
