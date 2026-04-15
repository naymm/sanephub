import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { rpcPerfilTemPontoPin } from '@/lib/pontoPinRpc';
import { MobilePinUnlockOverlay } from '@/components/mobile/MobilePinUnlockOverlay';

const SESSION_UNLOCK_KEY = 'sanep_msl_unlocked_uid';
/** Bypass temporário do bloqueio por "segundo plano" (ex.: abrir um PDF em nova aba). */
const BG_BYPASS_UNTIL_KEY = 'sanep_msl_bg_bypass_until';
/** No desktop, o refresh pode limpar/recriar `sessionStorage` em alguns cenários; persistimos também aqui. */
const DESKTOP_UNLOCK_KEY = 'sanep_msl_unlocked_uid_desktop';

/** Sem interação durante este tempo → pedir PIN (mobile e desktop). */
const IDLE_MS = 10 * 60_000;
/** Bloqueio ao meter em segundo plano: só em mobile (PWA / app); no desktop mudar de aba não deve pedir PIN. */
const BACKGROUND_LOCK_MS = 5_000;
/** Safari/iOS pode reportar `visibility=hidden` ao abrir PDF no iframe ou fechar modais — só armar bloqueio se continuar hidden. */
const VISIBILITY_HIDDEN_CONFIRM_MS = 2_500;

function isDesktopViewport(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(min-width: 768px)').matches;
}
/** Verificação periódica do tempo sem atividade (não depende só de `setTimeout` único). */
const IDLE_CHECK_INTERVAL_MS = 15_000;
/** `pointermove` / `touchmove` disparam muito; atualizamos o “último movimento” com este intervalo. */
const MOVE_THROTTLE_MS = 750;

type Ctx = {
  lockNow: () => void;
  /** Anula temporizadores de bloqueio por “segundo plano” e renova inatividade (ex.: fechar modal de PDF no iOS). */
  bumpActivity: () => void;
};

const MobileSessionLockContext = createContext<Ctx | null>(null);

export function useMobileSessionLock(): Ctx {
  const c = useContext(MobileSessionLockContext);
  if (!c) throw new Error('useMobileSessionLock outside provider');
  return c;
}

/** Para componentes opcionais (ex.: `PdfPreviewDialog`) que podem estar fora de testes sem provider. */
export function useOptionalMobileSessionLock(): Ctx | null {
  return useContext(MobileSessionLockContext);
}

