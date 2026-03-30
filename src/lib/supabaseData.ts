import type { SupabaseClient } from '@supabase/supabase-js';
import { mapRowFromDb, mapRowsFromDb, mapToDb } from './supabaseMappers';
import { NUMERIC_KEYS } from './supabaseMappers';
import { serializePlaneamentoTextList } from '@/utils/planeamentoTextLists';
import type { Empresa, Departamento, Colaborador, Geofence, ColaboradorGeofenceLink, CentroCusto, Projecto, Reuniao, Acta, Contrato, ProcessoJudicial, PrazoLegal, RiscoJuridico, ProcessoDisciplinar, RescisaoContrato, Requisicao, Pagamento, MovimentoTesouraria, Ferias, Falta, ReciboSalario, Declaracao, Correspondencia, DocumentoOficial, PendenciaDocumental, RelatorioMensalPlaneamento, Noticia, Evento, Banco, ContaBancaria, IRTEscalao } from '@/types';

const TABLE_NAMES = {
  empresas: 'empresas',
  departamentos: 'departamentos',
  colaboradores: 'colaboradores',
  centros_custo: 'centros_custo',
  projectos: 'projectos',
  reunioes: 'reunioes',
  actas: 'actas',
  contratos: 'contratos',
  requisicoes: 'requisicoes',
  pagamentos: 'pagamentos',
  movimentos_tesouraria: 'movimentos_tesouraria',
  ferias: 'ferias',
  faltas: 'faltas',
  recibos_salario: 'recibos_salario',
  declaracoes: 'declaracoes',
  processos_judiciais: 'processos_judiciais',
  prazos_legais: 'prazos_legais',
  riscos_juridicos: 'riscos_juridicos',
  processos_disciplinares: 'processos_disciplinares',
  rescisoes_contrato: 'rescisoes_contrato',
  correspondencias: 'correspondencias',
  documentos_oficiais: 'documentos_oficiais',
  pendencias_documentais: 'pendencias_documentais',
  relatorios_planeamento: 'relatorios_planeamento',
  noticias: 'noticias',
  eventos: 'eventos',
  bancos: 'bancos',
  contas_bancarias: 'contas_bancarias',
  geofences: 'geofences',
} as const;

function num(id: number | string): number {
  return typeof id === 'string' ? parseInt(id, 10) : id;
}

/** Mensagem quando REST devolve 404 (tabela inexistente ou PostgREST sem reload). */
function erroColaboradorGeofencesIndisponivel(origem: string): Error {
  return new Error(
    `${origem}: tabela «colaborador_geofences» não está exposta (ex.: HTTP 404). ` +
      'Corra as migrações Supabase (20260328140000 e, se necessário, 20260329000000). ' +
      'Em local: `supabase db reset` ou `supabase migration up`; depois reinicie `supabase stop` e `supabase start` se o 404 persistir.',
  );
}

function isProvavelTabelaGeofencesInexistente(err: { message?: string; code?: string; details?: string }): boolean {
  const blob = `${err.message ?? ''} ${err.details ?? ''} ${err.code ?? ''}`.toLowerCase();
  return (
    blob.includes('404') ||
    blob.includes('not found') ||
    blob.includes('does not exist') ||
    blob.includes('schema cache') ||
    err.code === '42P01' ||
    err.code === 'PGRST205'
  );
}

