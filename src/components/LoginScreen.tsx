import React from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowRight,
  Compass,
  Layers,
  LayoutGrid,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface LoginScreenProps {
  user: User | null;
  isFirebaseConfigured: boolean;
  configError: string | null;
  authError: string | null;
  signingIn: boolean;
  syncingWorkspace: boolean;
  onSignInWithGoogle: () => Promise<void>;
  onContinueAsGuest: () => void;
  onRetrySync: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onClearError: () => void;
}

const CAPABILITIES = [
  { icon: LayoutGrid, label: 'Overview', detail: 'Whole-stall money flow' },
  { icon: Layers, label: 'Stock Planner', detail: 'Smart mix comparisons' },
  { icon: Compass, label: 'Stall Setup', detail: 'Interactive stall layout' },
  { icon: Search, label: 'Research', detail: 'Sourced market pricing' },
];

export function LoginScreen({
  user,
  isFirebaseConfigured,
  configError,
  authError,
  signingIn,
  syncingWorkspace,
  onSignInWithGoogle,
  onContinueAsGuest,
  onRetrySync,
  onSignOut,
  onClearError,
}: LoginScreenProps) {
  return (
    <div className="min-h-screen bg-[#0B0A10] text-[#F5F3FA] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Restrained ambient radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[680px] h-[360px] rounded-full bg-[#8B5CF6]/12 blur-[120px]"
      />

      <div className="relative w-full max-w-md surface-glass rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-xs font-semibold text-[#C4B5FD]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>StallIQ</span>
          </div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-[#F5F3FA]">
            Plan every stall with clarity
          </h1>
          <p className="text-sm text-[#A29BB8]">
            Stock combinations, profit clarity, visual layout &amp; research in one studio.
          </p>
        </div>

        {/* 2x2 Visual Capability Strip */}
        <div className="grid grid-cols-2 gap-2.5">
          {CAPABILITIES.map(({ icon: Icon, label, detail }) => (
            <div
              key={label}
              className="surface-inset rounded-xl p-3 flex items-start gap-2.5"
            >
              <div className="w-7 h-7 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 flex items-center justify-center text-[#A78BFA] shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#F5F3FA]">{label}</div>
                <div className="text-[11px] text-[#A29BB8] truncate">{detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Errors */}
        {(authError || configError) && (
          <div className="bg-[#FB7185]/10 border border-[#FB7185]/30 rounded-xl p-3 text-xs text-[#FDA4AF] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#FB7185] shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p>{authError || configError}</p>
              {authError && (
                <button
                  type="button"
                  onClick={onClearError}
                  className="text-[11px] font-semibold text-[#F5F3FA] underline"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        {/* Signed-in Recovery vs Sign-in CTA */}
        {user ? (
          <div className="space-y-3">
            <div className="surface-inset rounded-xl p-3 text-xs text-[#A29BB8] text-center">
              Signed in as <span className="text-[#F5F3FA] font-semibold">{user.email}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={syncingWorkspace}
                onClick={onRetrySync}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-sm font-semibold transition-all disabled:opacity-50"
              >
                {syncingWorkspace ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>Retry sync</span>
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-[#1A1726] hover:bg-[#231F33] border border-[#2E2942] text-xs font-semibold text-[#F5F3FA]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {isFirebaseConfigured && (
              <button
                type="button"
                disabled={signingIn}
                onClick={onSignInWithGoogle}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-sm font-semibold shadow-[0_10px_28px_-8px_rgba(139,92,246,0.55)] transition-all disabled:opacity-60"
              >
                {signingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M21.35 11.1H12v2.9h5.35c-.25 1.45-1.5 4.25-5.35 4.25-3.22 0-5.85-2.67-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.48C16.68 3.77 14.55 2.85 12 2.85 6.95 2.85 2.85 6.95 2.85 12S6.95 21.15 12 21.15c6.93 0 8.65-4.86 8.65-7.38 0-.5-.05-.88-.12-1.27z"
                    />
                  </svg>
                )}
                <span>{signingIn ? 'Signing in...' : 'Continue with Google'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onContinueAsGuest}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1A1726] hover:bg-[#231F33] border border-[#2E2942] text-sm font-semibold text-[#F5F3FA] transition-colors"
            >
              <span>Explore local preview</span>
              <ArrowRight className="w-4 h-4 text-[#A78BFA]" />
            </button>

            <p className="text-[11px] text-[#78718E] text-center pt-1">
              Google sign-in syncs your private workspace &amp; coach memory. Local preview stays on this device.
            </p>
          </div>
        )}

        <PWAInstallButton variant="card" />
      </div>
    </div>
  );
}
