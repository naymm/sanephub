import { useEffect, useRef, useState } from 'react';
import type { Database } from '@/types/supabase';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapRowFromDb, NUMERIC_KEYS } from '@/lib/supabaseMappers';

type PostgresChangesPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

function toCamelKey(s: string) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
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

  // Ref evita re-subscrições/fetch quando o consumidor passa mapRow inline (nova ref a cada render).
  const mapRowRef = useRef(opts?.mapRow);
  mapRowRef.current = opts?.mapRow;

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setRows([]);
      setIsLoading(false);
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
        console.error(`[useRealtimeTable] Initial fetch failed for ${String(table)}`, error);
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

    const channelName = `realtime-table:${String(table)}:${primaryKeyColumn}`;
    const channel = supabase.channel(channelName);

    const pkCamel = toCamelKey(primaryKeyColumn);

    const handleInsert = (payload: any) => {
      const row = payload?.new;
      if (!row) return;
      const mapped = mapRowFn(row);
      const id = (mapped as any)?.[pkCamel];
      console.log(`[useRealtimeTable] INSERT ${String(table)} id=${id}`);
      if (id == null) return;

      setRows(prev => {
        const exists = prev.some(x => (x as any)?.[pkCamel] === id);
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
        const exists = prev.some(x => (x as any)?.[pkCamel] === id);
        if (!exists) return [mapped, ...prev];
        return prev.map(x => ((x as any)?.[pkCamel] === id ? mapped : x));
      });
    };

    const handleDelete = (payload: any) => {
      const row = payload?.old;
      if (!row) return;
      const id = (row as any)?.[primaryKeyColumn] ?? (row as any)?.[pkCamel];
      console.log(`[useRealtimeTable] DELETE ${String(table)} id=${id}`);
      if (id == null) return;

      setRows(prev => prev.filter(x => (x as any)?.[pkCamel] !== id));
    };

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: String(table) }, handleInsert)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: String(table) }, handleUpdate)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: String(table) }, handleDelete);

    channel.subscribe(status => {
      console.log(`[useRealtimeTable] channel ${channelName} status=${String(status)}`);
    });

    return () => {
      cancelled = true;
      try {
        void supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [primaryKeyColumn, table]);

  return { rows, isLoading };
}

