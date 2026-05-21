import { mapRowFromDb } from '@/lib/supabaseMappers';
import type {
  CiAuditoria,
  CiChecklistEvidencia,
  CiChecklistItem,
  CiInspecao,
  CiNaoConformidade,
  CiPlanoAccao,
  CiRisco,
} from '@/types/controloInterno';

function normEquipaIds(v: unknown): number[] {
  if (Array.isArray(v)) return v.map(Number).filter(Number.isFinite);
  return [];
}

export function mapCiAuditoria(row: Record<string, unknown>): CiAuditoria {
  const m = mapRowFromDb<CiAuditoria>('ci_auditorias', row);
  return {
    ...m,
    natureza: (row.natureza as CiAuditoria['natureza']) ?? 'Orgânica',
    areaDireccionada: String(row.area_direccionada ?? m.areaDireccionada ?? ''),
    prazo: (row.prazo as string | null) ?? m.prazo ?? null,
    equipaColaboradorIds: normEquipaIds(row.equipa_colaborador_ids ?? m.equipaColaboradorIds),
  };
}

export function mapCiInspecao(row: Record<string, unknown>): CiInspecao {
  const m = mapRowFromDb<CiInspecao>('ci_inspecoes', row);
  return {
    ...m,
    natureza: (row.natureza as CiInspecao['natureza']) ?? 'Orgânica',
    areaDireccionada: String(row.area_direccionada ?? m.areaDireccionada ?? ''),
    dataInspecao: (row.data_inspecao as string | null) ?? m.dataInspecao ?? null,
  };
}

export function mapCiChecklistItem(row: Record<string, unknown>): CiChecklistItem {
  return mapRowFromDb<CiChecklistItem>('ci_checklist_itens', row);
}

export function mapCiEvidencia(row: Record<string, unknown>): CiChecklistEvidencia {
  return mapRowFromDb<CiChecklistEvidencia>('ci_checklist_evidencias', row);
}

export function mapCiNc(row: Record<string, unknown>): CiNaoConformidade {
  return mapRowFromDb<CiNaoConformidade>('ci_nao_conformidades', row);
}

export function mapCiPlano(row: Record<string, unknown>): CiPlanoAccao {
  return mapRowFromDb<CiPlanoAccao>('ci_planos_accao', row);
}

export function mapCiRisco(row: Record<string, unknown>): CiRisco {
  return mapRowFromDb<CiRisco>('ci_riscos', row);
}
