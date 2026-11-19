import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'stalliq_pwa_dismissed_until_v1';

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandalone());
  const [isIos] = useState<boolean>(() => detectIosSafari());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [dismissedBanner, setDismissedBanner] = useState<boolean>(() =>
    isDismissedRecently()
  );
  const [waitingRegistration, setWaitingRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleSwUpdate = (ev: Event) => {
      const customEv = ev as CustomEvent<ServiceWorkerRegistration>;
      if (customEv.detail) {
        setWaitingRegistration(customEv.detail);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('stalliq:sw-update', handleSwUpdate);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = (ev: MediaQueryListEvent) => {
      if (ev.matches) setIsInstalled(true);
    };
    mediaQuery.addEventListener?.('change', handleDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('stalliq:sw-update', handleSwUpdate);
      mediaQuery.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    } else {
      try {
        // Respect dismissal for 7 days so we never pester users repeatedly
        window.localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 86400000));
        setDismissedBanner(true);
      } catch {
        // ignore
      }
    }
    return outcome;
  }, [deferredPrompt]);

  const dismissInstallBanner = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 86400000));
    } catch {
      // ignore
    }
    setDismissedBanner(true);
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingRegistration?.waiting) {
      waitingRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  }, [waitingRegistration]);

  return {
    isInstalled,
    isIos,
    isOnline,
    dismissedBanner,
    hasUpdateReady: Boolean(waitingRegistration),
    canPromptInstall: Boolean(deferredPrompt) && !isInstalled,
    showInstallOption: !isInstalled && (Boolean(deferredPrompt) || isIos),
    promptInstall,
    dismissInstallBanner,
    applyUpdate,
  };
}
