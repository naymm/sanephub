import { useEffect, useRef, useState } from 'react';
import type { Database } from '@/types/supabase';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapRowFromDb, NUMERIC_KEYS } from '@/lib/supabaseMappers';
import { useAuth } from '@/context/AuthContext';

type PostgresChangesPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

function toCamelKey(s: string) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** BigInt/realtime pode vir como string no payload; notificações usam id texto. */
function samePk(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a != null && b != null) return String(a) === String(b);
  return false;
}

/**
 * Realtime sync genérico para uma tabela do Supabase.
 * - Faz fetch inicial
 * - Subscreve INSERT/UPDATE/DELETE
 * - Mantém estado local deduplicado pelo primary key
 */
export function useRealtimeTable<T>(
  table: keyof typeof NUMERIC_KEYS,
  primaryKeyColumn: string,
  opts?: {
    /** Quando o DB devolve campos "snake_case", mapeia o payload para o shape final. */
    mapRow?: (row: Record<string, unknown>) => T;
  }
) {
  const [rows, setRows] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthReady } = useAuth();

  // Ref evita re-subscrições/fetch quando o consumidor passa mapRow inline (nova ref a cada render).
  const mapRowRef = useRef(opts?.mapRow);
  mapRowRef.current = opts?.mapRow;

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    /** Sem sessão restaurada / utilizador em contexto, o fetch inicial falha com RLS e nunca era repetido após login. */
    if (!isAuthReady || !user) {
      setRows([]);
      setIsLoading(!isAuthReady);
      return;
    }

    let cancelled = false;

    const mapRowFn = (r: Record<string, unknown>) => {
      const custom = mapRowRef.current;
      return custom ? custom(r) : mapRowFromDb<T>(table, r);
    };

    const fetchInitial = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from(table as keyof Database['public']['Tables'])
        .select('*');

      if (error) {
        const blob = `${error.message ?? ''} ${error.code ?? ''}`.toLowerCase();
        const tabelaGeofences404 =
          String(table) === 'colaborador_geofences' &&
          (blob.includes('404') || blob.includes('not found') || blob.includes('does not exist') || error.code === 'PGRST205');
        if (tabelaGeofences404) {
          console.warn(
            `[useRealtimeTable] ${String(table)} indisponível (tabela não criada ou API sem reload). Aplique migrações 20260328140000 / 20260329000000.`,
            error.message,
          );
        } else {
          console.error(`[useRealtimeTable] Initial fetch failed for ${String(table)}`, error);
        }
        if (!cancelled) setRows([]);
        if (!cancelled) setIsLoading(false);
        return;
      }

      const mapped = (data ?? []).map(r => mapRowFn(r as Record<string, unknown>));
      if (!cancelled) {
        setRows(mapped);
        setIsLoading(false);
      }
    };

    void fetchInitial();

    const pkCamel = toCamelKey(primaryKeyColumn);

    const cleanups: Array<() => void> = [];

    // SSE opcional (ex.: gateway próprio). Nunca substitui o Realtime do Supabase:
    // com VITE_SSE_URL definido, antes o hook fazia return cedo e a lista deixava
    // de receber postgres_changes (ex.: requisicoes sem eventos no SSE).
    const sseBaseUrl = import.meta.env.VITE_SSE_URL as string | undefined;
    const sseToken = import.meta.env.VITE_SSE_TOKEN as string | undefined;
    if (sseBaseUrl) {
      try {
        const url = new URL('/realtime', sseBaseUrl);
        url.searchParams.set('table', String(table));
        if (sseToken) url.searchParams.set('token', sseToken);
        const es = new EventSource(url.toString());

        es.onmessage = (event) => {
          if (cancelled) return;
          try {
            const payload = JSON.parse(event.data) as PostgresChangesPayload;
            if (payload.eventType === 'INSERT') {
              const row = payload.new;
              if (!row) return;
              const mapped = mapRowFn(row);
              const id = (mapped as any)?.[pkCamel];
              if (id == null) return;
              setRows(prev => {
                const exists = prev.some(x => samePk((x as any)?.[pkCamel], id));
                if (exists) return prev;
                return [mapped, ...prev];
              });
            } else if (payload.eventType === 'UPDATE') {
              const row = payload.new;
              if (!row) return;
              const mapped = mapRowFn(row);
              const id = (mapped as any)?.[pkCamel];
              if (id == null) return;
              setRows(prev => {
                const exists = prev.some(x => samePk((x as any)?.[pkCamel], id));
                if (!exists) return [mapped, ...prev];
                return prev.map(x => (samePk((x as any)?.[pkCamel], id) ? mapped : x));
              });
            } else if (payload.eventType === 'DELETE') {
              const row = payload.old;
              if (!row) return;
              const id = (row as any)?.[primaryKeyColumn] ?? (row as any)?.[pkCamel];
              if (id == null) return;
              setRows(prev => prev.filter(x => !samePk((x as any)?.[pkCamel], id)));
            }
          } catch (e) {
            console.error('[useRealtimeTable] SSE message parse error', e);
          }
        };

        es.onerror = (err) => {
          console.error('[useRealtimeTable] SSE connection error', err);
        };

        cleanups.push(() => es.close());
      } catch (e) {
        console.error('[useRealtimeTable] SSE init failed', e);
      }
    }

    const channelName = `realtime-table:${String(table)}:${primaryKeyColumn}`;
    const channel = supabase.channel(channelName);

    const handleInsert = (payload: any) => {
      const row = payload?.new;
      if (!row) return;
      const mapped = mapRowFn(row);
      const id = (mapped as any)?.[pkCamel];
      console.log(`[useRealtimeTable] INSERT ${String(table)} id=${id}`);
      if (id == null) return;

      setRows(prev => {
        const exists = prev.some(x => samePk((x as any)?.[pkCamel], id));
        if (exists) return prev;
        return [mapped, ...prev];
      });
    };

    const handleUpdate = (payload: any) => {
      const row = payload?.new;
      if (!row) return;
      const mapped = mapRowFn(row);
      const id = (mapped as any)?.[pkCamel];
      console.log(`[useRealtimeTable] UPDATE ${String(table)} id=${id}`);
      if (id == null) return;

      setRows(prev => {
        const exists = prev.some(x => samePk((x as any)?.[pkCamel], id));
        if (!exists) return [mapped, ...prev];
        return prev.map(x => (samePk((x as any)?.[pkCamel], id) ? mapped : x));
      });
    };

    const handleDelete = (payload: any) => {
      const row = payload?.old;
      if (!row) return;
      const id = (row as any)?.[primaryKeyColumn] ?? (row as any)?.[pkCamel];
      console.log(`[useRealtimeTable] DELETE ${String(table)} id=${id}`);
      if (id == null) return;

      setRows(prev => prev.filter(x => !samePk((x as any)?.[pkCamel], id)));
    };

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: String(table) }, handleInsert)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: String(table) }, handleUpdate)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: String(table) }, handleDelete);

    channel.subscribe(status => {
      console.log(`[useRealtimeTable] channel ${channelName} status=${String(status)}`);
    });

    cleanups.push(() => {
      try {
        void supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    });

    return () => {
      cancelled = true;
      for (const fn of cleanups) {
        try {
          fn();
        } catch {
          // ignore
        }
      }
    };
  }, [primaryKeyColumn, table, isAuthReady, user?.id]);

  return { rows, isLoading };
}

