import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, UserCheck, X } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { useApp } from '../context/AppContext.tsx';
import type { UserAccount } from '../../shared/types.ts';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register' | 'claim';
  onClose: () => void;
  onSuccess?: (user: UserAccount) => void;
}

export function AuthModal({ open, initialMode, onClose, onSuccess }: AuthModalProps) {
  const { bootstrapStatus, setSession, refreshBootstrap, pushToast } = useApp();
  const canClaimAdmin = !bootstrapStatus.adminClaimed && !bootstrapStatus.envOverrideActive;

  const [mode, setMode] = useState<'login' | 'register' | 'claim'>(
    canClaimAdmin ? 'claim' : initialMode || 'login'
  );
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (canClaimAdmin) {
      setMode('claim');
    } else if (initialMode === 'register') {
      setMode('register');
    } else {
      setMode('login');
    }
  }, [open, canClaimAdmin, initialMode]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'claim') {
      if (password.length < 8) {
        setError('Admin password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
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
          title: 'Admin Console Ready',
          message: `Signed in as ${res.user.name}. Full CMS, Staff & Analytics unlocked.`,
          type: 'system',
        });
      } else if (mode === 'register') {
        res = await apiRequest('/api/auth/register', {
          method: 'POST',
          body: { name, username, email, phone, password },
        });
        pushToast({
          title: 'Account Created',
          message: `Welcome to the showroom, ${res.user.name}.`,
          type: 'user',
        });
      } else {
        res = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: { username: username || email, password },
        });
        pushToast({
          title: 'Signed In',
          message: `Authenticated as ${res.user.name} (${res.user.role}).`,
          type: 'system',
        });
      }

      setSession(res.user, res.token);
      setPassword('');
      setConfirmPassword('');
      onSuccess?.(res.user);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{
          backgroundColor: 'var(--site-surface)',
          borderColor: 'var(--site-border)',
          color: 'var(--site-text)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--site-accent-bright)' }}>
              {mode === 'claim'
                ? 'First-Run Showroom Setup'
                : mode === 'register'
                ? 'Customer Registration'
                : 'Showroom Portal Sign In'}
            </p>
            <h2 id="auth-modal-title" className="mt-1 text-xl font-bold font-display">
              {mode === 'claim'
                ? 'Claim Administrator Access'
                : mode === 'register'
                ? 'Create Customer Account'
                : 'Sign In to Your Account'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="rounded-lg p-2 transition-colors hover:opacity-80"
            style={{ color: 'var(--site-muted)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

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
            Customer Sign Up
          </button>
        </div>

        {mode === 'claim' && (
          <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--site-muted)' }}>
            No administrator has been configured yet. Claim the primary Owner account to unlock Staff Setup, Full-Page CMS, Color Studio, User CRM, and Analytics. This one-time setup locks automatically once claimed.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {(mode === 'claim' || mode === 'register') && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === 'claim' ? 'Showroom Owner Name' : 'Your full name'}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--site-bg)',
                  borderColor: 'var(--site-border)',
                  color: 'var(--site-text)',
                }}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
              {mode === 'login' ? 'Username or Email' : 'Username'}
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === 'login' ? 'Enter username or email' : 'e.g. murali_admin'}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--site-bg)',
                borderColor: 'var(--site-border)',
                color: 'var(--site-text)',
              }}
            />
          </div>

          {(mode === 'claim' || mode === 'register') && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@annamalaiyarcars.in"
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--site-bg)',
                  borderColor: 'var(--site-border)',
                  color: 'var(--site-text)',
                }}
              />
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                Mobile Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98424 00000"
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--site-bg)',
                  borderColor: 'var(--site-border)',
                  color: 'var(--site-text)',
                }}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
              {mode === 'claim' ? 'Create Admin Password (8+ characters)' : 'Password'}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--site-bg)',
                borderColor: 'var(--site-border)',
                color: 'var(--site-text)',
              }}
            />
          </div>

          {mode === 'claim' && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                Confirm Password
              </label>
              <input
                type="password"
                required
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
            className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
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
                ? 'Verifying…'
                : mode === 'claim'
                ? 'Initialize Admin Account'
                : mode === 'register'
                ? 'Create Account'
                : 'Sign In'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