function readUnlockedUserId(): string | null {
  try {
    const sid = sessionStorage.getItem(SESSION_UNLOCK_KEY);
    if (sid) return sid;
    // Fallback: em desktop queremos sobreviver a refresh.
    try {
      return localStorage.getItem(DESKTOP_UNLOCK_KEY);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function writeUnlockedUserId(id: number): void {
  try {
    sessionStorage.setItem(SESSION_UNLOCK_KEY, String(id));
  } catch {
    /* ignore */
  }
  // Desktop: persistir para sobreviver a refresh.
  try {
    localStorage.setItem(DESKTOP_UNLOCK_KEY, String(id));
  } catch {
    /* ignore */
  }
}

function clearUnlocked(): void {
  try {
    sessionStorage.removeItem(SESSION_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(DESKTOP_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

function readBgBypassUntil(): number {
  try {
    const raw = sessionStorage.getItem(BG_BYPASS_UNTIL_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function clearBgBypass(): void {
  try {
    sessionStorage.removeItem(BG_BYPASS_UNTIL_KEY);
  } catch {
    /* ignore */
  }
}

export function MobileSessionLockProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const [pinUnlocked, setPinUnlocked] = useState(false);
  /** null = a carregar; bloqueia quando true (PIN de ponto definido no perfil). */
  const [temPontoPin, setTemPontoPin] = useState<boolean | null>(null);
  const lastActivityAtRef = useRef<number>(Date.now());
  const lastMoveBumpAtRef = useRef<number>(0);
  const idleCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgConfirmHiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Após login, o Safari pode reportar `visibility=hidden` ao fechar o teclado — evita bloquear por PIN de imediato. */
  const lastAuthContextAtRef = useRef<number>(0);

  useEffect(() => {
    if (!user || !isSupabaseConfigured() || !supabase) {
      setTemPontoPin(null);
      return;
    }
    let cancelled = false;
    setTemPontoPin(null);
    void rpcPerfilTemPontoPin(supabase)
      .then(v => {
        if (!cancelled) setTemPontoPin(v);
      })
      .catch(() => {
        if (!cancelled) setTemPontoPin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const pinConfigured = temPontoPin === true;

  const lock = useCallback(() => {
    clearUnlocked();
    setPinUnlocked(false);
  }, []);

  const unlock = useCallback(() => {
    if (!user) return;
    writeUnlockedUserId(user.id);
    lastActivityAtRef.current = Date.now();
    setPinUnlocked(true);
  }, [user]);

  const lockNow = useCallback(() => {
    lock();
  }, [lock]);

  const clearBackgroundLockTimers = useCallback(() => {
    if (bgConfirmHiddenTimerRef.current) {
      clearTimeout(bgConfirmHiddenTimerRef.current);
      bgConfirmHiddenTimerRef.current = null;
    }
    if (bgTimerRef.current) {
      clearTimeout(bgTimerRef.current);
      bgTimerRef.current = null;
    }
  }, []);

  const bumpActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now();
    clearBackgroundLockTimers();
  }, [clearBackgroundLockTimers]);

  useEffect(() => {
    if (!user) {
      setPinUnlocked(false);
      return;
    }
    lastAuthContextAtRef.current = Date.now();
    const sid = readUnlockedUserId();
    setPinUnlocked(sid === String(user.id));
  }, [user?.id]);

  useEffect(() => {
    // `user` pode ficar null por instantes no refresh enquanto o perfil ainda está a ser carregado,
    // mesmo com `isAuthReady=true` (ver `AuthContext`: `getSession().finally(setAuthReady(true))`).
    // Para não limpar o unlock erroneamente, só limpamos se continuar sem sessão por algum tempo.
    if (!isAuthReady) return;
    if (isAuthenticated) return;

    const t = setTimeout(() => {
      // Reconfirmar: se ainda não está autenticado após a janela de graça, então é logout real / sem sessão.
      if (!isAuthenticated) clearUnlocked();
    }, 2500);

    return () => clearTimeout(t);
  }, [isAuthReady, isAuthenticated]);

  const clearIdleCheck = useCallback(() => {
    if (idleCheckIntervalRef.current) {
      clearInterval(idleCheckIntervalRef.current);
      idleCheckIntervalRef.current = null;
    }
  }, []);

  /** Verifica periodicamente se passou `IDLE_MS` desde a última interação (não depende de `scroll` na `window`). */
  useEffect(() => {
    if (!user || !pinConfigured || !pinUnlocked) {
      clearIdleCheck();
      return;
    }
    lastActivityAtRef.current = Date.now();
    const tick = () => {
      if (Date.now() - lastActivityAtRef.current >= IDLE_MS) {
        lock();
      }
    };
    idleCheckIntervalRef.current = setInterval(tick, IDLE_CHECK_INTERVAL_MS);
    return () => clearIdleCheck();
  }, [user, pinConfigured, pinUnlocked, lock, clearIdleCheck]);

  /** Regista atividade real (incl. scroll em painéis internos via `wheel` / `touchmove`). */
  useEffect(() => {
    if (!user || !pinConfigured || !pinUnlocked) return;

    const bump = () => {
      lastActivityAtRef.current = Date.now();
    };
    const bumpMove = () => {
      const now = Date.now();
      if (now - lastMoveBumpAtRef.current < MOVE_THROTTLE_MS) return;
      lastMoveBumpAtRef.current = now;
      lastActivityAtRef.current = now;
    };

    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const discrete = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'click', 'auxclick'] as const;
    discrete.forEach((ev) => document.addEventListener(ev, bump, opts));
    document.addEventListener('pointermove', bumpMove, opts);
    document.addEventListener('touchmove', bumpMove, opts);

    return () => {
      discrete.forEach((ev) => document.removeEventListener(ev, bump, opts));
      document.removeEventListener('pointermove', bumpMove, opts);
      document.removeEventListener('touchmove', bumpMove, opts);
    };
  }, [user, pinConfigured, pinUnlocked]);

  useEffect(() => {
    if (!user || !pinConfigured) return;

    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (isDesktopViewport()) {
          // Desktop: trocar de separador não conta como “sair da app”; o PIN fica só pelos 10 min de inatividade.
          return;
        }
        // Alguns fluxos (ex.: abrir PDF em nova aba) não devem disparar lock imediato ao regressar.
        // Nesses casos, uma página pode escrever um "bypass until" no sessionStorage.
        if (Date.now() < readBgBypassUntil()) {
          clearBackgroundLockTimers();
          return;
        }
        const sinceAuth = Date.now() - lastAuthContextAtRef.current;
        if (sinceAuth < 18_000) return;
        clearBackgroundLockTimers();
        bgConfirmHiddenTimerRef.current = setTimeout(() => {
          bgConfirmHiddenTimerRef.current = null;
          if (document.visibilityState !== 'hidden') return;
          bgTimerRef.current = setTimeout(() => {
            lock();
          }, BACKGROUND_LOCK_MS);
        }, VISIBILITY_HIDDEN_CONFIRM_MS);
      } else {
        clearBackgroundLockTimers();
        clearBgBypass();
        lastActivityAtRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearBackgroundLockTimers();
    };
  }, [user, pinConfigured, lock, clearBackgroundLockTimers]);

  const needsUnlock = Boolean(
    isAuthReady &&
      isAuthenticated &&
      user &&
      pinConfigured &&
      !pinUnlocked &&
      isSupabaseConfigured(),
  );

  const ctx = useMemo(() => ({ lockNow, bumpActivity }), [lockNow, bumpActivity]);

  return (
    <MobileSessionLockContext.Provider value={ctx}>
      {children}
      {needsUnlock && user && supabase ? <MobilePinUnlockOverlay onSuccess={() => unlock()} /> : null}
    </MobileSessionLockContext.Provider>
  );
}
