import type { Usuario } from '@/types';
import { hasModuleAccess } from '@/context/AuthContext';
import type { NUMERIC_KEYS } from '@/lib/supabaseMappers';

/** Tabelas sincronizadas via `useRealtimeTable` no DataContext. */
export type RealtimeSyncTable = Extract<
  keyof typeof NUMERIC_KEYS,
  | 'empresas'
  | 'departamentos'
  | 'colaboradores'
  | 'ferias'
  | 'faltas'
  | 'recibos_salario'
  | 'declaracoes'
  | 'noticias'
  | 'eventos'
  | 'comunicados'
  | 'requisicoes'
  | 'centros_custo'
  | 'projectos'
  | 'reunioes'
  | 'actas'
  | 'contratos'
  | 'processos_judiciais'
  | 'prazos_legais'
  | 'correspondencias'
  | 'documentos_oficiais'
  | 'riscos_juridicos'
  | 'pagamentos'
  | 'pendencias_documentais'
  | 'movimentos_tesouraria'
  | 'bancos'
  | 'contas_bancarias'
  | 'relatorios_planeamento'
  | 'processos_disciplinares'
  | 'rescisoes_contrato'
  | 'geofences'
  | 'colaborador_geofences'
>;

export const REALTIME_SYNC_TABLES: readonly RealtimeSyncTable[] = [
  'empresas',
  'departamentos',
  'colaboradores',
  'ferias',
  'faltas',
  'recibos_salario',
  'declaracoes',
  'noticias',
  'eventos',
  'comunicados',
  'requisicoes',
  'centros_custo',
  'projectos',
  'reunioes',
  'actas',
  'contratos',
  'processos_judiciais',
  'prazos_legais',
  'correspondencias',
  'documentos_oficiais',
  'riscos_juridicos',
  'pagamentos',
  'pendencias_documentais',
  'movimentos_tesouraria',
  'bancos',
  'contas_bancarias',
  'relatorios_planeamento',
  'processos_disciplinares',
  'rescisoes_contrato',
  'geofences',
  'colaborador_geofences',
] as const;

function mod(user: Usuario | null, module: string): boolean {
  return hasModuleAccess(user, module);
}

/**
 * Define se uma tabela deve ser carregada/subscrita no login.
 * Admin carrega tudo; restantes perfis só o necessário aos módulos com acesso.
 */
export function isRealtimeTableEnabled(user: Usuario | null, table: RealtimeSyncTable): boolean {
  if (!user) return false;
  if (user.perfil === 'Admin') return true;

  const rh = () => mod(user, 'capital-humano');
  const portal = () => mod(user, 'portal-colaborador');
  const fin = () => mod(user, 'financas');
  const sec = () => mod(user, 'secretaria');
  const jur = () => mod(user, 'juridico');
  const plan = () => mod(user, 'planeamento');
  const conselho = () => mod(user, 'conselho-administracao');
  const contab = () => mod(user, 'contabilidade');
  const ci = () => mod(user, 'controlo-interno');
  const com = () => mod(user, 'comunicacao-interna');

  switch (table) {
    case 'empresas':
    case 'colaboradores':
      return true;
    case 'departamentos':
      return (
        mod(user, 'configuracoes') ||
        rh() ||
        fin() ||
        sec() ||
        plan() ||
        ci() ||
        portal() ||
        conselho()
      );
    case 'ferias':
    case 'faltas':
    case 'recibos_salario':
    case 'declaracoes':
      return rh() || portal() || conselho();
    case 'geofences':
    case 'colaborador_geofences':
      return rh() || portal() || user.colaboradorId != null;
    case 'noticias':
    case 'eventos':
    case 'comunicados':
      return com();
    case 'requisicoes':
    case 'centros_custo':
    case 'projectos':
    case 'movimentos_tesouraria':
    case 'bancos':
    case 'contas_bancarias':
      return fin() || conselho() || portal();
    case 'pagamentos':
      return fin() || contab() || conselho();
    case 'pendencias_documentais':
      return contab();
    case 'reunioes':
    case 'actas':
    case 'correspondencias':
    case 'documentos_oficiais':
      return sec() || conselho();
    case 'contratos':
      return jur() || fin() || conselho();
    case 'processos_judiciais':
    case 'prazos_legais':
    case 'riscos_juridicos':
    case 'processos_disciplinares':
    case 'rescisoes_contrato':
      return jur();
    case 'relatorios_planeamento':
      return plan() || conselho();
    default:
      return false;
  }
}

export function buildRealtimeSyncFlags(user: Usuario | null): Record<RealtimeSyncTable, boolean> {
  const flags = {} as Record<RealtimeSyncTable, boolean>;
  for (const table of REALTIME_SYNC_TABLES) {
    flags[table] = isRealtimeTableEnabled(user, table);
  }
  return flags;
}

/** Conta apenas tabelas activas que ainda estão a carregar. */
export function anyEnabledRealtimeLoading(
  flags: Record<RealtimeSyncTable, boolean>,
  loadingByTable: Record<RealtimeSyncTable, boolean>,
): boolean {
  for (const table of REALTIME_SYNC_TABLES) {
    if (flags[table] && loadingByTable[table]) return true;
  }
  return false;
}
