/** App aberta como PWA instalada (Chrome/Android «instalar», iOS «Adicionar ao ecrã inicial»). */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  /** iOS Safari: fiável quando a app abre a partir do ícone no ecrã inicial. */
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    const modes = ['standalone', 'fullscreen', 'minimal-ui'] as const;
    for (const m of modes) {
      if (window.matchMedia(`(display-mode: ${m})`).matches) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function isLikelyIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
