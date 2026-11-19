import { useEffect, useState } from 'react';
import {
  resolveExperienceMode,
  type ExperienceMode,
} from '../utils/experienceMode';

function readCurrentMode(): ExperienceMode {
  if (typeof window === 'undefined') return 'desktop';
  const isCoarsePointer =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  return resolveExperienceMode({
    width: window.innerWidth,
    height: window.innerHeight,
    isCoarsePointer,
    maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
  });
}

export function useExperienceMode(): ExperienceMode {
  const [mode, setMode] = useState<ExperienceMode>(() => readCurrentMode());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const next = readCurrentMode();
      setMode((prev) => (prev === next ? prev : next));
    };

    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    const mqWidth = window.matchMedia('(max-width: 767px)');
    const mqHeight = window.matchMedia('(max-height: 500px)');
    mqWidth.addEventListener?.('change', sync);
    mqHeight.addEventListener?.('change', sync);

    sync();

    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      mqWidth.removeEventListener?.('change', sync);
      mqHeight.removeEventListener?.('change', sync);
    };
  }, []);

  return mode;
}
