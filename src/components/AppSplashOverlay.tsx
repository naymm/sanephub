import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

/** Evita um flash quase imperceptível se a sessão restaurar instantaneamente. */
const MIN_VISIBLE_MS = 520;
const FADE_MS = 320;

/**
 * Ecrã de arranque (mobile e desktop): cobre o carregamento inicial e a restauração da sessão.
 * O `#sanep-static-splash` em `index.html` replica o visual até o primeiro paint do React.
 */
export function AppSplashOverlay() {
  const { isAuthReady } = useAuth();
  const mountTimeRef = useRef(Date.now());
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);

  useLayoutEffect(() => {
    document.getElementById('sanep-static-splash')?.remove();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    const elapsed = Date.now() - mountTimeRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const t = window.setTimeout(() => setExiting(true), wait);
    return () => clearTimeout(t);
  }, [isAuthReady]);

  useEffect(() => {
    if (!exiting) return;
    const t = window.setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(t);
  }, [exiting]);

  if (gone) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-[#101828] transition-opacity ease-out',
        exiting && 'pointer-events-none opacity-0',
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      aria-busy={!exiting}
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/[0.06]" />
        <div className="absolute -bottom-8 left-1/4 h-40 w-40 rounded-full bg-[hsl(var(--primary)/0.12)] blur-2xl" />
        <div
          className="absolute -left-20 top-1/3 hidden h-48 w-48 rounded-full bg-white/[0.04] blur-2xl md:block"
          aria-hidden
        />
      </div>
      <img
        src="/logo-white.png"
        alt="GRUPO SANEP"
        className="relative z-[1] h-10 w-auto max-w-[200px] object-contain sm:h-12 sm:max-w-[240px]"
        width={240}
        height={48}
      />
      <Loader2
        className={cn(
          'relative z-[1] mt-8 h-8 w-8 text-[hsl(var(--primary))] opacity-90 sm:mt-10 sm:h-9 sm:w-9',
          !exiting && 'animate-spin',
        )}
        style={{ animationDuration: '1.05s' }}
        aria-hidden
      />
      <span className="sr-only">A carregar…</span>
    </div>
  );
}
