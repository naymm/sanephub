import { useEffect } from 'react';
import type { RealtimeSyncTable } from '@/lib/dataTableSyncPolicy';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

type Props<T> = {
  table: RealtimeSyncTable;
  primaryKeyColumn: string;
  enabled: boolean;
  onRows: (rows: T[]) => void;
  onLoading: (loading: boolean) => void;
  mapRow?: (row: Record<string, unknown>) => T;
  select?: string;
};

/** Só monta o hook realtime quando `enabled` — evita canais Supabase em tabelas inactivas na rota. */
export function RealtimeTableBridge<T>({
  table,
  primaryKeyColumn,
  enabled,
  onRows,
  onLoading,
  mapRow,
  select,
}: Props<T>) {
  const { rows, isLoading } = useRealtimeTable<T>(table, primaryKeyColumn, {
    enabled,
    mapRow,
    select,
  });

  useEffect(() => {
    onRows(rows);
  }, [rows, onRows]);

  useEffect(() => {
    onLoading(isLoading);
  }, [isLoading, onLoading]);

  useEffect(() => {
    return () => {
      onLoading(false);
    };
  }, [onLoading]);

  return null;
}
