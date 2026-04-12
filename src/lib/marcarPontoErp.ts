import type { SupabaseClient } from '@supabase/supabase-js';
import { agoraIsoParaDataHoraPonto } from '@/lib/pontoFusoHorario';

export type TipoMarcacaoPontoErp = 'Entrada' | 'Saída';

export interface MarcarPontoErpOptions {
  numeroMec: string;
  /** ID da empresa do colaborador (validação no cliente / futuros usos); o insert usa a coluna texto `empresa`. */
  empresaId: number;
  /** Nome da empresa (coluna `empresa` em `biometrico_registros`); obrigatório para alinhar com `empresas.nome` na RLS. */
  empresaNomeTexto: string;
  coords?: { lat: number; lng: number; accuracyM?: number | null };
  /** Preencher após validação com `geofences` (requer colunas na BD — ver migração). */
  geofenceId?: number | null;
  isWithinGeofence?: boolean | null;
  /** Por omissão `Entrada`; use `Saída` após já haver entrada no dia. */
  tipoMarcacao?: TipoMarcacaoPontoErp;
}

/**
 * Monta o corpo do INSERT só com colunas suportadas pelo PostgREST (evita PGRST204 por chaves inexistentes, ex.: client_meta).
 */
function buildBiometricoInsertRow(opts: MarcarPontoErpOptions): Record<string, unknown> {
  const occurred = agoraIsoParaDataHoraPonto();
  const nomeEmpresa = opts.empresaNomeTexto.trim();
  const tipo = opts.tipoMarcacao === 'Saída' ? 'Saída' : 'Entrada';
  const row: Record<string, unknown> = {
    numero_mec: opts.numeroMec.trim(),
    empresa: nomeEmpresa,
    /** Hora oficial WAT (UTC+1); coluna típica `data_hora`. */
    data_hora: occurred,
    tipo,
    via: 'ERP',
  };
  if (opts.coords) {
    row.location_lat = opts.coords.lat;
    row.location_lng = opts.coords.lng;
    if (opts.coords.accuracyM != null && Number.isFinite(opts.coords.accuracyM)) {
      row.location_accuracy_m = opts.coords.accuracyM;
    }
  }
  if (opts.geofenceId != null && Number.isFinite(Number(opts.geofenceId))) {
    row.geofence_id = Number(opts.geofenceId);
  }
  if (opts.isWithinGeofence !== undefined && opts.isWithinGeofence !== null) {
    row.is_within_geofence = opts.isWithinGeofence;
  }
  return row;
}

/**
 * Insere marcação de entrada ou saída em `biometrico_registros` a partir da intranet.
 */
export async function marcarPontoPeloErp(
  client: SupabaseClient,
  opts: MarcarPontoErpOptions,
): Promise<{ error: string | null }> {
  const nomeEmpresa = opts.empresaNomeTexto.trim();
  if (!nomeEmpresa) return { error: 'Nome da empresa em falta para o registo de ponto.' };

  const row = buildBiometricoInsertRow(opts);

  const { error } = await client.from('biometrico_registros').insert(row);
  if (error) return { error: error.message };
  return { error: null };
}

/** @deprecated Use `marcarPontoPeloErp` */
export const marcarEntradaPeloErp = marcarPontoPeloErp;
