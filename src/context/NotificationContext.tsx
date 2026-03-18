import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { Notificacao } from '@/types';
import { NOTIFICACOES_SEED } from '@/data/seed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

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
    if (isSupabaseConfigured()) return stored ?? [];
    return stored ?? NOTIFICACOES_SEED;
  });

  const fetchFromDb = async (): Promise<Notificacao[] | null> => {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) return null;
      const rows = (data ?? []) as any[];
      const mapped: Notificacao[] = rows.map(r => ({
        id: r.id as string,
        tipo: r.tipo as Notificacao['tipo'],
        titulo: r.titulo as string,
        mensagem: r.mensagem as string,
        moduloOrigem: r.modulo_origem as string,
        destinatarioPerfil: (r.destinatario_perfil ?? []) as string[],
        lida: r.lida as boolean,
        createdAt: r.created_at as string,
        link: r.link as string | undefined,
      }));
      return mapped;
    } catch (e) {
      console.error('[Notifications] fetchFromDb failed', e);
      return null;
    }
  };

  const prevCountRef = useRef<number>(notifications.length);

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
    if (notifications.length > prevCountRef.current) {
      playNotificationSound();
    }
    prevCountRef.current = notifications.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.length]);

  // Em Supabase: sincroniza notificações sem precisar recarregar a página.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;
    const sync = async () => {
      const fromDb = await fetchFromDb();
      if (!fromDb || cancelled) return;
      setNotifications(fromDb);
    };

    // primeira carga
    void sync();

    // polling leve para actualizar em outros dispositivos
    const t = window.setInterval(() => {
      void sync();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setNotifications(prev => [newN, ...prev]);

    if (isSupabaseConfigured() && supabase) {
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
          // se falhar, mantém no client para não bloquear UI
        }
      })();
    }
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