export async function loadAllTables(supabase: SupabaseClient) {
  const [
    { data: empresas },
    { data: departamentos },
    { data: colaboradores },
    { data: centrosCusto },
    { data: projectos },
    { data: reunioes },
    { data: actas },
    { data: contratos },
    { data: requisicoes },
    { data: pagamentos },
    { data: movimentosTesouraria },
    { data: ferias },
    { data: faltas },
    { data: recibos },
    { data: declaracoes },
    { data: processos },
    { data: prazos },
    { data: riscos },
    { data: processosDisciplinares },
    { data: rescissoesContrato },
    { data: correspondencias },
    { data: documentosOficiais },
    { data: pendencias },
    { data: relatoriosPlaneamento },
    { data: noticias },
    { data: eventos },
    { data: bancos },
    { data: contasBancarias },
    { data: irtEscalaes },
    { data: geofences },
  ] = await Promise.all([
    supabase.from('empresas').select('*'),
    supabase.from('departamentos').select('*'),
    supabase.from('colaboradores').select('*'),
    supabase.from('centros_custo').select('*'),
    supabase.from('projectos').select('*'),
    supabase.from('reunioes').select('*'),
    supabase.from('actas').select('*'),
    supabase.from('contratos').select('*'),
    supabase.from('requisicoes').select('*'),
    supabase.from('pagamentos').select('*'),
    supabase.from('movimentos_tesouraria').select('*'),
    supabase.from('ferias').select('*'),
    supabase.from('faltas').select('*'),
    supabase.from('recibos_salario').select('*'),
    supabase.from('declaracoes').select('*'),
    supabase.from('processos_judiciais').select('*'),
    supabase.from('prazos_legais').select('*'),
    supabase.from('riscos_juridicos').select('*'),
    supabase.from('processos_disciplinares').select('*'),
    supabase.from('rescisoes_contrato').select('*'),
    supabase.from('correspondencias').select('*'),
    supabase.from('documentos_oficiais').select('*'),
    supabase.from('pendencias_documentais').select('*'),
    supabase.from('relatorios_planeamento').select('*'),
    supabase.from('noticias').select('*'),
    supabase.from('eventos').select('*'),
    supabase.from('bancos').select('*'),
    supabase.from('contas_bancarias').select('*'),
    supabase.from('irt_escalaes').select('*'),
    supabase.from('geofences').select('*'),
  ]);

  const colaboradorGeofencesRes = await supabase.from('colaborador_geofences').select('*');
  const colaboradorGeofences =
    colaboradorGeofencesRes.error && isProvavelTabelaGeofencesInexistente(colaboradorGeofencesRes.error)
      ? ([] as Record<string, unknown>[])
      : colaboradorGeofencesRes.data ?? [];
  if (colaboradorGeofencesRes.error && !isProvavelTabelaGeofencesInexistente(colaboradorGeofencesRes.error)) {
    throw colaboradorGeofencesRes.error;
  }

  return {
    empresas: mapRowsFromDb<Empresa>('empresas', empresas ?? []),
    departamentos: mapRowsFromDb<Departamento>('departamentos', departamentos ?? []),
    colaboradores: mapRowsFromDb<Colaborador>('colaboradores', colaboradores ?? []),
    centrosCusto: mapRowsFromDb<CentroCusto>('centros_custo', centrosCusto ?? []),
    projectos: mapRowsFromDb<Projecto>('projectos', projectos ?? []),
    reunioes: mapRowsFromDb<Reuniao>('reunioes', reunioes ?? []),
    actas: mapRowsFromDb<Acta>('actas', actas ?? []),
    contratos: mapRowsFromDb<Contrato>('contratos', contratos ?? []),
    requisicoes: mapRowsFromDb<Requisicao>('requisicoes', requisicoes ?? []),
    pagamentos: mapRowsFromDb<Pagamento>('pagamentos', pagamentos ?? []),
    movimentosTesouraria: mapRowsFromDb<MovimentoTesouraria>('movimentos_tesouraria', movimentosTesouraria ?? []),
    ferias: mapRowsFromDb<Ferias>('ferias', ferias ?? []),
    faltas: mapRowsFromDb<Falta>('faltas', faltas ?? []),
    recibos: mapRowsFromDb<ReciboSalario>('recibos_salario', recibos ?? []),
    declaracoes: mapRowsFromDb<Declaracao>('declaracoes', declaracoes ?? []),
    processos: mapRowsFromDb<ProcessoJudicial>('processos_judiciais', processos ?? []),
    prazos: mapRowsFromDb<PrazoLegal>('prazos_legais', prazos ?? []),
    riscos: mapRowsFromDb<RiscoJuridico>('riscos_juridicos', riscos ?? []),
    processosDisciplinares: mapRowsFromDb<ProcessoDisciplinar>('processos_disciplinares', processosDisciplinares ?? []),
    rescissoesContrato: mapRowsFromDb<RescisaoContrato>('rescisoes_contrato', rescissoesContrato ?? []),
    correspondencias: mapRowsFromDb<Correspondencia>('correspondencias', correspondencias ?? []),
    documentosOficiais: mapRowsFromDb<DocumentoOficial>('documentos_oficiais', documentosOficiais ?? []),
    pendencias: mapRowsFromDb<PendenciaDocumental>('pendencias_documentais', pendencias ?? []),
    relatoriosPlaneamento: mapRowsFromDb<RelatorioMensalPlaneamento>('relatorios_planeamento', relatoriosPlaneamento ?? []),
    noticias: mapRowsFromDb<Noticia>('noticias', noticias ?? []),
    eventos: mapRowsFromDb<Evento>('eventos', eventos ?? []),
    bancos: mapRowsFromDb<Banco>('bancos', bancos ?? []),
    contasBancarias: mapRowsFromDb<ContaBancaria>('contas_bancarias', contasBancarias ?? []),
    irtEscalaes: mapRowsFromDb<IRTEscalao>('irt_escalaes', irtEscalaes ?? []),
    geofences: mapRowsFromDb<Geofence>('geofences', geofences ?? []),
    colaboradorGeofenceLinks: mapRowsFromDb<ColaboradorGeofenceLink>('colaborador_geofences', colaboradorGeofences ?? []),
  };
}

