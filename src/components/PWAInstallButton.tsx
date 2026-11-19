import React, { useState } from 'react';
import { Download, RefreshCw, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card' | 'desktop-sidebar';
  className?: string;
}

export function PWAInstallButton({
  variant = 'compact',
  className = '',
}: PWAInstallButtonProps) {
  const {
    isInstalled,
    isIos,
    hasUpdateReady,
    canPromptInstall,
    showInstallOption,
    promptInstall,
    applyUpdate,
  } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (hasUpdateReady) {
    return (
      <button
        type="button"
        onClick={applyUpdate}
        className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl bg-[#34D399]/18 border border-[#34D399]/40 text-xs font-semibold text-[#6EE7B7] whitespace-nowrap active:scale-[0.98] transition-transform ${className}`}
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Update App</span>
      </button>
    );
  }

  if (isInstalled || !showInstallOption) return null;

  const handleClick = async () => {
    if (canPromptInstall) {
      await promptInstall();
      return;
    }
    if (isIos) {
      setShowIosGuide(true);
    }
  };

  return (
    <>
      {variant === 'card' ? (
        <button
          type="button"
          onClick={() => void handleClick()}
          className={`w-full min-h-[52px] px-4 py-3 rounded-2xl bg-[#1A1726] border border-[#8B5CF6]/35 hover:border-[#8B5CF6]/65 flex items-center justify-between gap-3 text-left transition-colors ${className}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/18 border border-[#8B5CF6]/35 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-[#C4B5FD]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#F5F3FA]">
                Install StallIQ App
              </div>
              <div className="text-xs text-[#A29BB8] truncate">
                {canPromptInstall
                  ? 'Add to home screen for offline Live Selling'
                  : 'Add to iPhone Home Screen from Safari'}
              </div>
            </div>
          </div>
          <Download className="w-4 h-4 text-[#C4B5FD] shrink-0" />
        </button>
      ) : variant === 'desktop-sidebar' ? (
        <button
          type="button"
          onClick={() => void handleClick()}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#161322] hover:bg-[#1E1A2E] border border-[#2D2744] text-xs font-medium text-[#C4B5FD] transition-colors ${className}`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </span>
          <span className="text-[10px] text-[#8C84A6]">PWA</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleClick()}
          className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl bg-[#8B5CF6]/18 border border-[#8B5CF6]/40 text-xs font-semibold text-[#C4B5FD] whitespace-nowrap active:scale-[0.98] transition-transform ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>
      )}

      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-4 pb-safe"
          role="dialog"
          aria-modal="true"
          aria-label="Install StallIQ on iOS"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#13111C] border border-[#322C47] p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/35 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-[#C4B5FD]" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-[#F5F3FA]">
                    Add StallIQ to Home Screen
                  </h3>
                  <p className="text-xs text-[#A29BB8]">
                    Launch StallIQ full-screen &amp; sell offline
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                aria-label="Close install instructions"
                className="w-10 h-10 rounded-xl bg-[#1A1726] border border-[#252136] flex items-center justify-center text-[#A29BB8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="space-y-2.5 text-sm text-[#DDD7EE]">
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-xs text-[#C4B5FD] mt-0.5">1.</span>
                <span>
                  Tap the <Share className="inline w-3.5 h-3.5 text-[#C4B5FD] mx-0.5" />{' '}
                  <strong>Share</strong> button in Safari&apos;s toolbar.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-xs text-[#C4B5FD] mt-0.5">2.</span>
                <span>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-xs text-[#C4B5FD] mt-0.5">3.</span>
                <span>
                  Tap <strong>Add</strong> — StallIQ opens full-screen from your Home Screen.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full min-h-[44px] rounded-2xl bg-[#8B5CF6] text-white text-sm font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
