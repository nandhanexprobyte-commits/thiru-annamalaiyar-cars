import React from 'react';
import { useApp } from '../context/AppContext.tsx';

interface NavbarProps {
  activeView: 'storefront' | 'dashboard';
  onSwitchView: (view: 'storefront' | 'dashboard') => void;
  onOpenAuth: (mode?: 'login' | 'register' | 'claim') => void;
  onOpenEnquiry: () => void;
}

export function Navbar({ activeView, onSwitchView, onOpenAuth, onOpenEnquiry }: NavbarProps) {
  const { siteContent, user, bootstrapStatus, logout } = useApp();
  const isOperator = user && (user.role === 'admin' || user.role === 'staff');

  const handlePrimaryAction = () => {
    if (isOperator) {
      onSwitchView(activeView === 'dashboard' ? 'storefront' : 'dashboard');
      return;
    }
    if (user) {
      logout();
      return;
    }
    if (!bootstrapStatus.adminClaimed && !bootstrapStatus.envOverrideActive) {
      onOpenAuth('claim');
      return;
    }
    onOpenAuth('login');
  };

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--site-bg) 90%, transparent)',
        borderColor: 'var(--site-border)',
      }}
    >
      <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Brand mark + wordmark */}
        <button
          type="button"
          onClick={() => {
            onSwitchView('storefront');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-3 text-left text-lg font-bold tracking-tight font-display whitespace-nowrap shrink-0"
          style={{ color: 'var(--site-text)' }}
        >
          {siteContent?.logoUrl && (
            <img
              src={siteContent.logoUrl}
              alt={`${siteContent.brandName} emblem`}
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-full object-cover border shrink-0"
              style={{ borderColor: 'var(--site-accent)' }}
            />
          )}
          <span>{siteContent?.brandName || 'Thiru Annamalaiyar Cars'}</span>
        </button>

        {/* Zone 2: 4–5 clean single-line text nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: 'var(--site-muted)' }}>
          <a
            href="#inventory"
            onClick={() => onSwitchView('storefront')}
            className="transition-colors hover:opacity-100 whitespace-nowrap shrink-0"
            style={{ color: activeView === 'storefront' ? 'var(--site-text)' : 'var(--site-muted)' }}
          >
            Inventory
          </a>
          <a
            href="#enquiries"
            onClick={() => onSwitchView('storefront')}
            className="transition-colors hover:opacity-90 whitespace-nowrap shrink-0"
          >
            Add Enquiry
          </a>
          <a
            href="#showroom"
            onClick={() => onSwitchView('storefront')}
            className="transition-colors hover:opacity-90 whitespace-nowrap shrink-0"
          >
            Showroom
          </a>
          {isOperator && (
            <button
              type="button"
              onClick={logout}
              className="transition-colors hover:opacity-90 whitespace-nowrap shrink-0"
            >
              Sign Out
            </button>
          )}
        </nav>

        {/* Zone 3: 1 Primary CTA button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
            style={{
              backgroundColor: 'var(--site-accent)',
              color: 'var(--site-accent-contrast)',
            }}
          >
            {isOperator
              ? activeView === 'dashboard'
                ? 'View Storefront'
                : 'Admin Console'
              : user
              ? 'Sign Out'
              : !bootstrapStatus.adminClaimed && !bootstrapStatus.envOverrideActive
              ? 'Setup Admin'
              : 'Sign In'}
          </button>
        </div>
      </div>
    </header>
  );
}