export async function fetchColaboradorGeofenceLinks(supabase: SupabaseClient): Promise<ColaboradorGeofenceLink[]> {
  const { data, error } = await supabase.from('colaborador_geofences').select('*');
  if (error) {
    if (isProvavelTabelaGeofencesInexistente(error)) throw erroColaboradorGeofencesIndisponivel('fetchColaboradorGeofenceLinks');
    throw error;
  }
  return mapRowsFromDb<ColaboradorGeofenceLink>('colaborador_geofences', (data ?? []) as Record<string, unknown>[]);
}

/** Substitui as ligações colaborador ↔ zonas; só mantém geofences da mesma empresa do colaborador. */
export async function syncColaboradorGeofenceLinks(
  supabase: SupabaseClient,
  colaboradorId: number,
  geofenceIds: number[],
  colaboradorEmpresaId: number,
): Promise<void> {
  const unique = [...new Set(geofenceIds.filter(id => Number.isFinite(id) && id > 0))];
  let valid = unique;
  if (unique.length > 0) {
    const { data: zones, error: zErr } = await supabase
      .from('geofences')
      .select('id')
      .in('id', unique)
      .eq('empresa_id', colaboradorEmpresaId);
    if (zErr) throw zErr;
    const allowed = new Set((zones ?? []).map((r: { id: number | string }) => Number(r.id)));
    valid = unique.filter(id => allowed.has(id));
  }
  const { error: delErr } = await supabase.from('colaborador_geofences').delete().eq('colaborador_id', colaboradorId);
  if (delErr) {
    if (isProvavelTabelaGeofencesInexistente(delErr)) throw erroColaboradorGeofencesIndisponivel('syncColaboradorGeofenceLinks (delete)');
    throw delErr;
  }
  if (valid.length === 0) return;
  const { error: insErr } = await supabase.from('colaborador_geofences').insert(
    valid.map(geofence_id => ({ colaborador_id: colaboradorId, geofence_id })),
  );
  if (insErr) {
    if (isProvavelTabelaGeofencesInexistente(insErr)) throw erroColaboradorGeofencesIndisponivel('syncColaboradorGeofenceLinks (insert)');
    throw insErr;
  }
}

export interface ColaboradoresPaginatedParams {
  empresaIds: number[];
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  departamento?: string;
}

