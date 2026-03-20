import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { Notificacao } from '@/types';
import { NOTIFICACOES_SEED } from '@/data/seed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { mapRowFromDb } from '@/lib/supabaseMappers';
import { useTenant } from '@/context/TenantContext';

const STORAGE_NOTIFICACOES = 'sanep_notifications_v1';

/** Opções para filtrar notificações do portal (colaborador específico). */
export type NotificationAudienceOptions = {
  colaboradorId?: number | null;
};

function notificationVisibleForUser(
  n: Notificacao,
  perfil: string,
  opts: NotificationAudienceOptions | undefined,
  currentEmpresaId: number | 'consolidado',
): boolean {
  // Só mostrar se o perfil do utilizador está na lista de destinatários.
  // NUNCA usar só `n.destinatarioPerfil.includes('Admin')` — isso faria TODOS os users
  // verem notificações marcadas para RH+Admin (ex.: pedido de declaração do portal).
  const targetsAdmin = n.destinatarioPerfil.includes('Admin');
  const inAudience =
    n.destinatarioPerfil.includes(perfil) || (perfil === 'Admin' && targetsAdmin);
  if (!inAudience) return false;
  if (perfil === 'Colaborador' && n.destinatarioColaboradorId != null) {
    // Se não conseguimos identificar o colaborador do utilizador logado,
    // não bloqueamos a notificação (falha segura).
    if (opts?.colaboradorId == null) return true;
    return opts.colaboradorId === n.destinatarioColaboradorId;
  }

  // Multi-tenant: filtra pela empresa alvo quando existe.
  // Regra: se n.empresaId for null/undefined => legado ou grupo, fica visível em qualquer empresa.
  if (n.empresaId != null && currentEmpresaId !== 'consolidado') {
    return n.empresaId === currentEmpresaId;
  }

  return true;
}

interface NotificationContextType {
  notifications: Notificacao[];
  unreadCount: (perfil: string, opts?: NotificationAudienceOptions) => number;
  markAsRead: (id: string) => void;
  markAllAsRead: (perfil: string, opts?: NotificationAudienceOptions) => void;
  addNotification: (n: Omit<Notificacao, 'id' | 'createdAt' | 'lida'>) => void;
  getForProfile: (perfil: string, opts?: NotificationAudienceOptions) => Notificacao[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const realtimeEnabled = isSupabaseConfigured() && !!supabase;
  const { currentEmpresaId } = useTenant();

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
    const base = stored ?? NOTIFICACOES_SEED;
    // Notificações lidas são eliminadas (não persistem na lista).
    return base.filter(n => !n.lida);
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
  // Notificações já lidas não ficam na lista — apagamos do DB para manter limpo.
  useEffect(() => {
    if (!realtimeEnabled) return;
    if (dbLoading) return;
    const readIds = dbNotifications.filter(n => n.lida).map(n => n.id);
    setNotifications(dbNotifications.filter(n => !n.lida));
    if (readIds.length > 0 && supabase) {
      void supabase.from('notificacoes').delete().in('id', readIds);
    }
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

  const getForProfile = (perfil: string, opts?: NotificationAudienceOptions) =>
    notifications.filter(n => !n.lida && notificationVisibleForUser(n, perfil, opts, currentEmpresaId));

  const unreadCount = (perfil: string, opts?: NotificationAudienceOptions) =>
    getForProfile(perfil, opts).length;

  const deleteNotificacaoDb = async (id: string) => {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      await supabase.from('notificacoes').delete().eq('id', id);
    } catch {
      // ignore
    }
  };

  const deleteNotificacoesDb = async (ids: string[]) => {
    if (!isSupabaseConfigured() || !supabase || ids.length === 0) return;
    try {
      await supabase.from('notificacoes').delete().in('id', ids);
    } catch {
      // ignore
    }
  };

  const addNotification = (n: Omit<Notificacao, 'id' | 'createdAt' | 'lida'>) => {
    const targetEmpresaId = currentEmpresaId === 'consolidado' ? null : currentEmpresaId;
    const newN: Notificacao = {
      ...n,
      id: 'n' + Date.now(),
      createdAt: new Date().toISOString(),
      lida: false,
      empresaId: n.empresaId ?? targetEmpresaId,
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
          destinatario_colaborador_id: newN.destinatarioColaboradorId ?? null,
          empresa_id: newN.empresaId ?? null,
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
          setNotifications(prev => prev.filter(n => n.id !== id));
          void deleteNotificacaoDb(id);
        },
        markAllAsRead: (perfil: string, opts?: NotificationAudienceOptions) => {
          setNotifications(prev => {
            const remove = new Set(
              prev
                .filter(n => notificationVisibleForUser(n, perfil, opts, currentEmpresaId))
                .map(n => n.id),
            );
            const ids = [...remove];
            if (ids.length) void deleteNotificacoesDb(ids);
            return prev.filter(n => !remove.has(n.id));
          });
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
