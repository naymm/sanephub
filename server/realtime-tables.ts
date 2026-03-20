/**
 * Tabelas sincronizadas por `useRealtimeTable` no frontend.
 * Manter alinhado com as chaves de `src/lib/supabaseMappers.ts` → `NUMERIC_KEYS`.
 */
export const REALTIME_TABLES = [
  'empresas',
  'departamentos',
  'colaboradores',
  'centros_custo',
  'projectos',
  'reunioes',
  'actas',
  'contratos',
  'requisicoes',
  'pagamentos',
  'movimentos_tesouraria',
  'ferias',
  'faltas',
  'recibos_salario',
  'declaracoes',
  'noticias',
  'eventos',
  'processos_judiciais',
  'prazos_legais',
  'riscos_juridicos',
  'processos_disciplinares',
  'rescisoes_contrato',
  'correspondencias',
  'documentos_oficiais',
  'pendencias_documentais',
  'relatorios_planeamento',
  'notificacoes',
] as const;

export type RealtimeTableName = (typeof REALTIME_TABLES)[number];

export function isRealtimeTable(name: string): name is RealtimeTableName {
  return (REALTIME_TABLES as readonly string[]).includes(name);
}
