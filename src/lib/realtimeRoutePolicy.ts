import type { Usuario } from '@/types';
import {
  type RealtimeSyncTable,
  REALTIME_SYNC_TABLES,
  isRealtimeTableEnabled,
} from '@/lib/dataTableSyncPolicy';

/** Catálogo partilhado (tenant, filtros, selects) — uma vez por sessão em qualquer rota autenticada. */
export const REALTIME_CORE_CATALOG_TABLES: readonly RealtimeSyncTable[] = ['empresas', 'departamentos'];

/** Dashboard: só o que `Dashboard.tsx` consome via `useData()` (não carregar RH/finanças completos). */
export const DASHBOARD_ROUTE_TABLES: readonly RealtimeSyncTable[] = [
  'colaboradores',
  'requisicoes',
  'contratos',
  'reunioes',
  'processos_judiciais',
  'prazos_legais',
  'centros_custo',
  'pagamentos',
  'documentos_oficiais',
  'noticias',
  'eventos',
  'comunicados',
];

type RouteRule = { test: (pathname: string) => boolean; tables: readonly RealtimeSyncTable[] };

/** Tabelas extra por rota (além do catálogo). Ordem: regras mais específicas primeiro. */
const ROUTE_RULES: RouteRule[] = [
  {
    test: p => p.startsWith('/capital-humano/colaboradores'),
    tables: ['geofences', 'colaborador_geofences'],
  },
  {
    test: p => p.startsWith('/capital-humano/ferias'),
    tables: ['colaboradores', 'ferias'],
  },
  {
    test: p => p.startsWith('/capital-humano/faltas'),
    tables: ['colaboradores', 'faltas'],
  },
  {
    test: p => p.startsWith('/capital-humano/recibos'),
    tables: ['colaboradores', 'recibos_salario'],
  },
  {
    test: p => p.startsWith('/capital-humano/declaracoes'),
    tables: ['colaboradores', 'declaracoes'],
  },
  {
    test: p => p.startsWith('/capital-humano/processamento-salarial'),
    tables: ['colaboradores', 'recibos_salario', 'faltas'],
  },
  {
    test: p => p.startsWith('/capital-humano/assiduidade'),
    tables: ['colaboradores', 'faltas'],
  },
  {
    test: p => p.startsWith('/capital-humano/zonas-trabalho'),
    tables: ['geofences', 'colaborador_geofences', 'colaboradores'],
  },
  {
    test: p => p.startsWith('/capital-humano/marcacoes-ponto'),
    tables: ['colaboradores', 'geofences', 'colaborador_geofences'],
  },
  {
    test: p => p === '/dashboard' || p.startsWith('/dashboard/'),
    tables: DASHBOARD_ROUTE_TABLES,
  },
  {
    test: p => p.startsWith('/financas'),
    tables: [
      'colaboradores',
      'requisicoes',
      'centros_custo',
      'projectos',
      'movimentos_tesouraria',
      'bancos',
      'contas_bancarias',
      'pagamentos',
    ],
  },
  {
    test: p => p.startsWith('/contabilidade'),
    tables: ['requisicoes', 'pagamentos', 'pendencias_documentais'],
  },
  {
    test: p => p.startsWith('/secretaria'),
    tables: ['reunioes', 'actas', 'correspondencias', 'documentos_oficiais', 'colaboradores'],
  },
  {
    test: p => p.startsWith('/gestao-documentos'),
    tables: ['colaboradores'],
  },
  {
    test: p => p.startsWith('/juridico'),
    tables: [
      'contratos',
      'processos_judiciais',
      'prazos_legais',
      'riscos_juridicos',
      'processos_disciplinares',
      'rescisoes_contrato',
      'colaboradores',
    ],
  },
  {
    test: p => p.startsWith('/comunicacao-interna'),
    tables: ['noticias', 'eventos', 'comunicados', 'colaboradores'],
  },
  {
    test: p => p.startsWith('/planeamento'),
    tables: ['relatorios_planeamento', 'centros_custo', 'projectos'],
  },
  {
    test: p => p.startsWith('/conselho-administracao'),
    tables: [
      'colaboradores',
      'requisicoes',
      'centros_custo',
      'movimentos_tesouraria',
      'contratos',
      'relatorios_planeamento',
      'reunioes',
      'actas',
      'declaracoes',
      'ferias',
      'faltas',
      'recibos_salario',
    ],
  },
  {
    test: p => p.startsWith('/portal'),
    tables: ['colaboradores', 'ferias', 'faltas', 'recibos_salario', 'declaracoes', 'requisicoes'],
  },
  {
    test: p => p.startsWith('/configuracoes'),
    tables: ['departamentos', 'colaboradores'],
  },
  {
    test: p => p.startsWith('/controlo-interno'),
    tables: ['colaboradores', 'departamentos'],
  },
  {
    test: p => p.startsWith('/patrimonio'),
    tables: ['colaboradores'],
  },
  {
    test: p => p.startsWith('/produtividade'),
    tables: ['colaboradores'],
  },
  {
    test: p => p.startsWith('/facturacao'),
    tables: ['empresas'],
  },
];

function tablesForRoute(pathname: string): Set<RealtimeSyncTable> {
  const out = new Set<RealtimeSyncTable>(REALTIME_CORE_CATALOG_TABLES);
  for (const rule of ROUTE_RULES) {
    if (rule.test(pathname)) {
      for (const t of rule.tables) out.add(t);
      break;
    }
  }
  return out;
}

/** Bloqueio inicial do layout: só catálogo core (empresas + departamentos), não todas as tabelas da rota. */
export function anyBootstrapRealtimeLoading(
  flags: Record<RealtimeSyncTable, boolean>,
  loadingByTable: Record<RealtimeSyncTable, boolean>,
): boolean {
  for (const table of REALTIME_CORE_CATALOG_TABLES) {
    if (flags[table] && loadingByTable[table]) return true;
  }
  return false;
}

/** Combina permissão de módulo com tabelas necessárias à rota actual. */
export function isRealtimeTableEnabledForRoute(
  pathname: string,
  user: Usuario | null,
  table: RealtimeSyncTable,
): boolean {
  if (!isRealtimeTableEnabled(user, table)) return false;
  return tablesForRoute(pathname).has(table);
}

export function buildRealtimeSyncFlagsForRoute(
  pathname: string,
  user: Usuario | null,
): Record<RealtimeSyncTable, boolean> {
  const routeTables = tablesForRoute(pathname);
  const flags = {} as Record<RealtimeSyncTable, boolean>;
  for (const table of REALTIME_SYNC_TABLES) {
    flags[table] = isRealtimeTableEnabled(user, table) && routeTables.has(table);
  }
  return flags;
}

/** Notificações: só em rotas com UI de alertas (evita fetch no login e listagens pesadas). */
export function shouldLoadNotificationsOnRoute(pathname: string): boolean {
  if (pathname === '/login' || pathname.startsWith('/login')) return false;
  if (pathname.startsWith('/capital-humano/colaboradores')) return false;
  return true;
}
