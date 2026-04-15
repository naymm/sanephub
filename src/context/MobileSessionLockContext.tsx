import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { rpcPerfilTemPontoPin } from '@/lib/pontoPinRpc';
import { MobilePinUnlockOverlay } from '@/components/mobile/MobilePinUnlockOverlay';

const SESSION_UNLOCK_KEY = 'sanep_msl_unlocked_uid';

/** Sem interação durante este tempo → pedir PIN (mobile e desktop). */
const IDLE_MS = 10 * 60_000;
/** Bloqueio ao meter em segundo plano: só em mobile (PWA / app); no desktop mudar de aba não deve pedir PIN. */
const BACKGROUND_LOCK_MS = 5_000;

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
};

const MobileSessionLockContext = createContext<Ctx | null>(null);

export function useMobileSessionLock(): Ctx {
  const c = useContext(MobileSessionLockContext);
  if (!c) throw new Error('useMobileSessionLock outside provider');
  return c;
}

function readUnlockedUserId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_UNLOCK_KEY);
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
}

function clearUnlocked(): void {
  try {
    sessionStorage.removeItem(SESSION_UNLOCK_KEY);
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

  useEffect(() => {
    if (!user) {
      setPinUnlocked(false);
      return;
    }
    const sid = readUnlockedUserId();
    setPinUnlocked(sid === String(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user) clearUnlocked();
  }, [user]);

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
        if (bgTimerRef.current) clearTimeout(bgTimerRef.current);
        bgTimerRef.current = setTimeout(() => {
          lock();
        }, BACKGROUND_LOCK_MS);
      } else {
        if (bgTimerRef.current) {
          clearTimeout(bgTimerRef.current);
          bgTimerRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (bgTimerRef.current) clearTimeout(bgTimerRef.current);
    };
  }, [user, pinConfigured, lock]);

  const needsUnlock = Boolean(
    isAuthReady &&
      isAuthenticated &&
      user &&
      pinConfigured &&
      !pinUnlocked &&
      isSupabaseConfigured(),
  );

  const ctx = useMemo(() => ({ lockNow }), [lockNow]);

  return (
    <MobileSessionLockContext.Provider value={ctx}>
      {children}
      {needsUnlock && user && supabase ? <MobilePinUnlockOverlay onSuccess={() => unlock()} /> : null}
    </MobileSessionLockContext.Provider>
  );
}
