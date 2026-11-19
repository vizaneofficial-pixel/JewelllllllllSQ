export type ExperienceMode = 'mobile' | 'desktop';

export interface ViewportCapabilities {
  width: number;
  height: number;
  isCoarsePointer?: boolean;
  maxTouchPoints?: number;
}

/**
 * Deterministic dual-interface routing rule:
 * - Mobile portrait phones (< 768px width) -> 'mobile'
 * - Mobile landscape phones (width < 960px AND short height <= 500px) -> 'mobile'
 * - Tablets (768x1024, 1024x768, etc.) and Desktops -> 'desktop'
 *
 * This guarantees phones in both portrait and landscape get MobileExperience,
 * while tablets never receive an oversized stretched phone layout.
 */
export function resolveExperienceMode(input: ViewportCapabilities): ExperienceMode {
  const width = Math.max(0, Number(input.width) || 0);
  const height = Math.max(0, Number(input.height) || 0);

  if (width < 768) {
    return 'mobile';
  }

  // Phone landscape (e.g., 800x360, 844x390, 915x412, 932x430)
  if (width < 960 && height > 0 && height <= 500) {
    return 'mobile';
  }

  return 'desktop';
}

export function triggerHaptic(pattern: number | number[] = 10): void {
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported devices
  }
}
