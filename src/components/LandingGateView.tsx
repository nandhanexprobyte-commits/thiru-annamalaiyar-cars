import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { useApp } from '../context/AppContext.tsx';
import type { UserAccount } from '../../shared/types.ts';

interface LandingGateViewProps {
  onUnlocked?: (user: UserAccount) => void;
}

export function LandingGateView({ onUnlocked }: LandingGateViewProps) {
  const { siteContent, vehicles, bootstrapStatus, setSession, refreshBootstrap, pushToast, trackAnalytics } = useApp();

  const canClaimAdmin = !bootstrapStatus.adminClaimed && !bootstrapStatus.envOverrideActive;
  const [mode, setMode] = useState<'login' | 'register' | 'claim'>(canClaimAdmin ? 'claim' : 'login');

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [bannerImgFailed, setBannerImgFailed] = useState(false);

  const usernameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    trackAnalytics({ type: 'page_view', path: '/landing-gate', label: 'Portal Access Landing' });
  }, [trackAnalytics]);

  useEffect(() => {
    if (!canClaimAdmin && mode === 'claim') {
      setMode('login');
    }
  }, [canClaimAdmin, mode]);

  const handleFocusLogin = () => {
    usernameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      usernameInputRef.current?.focus();
    }, 220);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'claim') {
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters.');
        return;
      }
      if (password.length < 8) {
        setError('Admin password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    if (mode === 'register') {
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    setSubmitting(true);
    try {
      let res: { user: UserAccount; token: string };

      if (mode === 'claim') {
        res = await apiRequest('/api/auth/claim-admin', {
          method: 'POST',
          body: { name, username, email, password },
        });
        await refreshBootstrap();
        pushToast({
          title: 'Website Unlocked',
          message: `Admin account @${res.user.username || res.user.name} initialized.`,
          type: 'system',
        });
      } else if (mode === 'register') {
        res = await apiRequest('/api/auth/register', {
          method: 'POST',
          body: { name, username, phone, email, password },
        });
        pushToast({
          title: 'Portal Access Granted',
          message: `Welcome, ${res.user.name}. Full showroom inventory unlocked.`,
          type: 'user',
        });
      } else {
        res = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: { username, password },
        });
        pushToast({
          title: 'Website Unlocked',
          message: `Signed in as ${res.user.name}.`,
          type: 'system',
        });
      }

      setSession(res.user, res.token);
      setPassword('');
      setConfirmPassword('');
      onUnlocked?.(res.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!siteContent) return null;

  const primaryPhoneHref = `tel:${siteContent.contactPhone.split('/')[0].replace(/[^+\d]/g, '')}`;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--site-bg)', color: 'var(--site-text)' }}
    >
      {/* Top Bar Contract: Brand wordmark — 4 concise links — 1 primary CTA */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--site-bg) 92%, transparent)',
          borderColor: 'var(--site-border)',
        }}
      >
        <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="flex items-center gap-3 text-lg font-bold tracking-tight font-display whitespace-nowrap shrink-0"
            style={{ color: 'var(--site-text)' }}
          >
            {siteContent.logoUrl && (
              <img
                src={siteContent.logoUrl}
                alt={`${siteContent.brandName} emblem`}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-full object-cover border shrink-0"
                style={{ borderColor: 'var(--site-accent)' }}
              />
            )}
            <span>{siteContent.brandName}</span>
          </a>

          <nav
            className="hidden md:flex items-center gap-6 text-sm font-medium"
            style={{ color: 'var(--site-muted)' }}
          >
            <a href="#top" className="transition-colors hover:opacity-100 whitespace-nowrap shrink-0">
              Overview
            </a>
            <a href="#highlights" className="transition-colors hover:opacity-100 whitespace-nowrap shrink-0">
              Why Us
            </a>
            <a href="#showroom" className="transition-colors hover:opacity-100 whitespace-nowrap shrink-0">
              Showroom
            </a>
            <a href="#contact" className="transition-colors hover:opacity-100 whitespace-nowrap shrink-0">
              Contact
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleFocusLogin}
              className="rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--site-accent)',
                color: 'var(--site-accent-contrast)',
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split + Username/Password Access Gate */}
        <section className="mx-auto max-w-[1360px] px-6 pt-10 pb-12 lg:pt-14 lg:pb-16">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
            {/* Left Column: Showroom Proposition + Visuals */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-6">
              <div>
                <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--site-accent-bright)' }}>
                  {siteContent.heroKicker}
                </p>
                <h1
                  className="mt-3 font-display font-bold tracking-tight"
                  style={{
                    fontSize: 'clamp(2.25rem, 3.8vw, 3.5rem)',
                    lineHeight: 1.08,
                    textWrap: 'balance',
                  }}
                >
                  {siteContent.heroHeadline}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                  {siteContent.heroSubheadline} Sign in with your authorized username and password to access all {vehicles.length} live vehicles, full pricing breakdowns, and the enquiry desk.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 items-stretch">
                <div
                  className="sm:col-span-7 relative overflow-hidden rounded-2xl border min-h-[210px]"
                  style={{ borderColor: 'var(--site-border)', backgroundColor: 'var(--site-surface)' }}
                >
                  {!heroImgFailed && siteContent.heroImageUrl ? (
                    <img
                      src={siteContent.heroImageUrl}
                      alt={`${siteContent.brandName} luxury showroom`}
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="h-full w-full object-cover min-h-[210px]"
                    />
                  ) : (
                    <div
                      className="flex h-full min-h-[210px] items-center justify-center p-6 text-sm"
                      style={{ color: 'var(--site-muted)' }}
                    >
                      {siteContent.brandName} · Showroom Gallery
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-xs font-medium text-amber-200/90">{siteContent.tagline}</p>
                    <p className="mt-0.5 text-sm font-semibold text-white">
                      Cantonment Flagship · Verified Multi-Brand Collection
                    </p>
                  </div>
                </div>

                <div
                  className="sm:col-span-5 relative overflow-hidden rounded-2xl border min-h-[210px]"
                  style={{ borderColor: 'var(--site-border)', backgroundColor: 'var(--site-surface)' }}
                >
                  {!bannerImgFailed && siteContent.bannerUrl ? (
                    <img
                      src={siteContent.bannerUrl}
                      alt={`${siteContent.brandName} dealership card`}
                      referrerPolicy="no-referrer"
                      onError={() => setBannerImgFailed(true)}
                      className="h-full w-full object-cover min-h-[210px]"
                    />
                  ) : (
                    <div className="flex h-full min-h-[210px] flex-col justify-center p-5 text-xs">
                      <p className="font-display text-sm font-bold">{siteContent.brandName}</p>
                      <p className="mt-1" style={{ color: 'var(--site-muted)' }}>
                        {siteContent.showroomAddress}, {siteContent.showroomCity}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Username & Password Access Card */}
            <div className="lg:col-span-5 flex">
              <div
                className="w-full rounded-2xl border p-6 sm:p-7 flex flex-col justify-between shadow-2xl"
                style={{
                  backgroundColor: 'var(--site-surface)',
                  borderColor: 'var(--site-border)',
                }}
              >
                <div>
                  <div className="flex items-center gap-3.5">
                    {siteContent.logoUrl ? (
                      <img
                        src={siteContent.logoUrl}
                        alt={siteContent.brandName}
                        referrerPolicy="no-referrer"
                        className="h-12 w-12 rounded-full object-cover border shrink-0"
                        style={{ borderColor: 'var(--site-accent)' }}
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full border shrink-0"
                        style={{ borderColor: 'var(--site-accent)', backgroundColor: 'var(--site-bg)' }}
                      >
                        <Lock className="h-5 w-5" style={{ color: 'var(--site-accent)' }} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium" style={{ color: 'var(--site-accent-bright)' }}>
                        {mode === 'claim'
                          ? 'First-Run Showroom Setup'
                          : mode === 'register'
                          ? 'New Member Access'
                          : 'Authorized Portal Access'}
                      </p>
                      <h2 className="font-display text-xl font-bold tracking-tight truncate">
                        {mode === 'claim'
                          ? 'Create Admin Login'
                          : mode === 'register'
                          ? 'Create Member Account'
                          : 'Sign In to Open Website'}
                      </h2>
                    </div>
                  </div>

                  {/* Mode Switch Tabs */}
                  <div
                    className="mt-5 flex items-center gap-1 rounded-xl p-1 border"
                    style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                  >
                    {canClaimAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('claim');
                          setError(null);
                        }}
                        className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap"
                        style={
                          mode === 'claim'
                            ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }
                            : { color: 'var(--site-muted)' }
                        }
                      >
                        Admin Setup
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                      className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap"
                      style={
                        mode === 'login'
                          ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }
                          : { color: 'var(--site-muted)' }
                      }
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setError(null);
                      }}
                      className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap"
                      style={
                        mode === 'register'
                          ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }
                          : { color: 'var(--site-muted)' }
                      }
                    >
                      Register
                    </button>
                  </div>

                  {mode === 'claim' && (
                    <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                      Set your primary showroom username and password once to unlock the full website, staff setup, CMS editor, and analytics console.
                    </p>
                  )}

                  <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    {(mode === 'claim' || mode === 'register') && (
                      <div>
                        <label
                          htmlFor="gate-full-name"
                          className="block text-xs font-medium mb-1.5"
                          style={{ color: 'var(--site-muted)' }}
                        >
                          Full Name
                        </label>
                        <input
                          id="gate-full-name"
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={mode === 'claim' ? 'Showroom Owner Name' : 'Your full name'}
                          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2"
                          style={{
                            backgroundColor: 'var(--site-bg)',
                            borderColor: 'var(--site-border)',
                            color: 'var(--site-text)',
                          }}
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="gate-username"
                        className="block text-xs font-medium mb-1.5"
                        style={{ color: 'var(--site-muted)' }}
                      >
                        {mode === 'login' ? 'Username or Email' : 'Username'}
                      </label>
                      <input
                        id="gate-username"
                        ref={usernameInputRef}
                        type="text"
                        required
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={mode === 'login' ? 'Enter username or email' : 'e.g. murali_admin'}
                        className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2"
                        style={{
                          backgroundColor: 'var(--site-bg)',
                          borderColor: 'var(--site-border)',
                          color: 'var(--site-text)',
                        }}
                      />
                    </div>

                    {(mode === 'claim' || mode === 'register') && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="gate-email"
                            className="block text-xs font-medium mb-1.5"
                            style={{ color: 'var(--site-muted)' }}
                          >
                            Email (Optional)
                          </label>
                          <input
                            id="gate-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@domain.com"
                            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors"
                            style={{
                              backgroundColor: 'var(--site-bg)',
                              borderColor: 'var(--site-border)',
                              color: 'var(--site-text)',
                            }}
                          />
                        </div>
                        {mode === 'register' && (
                          <div>
                            <label
                              htmlFor="gate-phone"
                              className="block text-xs font-medium mb-1.5"
                              style={{ color: 'var(--site-muted)' }}
                            >
                              Mobile Number
                            </label>
                            <input
                              id="gate-phone"
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="+91 93855 88888"
                              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors"
                              style={{
                                backgroundColor: 'var(--site-bg)',
                                borderColor: 'var(--site-border)',
                                color: 'var(--site-text)',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="gate-password"
                        className="block text-xs font-medium mb-1.5"
                        style={{ color: 'var(--site-muted)' }}
                      >
                        {mode === 'claim' ? 'Password (8+ characters)' : 'Password'}
                      </label>
                      <div className="relative">
                        <input
                          id="gate-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter password"
                          className="w-full rounded-xl border px-3.5 py-2.5 pr-11 text-sm outline-none transition-colors focus-visible:ring-2"
                          style={{
                            backgroundColor: 'var(--site-bg)',
                            borderColor: 'var(--site-border)',
                            color: 'var(--site-text)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:opacity-80"
                          style={{ color: 'var(--site-muted)' }}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {mode === 'claim' && (
                      <div>
                        <label
                          htmlFor="gate-confirm-password"
                          className="block text-xs font-medium mb-1.5"
                          style={{ color: 'var(--site-muted)' }}
                        >
                          Confirm Password
                        </label>
                        <input
                          id="gate-confirm-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors"
                          style={{
                            backgroundColor: 'var(--site-bg)',
                            borderColor: 'var(--site-border)',
                            color: 'var(--site-text)',
                          }}
                        />
                      </div>
                    )}

                    {error && (
                      <div
                        role="alert"
                        className="rounded-xl border px-3.5 py-2.5 text-xs font-medium"
                        style={{
                          borderColor: '#b91c1c',
                          backgroundColor: 'rgba(185, 28, 28, 0.14)',
                          color: '#fca5a5',
                        }}
                      >
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-95 disabled:opacity-60"
                      style={{
                        backgroundColor: 'var(--site-accent)',
                        color: 'var(--site-accent-contrast)',
                      }}
                    >
                      {mode === 'claim' ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : mode === 'register' ? (
                        <UserCheck className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      <span>
                        {submitting
                          ? 'Verifying Credentials…'
                          : mode === 'claim'
                          ? 'Create Admin & Open Website'
                          : mode === 'register'
                          ? 'Create Account & Open Website'
                          : 'Sign In & Open Website'}
                      </span>
                      {!submitting && <ArrowRight className="h-4 w-4" />}
                    </button>
                  </form>
                </div>

                <div
                  className="mt-5 pt-4 border-t flex items-center justify-between text-xs"
                  style={{ borderColor: 'var(--site-border)', color: 'var(--site-muted)' }}
                >
                  <span>Direct Showroom Help</span>
                  <a
                    href={primaryPhoneHref}
                    className="font-mono-tabular font-medium hover:underline"
                    style={{ color: 'var(--site-accent-bright)' }}
                  >
                    {siteContent.contactPhone.split('/')[0].trim()}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width 4-column Trust Metrics Strip */}
          <div
            className="mt-10 grid grid-cols-2 gap-6 border-t pt-8 sm:grid-cols-4"
            style={{ borderColor: 'var(--site-border)' }}
          >
            {siteContent.trustMetrics.map((metric, idx) => (
              <div key={idx} className="space-y-1">
                <p className="font-display text-2xl font-bold font-mono-tabular" style={{ color: 'var(--site-accent-bright)' }}>
                  {metric.value}
                </p>
                <p className="text-xs" style={{ color: 'var(--site-muted)' }}>
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Why Choose Us / Auto Choice Standards */}
        <section
          id="highlights"
          className="mx-auto max-w-[1360px] px-6 py-12 border-t"
          style={{ borderColor: 'var(--site-border)' }}
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5">
              <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--site-accent-bright)' }}>
                Why Choose Us
              </p>
              <h2
                className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl"
                style={{ textWrap: 'balance' }}
              >
                {siteContent.storyTitle}
              </h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                {siteContent.storyBody}
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {siteContent.storyHighlights.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border p-5 space-y-2"
                  style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
                >
                  <p className="text-xs font-mono-tabular" style={{ color: 'var(--site-accent-bright)' }}>
                    0{idx + 1}.
                  </p>
                  <h3 className="font-display text-sm font-bold">{item.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Showroom Address & Contact */}
        <section
          id="showroom"
          className="mx-auto max-w-[1360px] px-6 py-12 border-t"
          style={{ borderColor: 'var(--site-border)' }}
        >
          <div id="contact" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className="rounded-2xl border p-5 space-y-2"
              style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
            >
              <MapPin className="h-4 w-4" style={{ color: 'var(--site-accent)' }} />
              <p className="text-xs font-semibold">Showroom Address</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                {siteContent.showroomAddress}, {siteContent.showroomCity}
              </p>
            </div>

            <div
              className="rounded-2xl border p-5 space-y-2"
              style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
            >
              <Phone className="h-4 w-4" style={{ color: 'var(--site-accent)' }} />
              <p className="text-xs font-semibold">Phone Numbers</p>
              <p className="text-xs font-mono-tabular leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                {siteContent.contactPhone}
              </p>
            </div>

            <div
              className="rounded-2xl border p-5 space-y-2"
              style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
            >
              <Mail className="h-4 w-4" style={{ color: 'var(--site-accent)' }} />
              <p className="text-xs font-semibold">Email Desk</p>
              <a
                href={`mailto:${siteContent.contactEmail}`}
                className="block text-xs break-all hover:underline"
                style={{ color: 'var(--site-muted)' }}
              >
                {siteContent.contactEmail}
              </a>
            </div>

            <div
              className="rounded-2xl border p-5 space-y-2"
              style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
            >
              <Clock className="h-4 w-4" style={{ color: 'var(--site-accent)' }} />
              <p className="text-xs font-semibold">Showroom Hours</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                {siteContent.businessHours}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="border-t py-6 px-6 text-xs"
        style={{ borderColor: 'var(--site-border)', color: 'var(--site-muted)' }}
      >
        <div className="mx-auto flex max-w-[1360px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>{siteContent.footerNote}</p>
          <button
            type="button"
            onClick={handleFocusLogin}
            className="text-left sm:text-right font-medium hover:underline"
            style={{ color: 'var(--site-accent-bright)' }}
          >
            Sign in with username &amp; password
          </button>
        </div>
      </footer>
    </div>
  );
}