export interface ColaboradoresPaginatedResult {
  data: Colaborador[];
  totalCount: number;
}

/** Paginação no servidor: devolve uma página de colaboradores e o total. */
export async function fetchColaboradoresPaginated(
  supabase: SupabaseClient,
  params: ColaboradoresPaginatedParams
): Promise<ColaboradoresPaginatedResult> {
  const { empresaIds, page, pageSize, search, status, departamento } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from('colaboradores')
    .select('*', { count: 'exact' })
    .in('empresa_id', empresaIds)
    .order('nome', { ascending: true });

  if (search?.trim()) {
    const raw = search.trim().replace(/,/g, ' ');
    const term = `%${raw}%`;
    q = q.or(`nome.ilike.${term},cargo.ilike.${term},departamento.ilike.${term},email_corporativo.ilike.${term}`);
  }
  if (status && status !== 'todos') {
    q = q.eq('status', status);
  }
  if (departamento && departamento !== 'todos') {
    q = q.eq('departamento', departamento);
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    data: mapRowsFromDb<Colaborador>('colaboradores', rows),
    totalCount: count ?? 0,
  };
}

/** Lista de departamentos distintos dos colaboradores (para filtro). */
export async function fetchColaboradoresDepartamentos(
  supabase: SupabaseClient,
  empresaIds: number[]
): Promise<string[]> {
  const { data, error } = await supabase
    .from('colaboradores')
    .select('departamento')
    .in('empresa_id', empresaIds);
  if (error) throw error;
  const rows = (data ?? []) as { departamento: string | null }[];
  const set = new Set(rows.map(r => r.departamento).filter(Boolean) as string[]);
  return Array.from(set).sort();
}

/** IDs de colaboradores por empresa (para filtrar ferias, faltas, recibos, declaracoes). */
export async function fetchColaboradorIdsByEmpresa(
  supabase: SupabaseClient,
  empresaIds: number[]
): Promise<number[]> {
  if (empresaIds.length === 0) return [];
  const { data, error } = await supabase
    .from('colaboradores')
    .select('id')
    .in('empresa_id', empresaIds);
  if (error) throw error;
  return ((data ?? []) as { id: number }[]).map(r => r.id);
}

export interface TablePaginatedParams {
  page: number;
  pageSize: number;
  orderBy: string;
  ascending?: boolean;
  empresaIds?: number[];
  filters?: Record<string, string | number>;
  searchColumns?: string[];
  searchTerm?: string;
  colabIds?: number[];
  colabIdColumn?: string;
}

/** Paginação genérica para qualquer tabela. */
export async function fetchTablePaginated<T>(
  supabase: SupabaseClient,
  tableKey: keyof typeof TABLE_NAMES,
  mapperKey: keyof typeof NUMERIC_KEYS,
  params: TablePaginatedParams
): Promise<{ data: T[]; totalCount: number }> {
  const { page, pageSize, orderBy, ascending = true, empresaIds, filters, searchColumns, searchTerm, colabIds, colabIdColumn } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const tableName = TABLE_NAMES[tableKey];

  let q = supabase.from(tableName).select('*', { count: 'exact' }).order(orderBy, { ascending });

  if (empresaIds?.length) q = q.in('empresa_id', empresaIds);
  if (colabIds?.length && colabIdColumn) q = q.in(colabIdColumn, colabIds);
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v !== '' && v !== 'todos') q = q.eq(k, v);
    }
  }
  if (searchTerm?.trim() && searchColumns?.length) {
    const raw = searchTerm.trim().replace(/,/g, ' ');
    const term = `%${raw}%`;
    q = q.or(searchColumns.map(c => `${c}.ilike.${term}`).join(','));
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    data: mapRowsFromDb<T>(mapperKey, rows),
    totalCount: count ?? 0,
  };
}

