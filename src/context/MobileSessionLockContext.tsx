import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { rpcPerfilTemPontoPin } from '@/lib/pontoPinRpc';
import { MobilePinUnlockOverlay } from '@/components/mobile/MobilePinUnlockOverlay';

const SESSION_UNLOCK_KEY = 'sanep_msl_unlocked_uid';

/** Inactividade antes de pedir PIN (mobile e desktop; 5 minutos). */
const IDLE_MS = 5 * 60_000;
const BACKGROUND_LOCK_MS = 5_000;

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
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleIdle = useCallback(() => {
    clearIdleTimer();
    if (!user || !pinConfigured || !pinUnlocked) return;
    idleTimerRef.current = setTimeout(() => {
      lock();
    }, IDLE_MS);
  }, [user, pinConfigured, pinUnlocked, lock, clearIdleTimer]);

  useEffect(() => {
    if (!user || !pinConfigured || !pinUnlocked) {
      clearIdleTimer();
      return;
    }
    scheduleIdle();
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
    const reset = () => scheduleIdle();
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearIdleTimer();
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [user, pinConfigured, pinUnlocked, scheduleIdle, clearIdleTimer]);

  useEffect(() => {
    if (!user || !pinConfigured) return;

    const onVis = () => {
      if (document.visibilityState === 'hidden') {
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
