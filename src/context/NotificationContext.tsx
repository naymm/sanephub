import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { Notificacao } from '@/types';
import { NOTIFICACOES_SEED } from '@/data/seed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { mapRowFromDb } from '@/lib/supabaseMappers';

const STORAGE_NOTIFICACOES = 'sanep_notifications_v1';

interface NotificationContextType {
  notifications: Notificacao[];
  unreadCount: (perfil: string) => number;
  markAsRead: (id: string) => void;
  markAllAsRead: (perfil: string) => void;
  addNotification: (n: Omit<Notificacao, 'id' | 'createdAt' | 'lida'>) => void;
  getForProfile: (perfil: string) => Notificacao[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const realtimeEnabled = isSupabaseConfigured() && !!supabase;

  // Em ambiente com Supabase ligado, evita mostrar notificações seed/mocked.
  // Neste projecto as notificações são ainda em estado client-side (sem persistência em DB).
  // Para desenvolvimento/local, mantém seed quando Supabase NÃO está configurado.
  const loadStored = (): Notificacao[] | null => {
    try {
      const raw = localStorage.getItem(STORAGE_NOTIFICACOES);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Notificacao[];
      if (!Array.isArray(parsed)) return null;
      // Validação mínima
      if (!parsed.every(n => typeof n?.id === 'string' && Array.isArray(n?.destinatarioPerfil) && typeof n?.lida === 'boolean')) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const [notifications, setNotifications] = useState<Notificacao[]>(() => {
    const stored = loadStored();
    // Em Supabase (produção / multi-utilizador), o DB é fonte de verdade.
    if (isSupabaseConfigured()) return [];
    return stored ?? NOTIFICACOES_SEED;
  });

  // Referência estável: inline mapRow recriava a cada render e o useRealtimeTable
  // re-corria o effect (fetch + subscribe) em loop.
  const mapNotificacaoRow = useCallback((row: Record<string, unknown>) => {
    const mapped = mapRowFromDb<Notificacao>('notificacoes', row);
    return {
      ...mapped,
      link: mapped.link ?? undefined,
    };
  }, []);

  const { rows: dbNotifications, isLoading: dbLoading } = useRealtimeTable<Notificacao>(
    'notificacoes',
    'id',
    { mapRow: mapNotificacaoRow },
  );

  const prevCountRef = useRef<number>(notifications.length);
  const didInitRef = useRef(false);

  const playNotificationSound = () => {
    // Nota: alguns navegadores bloqueiam áudio sem interação do utilizador.
    // Mesmo assim tentamos; caso falhe é silencioso (catch).
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880; // Hz
      gain.gain.value = 0.0001;

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      oscillator.start(now);
      oscillator.stop(now + 0.2);

      oscillator.onended = () => {
        try { ctx.close(); } catch {}
      };
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (realtimeEnabled && dbLoading) return;
    if (!didInitRef.current) {
      didInitRef.current = true;
      prevCountRef.current = notifications.length;
      return;
    }

    if (notifications.length > prevCountRef.current) {
      playNotificationSound();
    }
    prevCountRef.current = notifications.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.length]);

  // Quando Supabase está ligado, usamos o hook realtime como fonte de verdade.
  useEffect(() => {
    if (!realtimeEnabled) return;
    if (dbLoading) return;
    setNotifications(dbNotifications);
  }, [dbNotifications, dbLoading, realtimeEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_NOTIFICACOES, JSON.stringify(notifications));
    } catch {
      // ignore: pode falhar em modo privado
    }
  }, [notifications]);

  // Sincroniza notificações entre tabs/rotas sem recarregar a página
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_NOTIFICACOES) return;
      if (!e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as Notificacao[];
        if (Array.isArray(parsed)) setNotifications(parsed);
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const getForProfile = (perfil: string) =>
    notifications.filter(n => n.destinatarioPerfil.includes(perfil) || n.destinatarioPerfil.includes('Admin'));

  const unreadCount = (perfil: string) =>
    getForProfile(perfil).filter(n => !n.lida).length;

  const markAsRead = (id: string) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));

  const markAsReadDb = async (id: string) => {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
    } catch {
      // ignore
    }
  };

  const markAllAsRead = (perfil: string) =>
    setNotifications(prev => prev.map(n =>
      (n.destinatarioPerfil.includes(perfil) || n.destinatarioPerfil.includes('Admin')) ? { ...n, lida: true } : n
    ));

  const markAllAsReadDb = async (perfil: string) => {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      // Para simplificar, usa IDs actuais no estado.
      const ids = notifications
        .filter(n => (n.destinatarioPerfil.includes(perfil) || n.destinatarioPerfil.includes('Admin')) && !n.lida)
        .map(n => n.id);
      await Promise.all(ids.map(id => supabase.from('notificacoes').update({ lida: true }).eq('id', id)));
    } catch {
      // ignore
    }
  };

  const addNotification = (n: Omit<Notificacao, 'id' | 'createdAt' | 'lida'>) => {
    const newN: Notificacao = {
      ...n,
      id: 'n' + Date.now(),
      createdAt: new Date().toISOString(),
      lida: false,
    };
    if (!realtimeEnabled || !supabase) {
      setNotifications(prev => [newN, ...prev]);
      return;
    }

    // Em realtime (multi-utilizador), evitamos optimismo local:
    // o hook vai actualizar automaticamente após INSERT no DB.
    void (async () => {
      try {
        await supabase.from('notificacoes').insert({
          id: newN.id,
          tipo: newN.tipo,
          titulo: newN.titulo,
          mensagem: newN.mensagem,
          modulo_origem: newN.moduloOrigem,
          destinatario_perfil: newN.destinatarioPerfil,
          lida: newN.lida,
          created_at: newN.createdAt,
          link: newN.link ?? null,
        });
      } catch (e) {
        console.error('[Notifications] addNotification insert failed', e);
      }
    })();
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead: (id: string) => {
          setNotifications(prev => prev.map(n => (n.id === id ? { ...n, lida: true } : n)));
          void markAsReadDb(id);
        },
        markAllAsRead: (perfil: string) => {
          setNotifications(prev => prev.map(n =>
            (n.destinatarioPerfil.includes(perfil) || n.destinatarioPerfil.includes('Admin')) ? { ...n, lida: true } : n
          ));
          void markAllAsReadDb(perfil);
        },
        addNotification,
        getForProfile,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