async function insertOne<T>(
  supabase: SupabaseClient,
  table: keyof typeof TABLE_NAMES,
  payload: Record<string, unknown>,
  mapperKey: keyof typeof NUMERIC_KEYS
): Promise<T> {
  const row = mapToDb(payload);
  const { data, error } = await supabase.from(TABLE_NAMES[table]).insert(row).select().single();
  if (error) throw error;
  return mapRowFromDb(mapperKey, data) as T;
}

async function updateOne<T>(
  supabase: SupabaseClient,
  table: keyof typeof TABLE_NAMES,
  id: number,
  payload: Record<string, unknown>,
  mapperKey: keyof typeof NUMERIC_KEYS
): Promise<T> {
  const row = mapToDb(payload, false);
  delete row.id;
  const { data, error } = await supabase.from(TABLE_NAMES[table]).update(row).eq('id', id).select().single();
  if (error) throw error;
  return mapRowFromDb(mapperKey, data) as T;
}

async function deleteOne(supabase: SupabaseClient, table: keyof typeof TABLE_NAMES, id: number): Promise<void> {
  const { error } = await supabase.from(TABLE_NAMES[table]).delete().eq('id', id);
  if (error) throw error;
}

const RELATORIO_PLANEAMENTO_LIST_KEYS = [
  'actividadesComerciais',
  'principaisConstrangimentos',
  'estrategiasReceitas',
  'estrategiasCustos',
] as const;

function prepareRelatorioPlaneamentoDbRow(p: Record<string, unknown>, omitId: boolean): Record<string, unknown> {
  const next = { ...p };
  for (const k of RELATORIO_PLANEAMENTO_LIST_KEYS) {
    if (k in next && Array.isArray(next[k])) {
      next[k] = serializePlaneamentoTextList(next[k] as string[]);
    }
  }
  return mapToDb(next, omitId);
}

