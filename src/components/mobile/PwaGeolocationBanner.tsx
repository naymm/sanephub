import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { isLikelyIos, isStandalonePwa } from '@/lib/pwaDisplayMode';
import { pedirPermissaoLocalizacaoLeve } from '@/lib/geolocationPermission';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'sanep-pwa-geo-banner-dismissed';
const WARMUP_SESSION_KEY = 'sanep-pwa-geo-warmup-session';

function mensagemErro(code: 'denied' | 'timeout' | 'unavailable' | 'unsupported'): string {
  switch (code) {
    case 'denied':
      return 'Permissão negada. Nas definições do browser ou da app, permita localização para este site.';
    case 'timeout':
      return 'Tempo esgotado. Tente de novo com melhor sinal GPS ou Wi‑Fi.';
    case 'unsupported':
      return 'Este dispositivo não expõe localização ao browser.';
    default:
      return 'Não foi possível obter localização. Verifique se escolheu «Permitir» no alerta do sistema.';
  }
}

type GeoPanelProps = {
  variant: 'ios-modal' | 'sheet' | 'desktop';
  hint: string | null;
  onDismiss: () => void;
  onPermitir: () => void;
};

function GeoPermissionPanel({ variant, hint, onDismiss, onPermitir }: GeoPanelProps) {
  const showHandle = variant === 'sheet';
  return (
    <>
      {showHandle ? (
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/25 dark:bg-muted-foreground/35" aria-hidden />
      ) : null}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary dark:bg-primary/15',
            variant === 'desktop' ? 'h-10 w-10 rounded-xl' : 'h-11 w-11',
          )}
        >
          <MapPin className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              id={variant === 'ios-modal' ? 'pwa-geo-title' : undefined}
              className={cn(
                'font-bold leading-tight text-foreground',
                variant === 'desktop' ? 'text-sm font-semibold' : 'text-base',
              )}
            >
              Localização (GPS)
            </p>
            <button
              type="button"
              className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:p-1"
              aria-label="Fechar"
              onClick={onDismiss}
            >
              <X className={cn(variant === 'desktop' ? 'h-4 w-4' : 'h-5 w-5')} />
            </button>
          </div>
          <p
            className={cn(
              'leading-relaxed text-muted-foreground',
              variant === 'desktop' ? 'mt-1.5 text-xs leading-snug' : 'mt-2 text-sm',
            )}
          >
            A app instalada precisa de localização para a marcação de ponto e validação de zonas. Toque em «Permitir
            localização» e aceite no alerta do sistema (Definições → Safari → Localização, se necessário).
          </p>
          {hint ? (
            <p
              className={cn(
                'rounded-xl border border-amber-500/35 bg-amber-500/10 leading-snug text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100',
                variant === 'desktop' ? 'mt-2 px-2.5 py-2 text-[11px]' : 'mt-3 px-3 py-2 text-xs',
              )}
              role="status"
            >
              {hint}
            </p>
          ) : null}
          <div className={cn('flex flex-col gap-2', variant === 'desktop' ? 'mt-3' : 'mt-4')}>
            {variant === 'desktop' ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="h-9 text-xs" onClick={onPermitir}>
                  Permitir localização
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-9 text-xs" onClick={onDismiss}>
                  Agora não
                </Button>
              </div>
            ) : (
              <>
                <Button type="button" className="h-12 w-full rounded-xl text-base font-semibold shadow-sm" onClick={onPermitir}>
                  Permitir localização
                </Button>
                <Button type="button" variant="ghost" className="h-10 w-full text-sm text-muted-foreground" onClick={onDismiss}>
                  Agora não
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Na PWA instalada: convida a permitir localização (marcação de ponto / zonas).
 * Mobile: bottom sheet acima da barra de navegação (sem toasts sobrepostos).
 */
export function PwaGeolocationBanner() {
  const { pathname } = useLocation();
  const mobile = useIsMobileViewport();
  const { isAuthenticated, isAuthReady } = useAuth();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');
  const [granted, setGranted] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  /**
   * Dispara o diálogo nativo quando ainda está em «prompt» (Android/Chromium PWA).
   * iOS só permite geolocation após gesto do utilizador — o banner + botão tratam disso.
   * sessionStorage só é marcado ao executar o pedido, para não quebrar com React Strict Mode.
   */
  useEffect(() => {
    if (!isStandalonePwa() || !isAuthReady || !isAuthenticated) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof window.setTimeout> | undefined;

    const applyGranted = () => {
      if (!cancelled) setGranted(true);
    };

    const tryWarmupNonIos = () => {
      if (isLikelyIos()) return;
      if (sessionStorage.getItem(WARMUP_SESSION_KEY) === '1') return;
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        if (sessionStorage.getItem(WARMUP_SESSION_KEY) === '1') return;
        sessionStorage.setItem(WARMUP_SESSION_KEY, '1');
        void pedirPermissaoLocalizacaoLeve().then(ok => {
          if (!cancelled && ok) applyGranted();
        });
      }, 1200);
    };

    const attachPermission = (p: PermissionStatus) => {
      const sync = () => {
        if (cancelled) return;
        if (p.state === 'granted') applyGranted();
      };
      sync();
      p.onchange = sync;
    };

    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then(p => {
          if (cancelled) return;
          attachPermission(p);
          if (p.state === 'prompt' && !isLikelyIos()) tryWarmupNonIos();
        })
        .catch(() => {
          if (!cancelled) tryWarmupNonIos();
        });
    } else {
      tryWarmupNonIos();
    }

    return () => {
      cancelled = true;
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [isAuthReady, isAuthenticated]);

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, '1');
  };

  const permitir = () => {
    setHint(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setHint(mensagemErro('unsupported'));
      return;
    }
    /* Sem Promise/.then: no iOS o pedido tem de arrancar no mesmo turno do toque (user activation). */
    navigator.geolocation.getCurrentPosition(
      () => {
        setGranted(true);
        dismiss();
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) setHint(mensagemErro('denied'));
        else if (err.code === err.TIMEOUT) setHint(mensagemErro('timeout'));
        else setHint(mensagemErro('unavailable'));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 25_000,
      },
    );
  };

  if (pathname === '/chat') return null;
  if (!isStandalonePwa() || !isAuthReady || !isAuthenticated) return null;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  if (granted) return null;
  if (dismissed) return null;

  const iosPwa = isLikelyIos() && isStandalonePwa();

  /* iPhone PWA: modal centrado e z-index acima do FAB (z-55); o sheet inferior ficava por baixo / tap a falhar. */
  if (mobile && iosPwa) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-geo-title"
      >
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
        <div className="relative z-[1] w-full max-w-md rounded-2xl border border-border/80 bg-[#faf8f4] p-4 shadow-2xl dark:border-border dark:bg-card">
          <GeoPermissionPanel variant="ios-modal" hint={hint} onDismiss={dismiss} onPermitir={permitir} />
        </div>
      </div>
    );
  }

  /* Android / outros mobile: folha acima da bottom nav — z acima do canto flutuante (z-55). */
  if (mobile) {
    return (
      <div
        className={cn(
          'fixed left-0 right-0 z-[70] border-x-0 border-b-0 border-t border-border/60',
          'rounded-t-3xl bg-[#faf8f4] shadow-[0_-12px_40px_rgba(0,0,0,0.1)] dark:border-border dark:bg-card dark:shadow-[0_-12px_40px_rgba(0,0,0,0.35)]',
          'px-4 pb-[max(1rem,calc(0.5rem+env(safe-area-inset-bottom,0px)))] pt-4',
          'bottom-[calc(4.85rem+env(safe-area-inset-bottom,0px))]',
        )}
        role="region"
        aria-label="Permissão de localização"
      >
        <GeoPermissionPanel variant="sheet" hint={hint} onDismiss={dismiss} onPermitir={permitir} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fixed right-4 top-4 z-[70] w-[min(100%-2rem,22rem)] rounded-2xl border border-primary/35 bg-card/95 p-4 shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-card/90',
      )}
      role="region"
      aria-label="Permissão de localização"
    >
      <GeoPermissionPanel variant="desktop" hint={hint} onDismiss={dismiss} onPermitir={permitir} />
    </div>
  );
}