async function insertRelatorioPlaneamento(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<RelatorioMensalPlaneamento> {
  const row = prepareRelatorioPlaneamentoDbRow(payload, true);
  const { data, error } = await supabase.from(TABLE_NAMES.relatorios_planeamento).insert(row).select().single();
  if (error) throw error;
  return mapRowFromDb<RelatorioMensalPlaneamento>('relatorios_planeamento', data as Record<string, unknown>);
}

async function updateRelatorioPlaneamentoRow(
  supabase: SupabaseClient,
  id: number,
  payload: Record<string, unknown>,
): Promise<RelatorioMensalPlaneamento> {
  const row = prepareRelatorioPlaneamentoDbRow(payload, false);
  delete row.id;
  const { data, error } = await supabase.from(TABLE_NAMES.relatorios_planeamento).update(row).eq('id', id).select().single();
  if (error) throw error;
  return mapRowFromDb<RelatorioMensalPlaneamento>('relatorios_planeamento', data as Record<string, unknown>);
}

export const db = {
  empresas: {
    insert: (s: SupabaseClient, p: Partial<Empresa>) => insertOne<Empresa>(s, 'empresas', p as Record<string, unknown>, 'empresas'),
    update: (s: SupabaseClient, id: number, p: Partial<Empresa>) => updateOne<Empresa>(s, 'empresas', id, p as Record<string, unknown>, 'empresas'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'empresas', id),
  },
  departamentos: {
    insert: (s: SupabaseClient, p: Partial<Departamento>) => insertOne<Departamento>(s, 'departamentos', p as Record<string, unknown>, 'departamentos'),
    update: (s: SupabaseClient, id: number, p: Partial<Departamento>) => updateOne<Departamento>(s, 'departamentos', id, p as Record<string, unknown>, 'departamentos'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'departamentos', id),
  },
  colaboradores: {
    insert: (s: SupabaseClient, p: Partial<Colaborador>) => {
      const { geofenceIds: _gf, ...rest } = p as Partial<Colaborador> & { geofenceIds?: number[] };
      return insertOne<Colaborador>(s, 'colaboradores', rest as Record<string, unknown>, 'colaboradores');
    },
    update: (s: SupabaseClient, id: number, p: Partial<Colaborador>) => {
      const { geofenceIds: _gf, ...rest } = p as Partial<Colaborador> & { geofenceIds?: number[] };
      return updateOne<Colaborador>(s, 'colaboradores', id, rest as Record<string, unknown>, 'colaboradores');
    },
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'colaboradores', id),
  },
  geofences: {
    insert: (s: SupabaseClient, p: Partial<Geofence>) => insertOne<Geofence>(s, 'geofences', p as Record<string, unknown>, 'geofences'),
    update: (s: SupabaseClient, id: number, p: Partial<Geofence>) => updateOne<Geofence>(s, 'geofences', id, p as Record<string, unknown>, 'geofences'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'geofences', id),
  },
  centros_custo: {
    insert: (s: SupabaseClient, p: Partial<CentroCusto>) => insertOne<CentroCusto>(s, 'centros_custo', p as Record<string, unknown>, 'centros_custo'),
    update: (s: SupabaseClient, id: number, p: Partial<CentroCusto>) => updateOne<CentroCusto>(s, 'centros_custo', id, p as Record<string, unknown>, 'centros_custo'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'centros_custo', id),
  },
  projectos: {
    insert: (s: SupabaseClient, p: Partial<Projecto>) => insertOne<Projecto>(s, 'projectos', p as Record<string, unknown>, 'projectos'),
    update: (s: SupabaseClient, id: number, p: Partial<Projecto>) => updateOne<Projecto>(s, 'projectos', id, p as Record<string, unknown>, 'projectos'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'projectos', id),
  },
  reunioes: {
    insert: (s: SupabaseClient, p: Partial<Reuniao>) => insertOne<Reuniao>(s, 'reunioes', p as Record<string, unknown>, 'reunioes'),
    update: (s: SupabaseClient, id: number, p: Partial<Reuniao>) => updateOne<Reuniao>(s, 'reunioes', id, p as Record<string, unknown>, 'reunioes'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'reunioes', id),
  },
  actas: {
    insert: (s: SupabaseClient, p: Partial<Acta>) => insertOne<Acta>(s, 'actas', p as Record<string, unknown>, 'actas'),
    update: (s: SupabaseClient, id: number, p: Partial<Acta>) => updateOne<Acta>(s, 'actas', id, p as Record<string, unknown>, 'actas'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'actas', id),
  },
  contratos: {
    insert: (s: SupabaseClient, p: Partial<Contrato>) => insertOne<Contrato>(s, 'contratos', p as Record<string, unknown>, 'contratos'),
    update: (s: SupabaseClient, id: number, p: Partial<Contrato>) => updateOne<Contrato>(s, 'contratos', id, p as Record<string, unknown>, 'contratos'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'contratos', id),
  },
  requisicoes: {
    insert: (s: SupabaseClient, p: Partial<Requisicao>) => insertOne<Requisicao>(s, 'requisicoes', p as Record<string, unknown>, 'requisicoes'),
    update: (s: SupabaseClient, id: number, p: Partial<Requisicao>) => updateOne<Requisicao>(s, 'requisicoes', id, p as Record<string, unknown>, 'requisicoes'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'requisicoes', id),
  },
  pagamentos: {
    insert: (s: SupabaseClient, p: Partial<Pagamento>) => insertOne<Pagamento>(s, 'pagamentos', p as Record<string, unknown>, 'pagamentos'),
    update: (s: SupabaseClient, id: number, p: Partial<Pagamento>) => updateOne<Pagamento>(s, 'pagamentos', id, p as Record<string, unknown>, 'pagamentos'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'pagamentos', id),
  },
  movimentos_tesouraria: {
    insert: (s: SupabaseClient, p: Partial<MovimentoTesouraria>) => insertOne<MovimentoTesouraria>(s, 'movimentos_tesouraria', p as Record<string, unknown>, 'movimentos_tesouraria'),
    update: (s: SupabaseClient, id: number, p: Partial<MovimentoTesouraria>) => updateOne<MovimentoTesouraria>(s, 'movimentos_tesouraria', id, p as Record<string, unknown>, 'movimentos_tesouraria'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'movimentos_tesouraria', id),
  },
  ferias: {
    insert: (s: SupabaseClient, p: Partial<Ferias>) => insertOne<Ferias>(s, 'ferias', p as Record<string, unknown>, 'ferias'),
    update: (s: SupabaseClient, id: number, p: Partial<Ferias>) => updateOne<Ferias>(s, 'ferias', id, p as Record<string, unknown>, 'ferias'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'ferias', id),
  },
  faltas: {
    insert: (s: SupabaseClient, p: Partial<Falta>) => insertOne<Falta>(s, 'faltas', p as Record<string, unknown>, 'faltas'),
    update: (s: SupabaseClient, id: number, p: Partial<Falta>) => updateOne<Falta>(s, 'faltas', id, p as Record<string, unknown>, 'faltas'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'faltas', id),
  },
  recibos_salario: {
    insert: (s: SupabaseClient, p: Partial<ReciboSalario>) => insertOne<ReciboSalario>(s, 'recibos_salario', p as Record<string, unknown>, 'recibos_salario'),
    update: (s: SupabaseClient, id: number, p: Partial<ReciboSalario>) => updateOne<ReciboSalario>(s, 'recibos_salario', id, p as Record<string, unknown>, 'recibos_salario'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'recibos_salario', id),
  },
  declaracoes: {
    insert: (s: SupabaseClient, p: Partial<Declaracao>) => insertOne<Declaracao>(s, 'declaracoes', p as Record<string, unknown>, 'declaracoes'),
    update: (s: SupabaseClient, id: number, p: Partial<Declaracao>) => updateOne<Declaracao>(s, 'declaracoes', id, p as Record<string, unknown>, 'declaracoes'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'declaracoes', id),
  },
  processos_judiciais: {
    insert: (s: SupabaseClient, p: Partial<ProcessoJudicial>) => insertOne<ProcessoJudicial>(s, 'processos_judiciais', p as Record<string, unknown>, 'processos_judiciais'),
    update: (s: SupabaseClient, id: number, p: Partial<ProcessoJudicial>) => updateOne<ProcessoJudicial>(s, 'processos_judiciais', id, p as Record<string, unknown>, 'processos_judiciais'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'processos_judiciais', id),
  },
  prazos_legais: {
    insert: (s: SupabaseClient, p: Partial<PrazoLegal>) => insertOne<PrazoLegal>(s, 'prazos_legais', p as Record<string, unknown>, 'prazos_legais'),
    update: (s: SupabaseClient, id: number, p: Partial<PrazoLegal>) => updateOne<PrazoLegal>(s, 'prazos_legais', id, p as Record<string, unknown>, 'prazos_legais'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'prazos_legais', id),
  },
  riscos_juridicos: {
    insert: (s: SupabaseClient, p: Partial<RiscoJuridico>) => insertOne<RiscoJuridico>(s, 'riscos_juridicos', p as Record<string, unknown>, 'riscos_juridicos'),
    update: (s: SupabaseClient, id: number, p: Partial<RiscoJuridico>) => updateOne<RiscoJuridico>(s, 'riscos_juridicos', id, p as Record<string, unknown>, 'riscos_juridicos'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'riscos_juridicos', id),
  },
  processos_disciplinares: {
    insert: (s: SupabaseClient, p: Partial<ProcessoDisciplinar>) => insertOne<ProcessoDisciplinar>(s, 'processos_disciplinares', p as Record<string, unknown>, 'processos_disciplinares'),
    update: (s: SupabaseClient, id: number, p: Partial<ProcessoDisciplinar>) => updateOne<ProcessoDisciplinar>(s, 'processos_disciplinares', id, p as Record<string, unknown>, 'processos_disciplinares'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'processos_disciplinares', id),
  },
  rescisoes_contrato: {
    insert: (s: SupabaseClient, p: Partial<RescisaoContrato>) => insertOne<RescisaoContrato>(s, 'rescisoes_contrato', p as Record<string, unknown>, 'rescisoes_contrato'),
    update: (s: SupabaseClient, id: number, p: Partial<RescisaoContrato>) => updateOne<RescisaoContrato>(s, 'rescisoes_contrato', id, p as Record<string, unknown>, 'rescisoes_contrato'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'rescisoes_contrato', id),
  },
  correspondencias: {
    insert: (s: SupabaseClient, p: Partial<Correspondencia>) => insertOne<Correspondencia>(s, 'correspondencias', p as Record<string, unknown>, 'correspondencias'),
    update: (s: SupabaseClient, id: number, p: Partial<Correspondencia>) => updateOne<Correspondencia>(s, 'correspondencias', id, p as Record<string, unknown>, 'correspondencias'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'correspondencias', id),
  },
  documentos_oficiais: {
    insert: (s: SupabaseClient, p: Partial<DocumentoOficial>) => insertOne<DocumentoOficial>(s, 'documentos_oficiais', p as Record<string, unknown>, 'documentos_oficiais'),
    update: (s: SupabaseClient, id: number, p: Partial<DocumentoOficial>) => updateOne<DocumentoOficial>(s, 'documentos_oficiais', id, p as Record<string, unknown>, 'documentos_oficiais'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'documentos_oficiais', id),
  },
  pendencias_documentais: {
    insert: (s: SupabaseClient, p: Partial<PendenciaDocumental>) => insertOne<PendenciaDocumental>(s, 'pendencias_documentais', p as Record<string, unknown>, 'pendencias_documentais'),
    update: (s: SupabaseClient, id: number, p: Partial<PendenciaDocumental>) => updateOne<PendenciaDocumental>(s, 'pendencias_documentais', id, p as Record<string, unknown>, 'pendencias_documentais'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'pendencias_documentais', id),
  },
  relatorios_planeamento: {
    insert: (s: SupabaseClient, p: Partial<RelatorioMensalPlaneamento>) =>
      insertRelatorioPlaneamento(s, p as Record<string, unknown>),
    update: (s: SupabaseClient, id: number, p: Partial<RelatorioMensalPlaneamento>) =>
      updateRelatorioPlaneamentoRow(s, id, p as Record<string, unknown>),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'relatorios_planeamento', id),
  },
  noticias: {
    insert: (s: SupabaseClient, p: Partial<Noticia>) => insertOne<Noticia>(s, 'noticias', p as Record<string, unknown>, 'noticias'),
    update: (s: SupabaseClient, id: number, p: Partial<Noticia>) => updateOne<Noticia>(s, 'noticias', id, p as Record<string, unknown>, 'noticias'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'noticias', id),
  },
  eventos: {
    insert: (s: SupabaseClient, p: Partial<Evento>) => insertOne<Evento>(s, 'eventos', p as Record<string, unknown>, 'eventos'),
    update: (s: SupabaseClient, id: number, p: Partial<Evento>) => updateOne<Evento>(s, 'eventos', id, p as Record<string, unknown>, 'eventos'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'eventos', id),
  },
  bancos: {
    insert: (s: SupabaseClient, p: Partial<Banco>) => insertOne<Banco>(s, 'bancos', p as Record<string, unknown>, 'bancos'),
    update: (s: SupabaseClient, id: number, p: Partial<Banco>) => updateOne<Banco>(s, 'bancos', id, p as Record<string, unknown>, 'bancos'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'bancos', id),
  },
  contas_bancarias: {
    insert: (s: SupabaseClient, p: Partial<ContaBancaria>) =>
      insertOne<ContaBancaria>(s, 'contas_bancarias', p as Record<string, unknown>, 'contas_bancarias'),
    update: (s: SupabaseClient, id: number, p: Partial<ContaBancaria>) =>
      updateOne<ContaBancaria>(s, 'contas_bancarias', id, p as Record<string, unknown>, 'contas_bancarias'),
    delete: (s: SupabaseClient, id: number) => deleteOne(s, 'contas_bancarias', id),
  },
};
