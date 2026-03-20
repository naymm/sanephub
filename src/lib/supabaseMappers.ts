/**
 * Converte chaves snake_case -> camelCase (para dados vindos do Supabase).
 * Converte valores numéricos e ids para number.
 */
function toCamel<T>(obj: unknown): T {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) return obj.map(item => toCamel(item)) as T;
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      out[camel] = toCamel(v);
    }
    return out as T;
  }
  return obj as T;
}

/**
 * Converte chaves camelCase -> snake_case (para enviar ao Supabase).
 * Omite undefined; mantém null.
 */
function toSnake(obj: unknown): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const snake = k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
    out[snake] = typeof v === 'object' && v !== null && !Array.isArray(v) ? toSnake(v) : v;
  }
  return out;
}

/** Garante que id e outros números são number (Supabase pode devolver string para bigint). */
function ensureNumbers<T extends Record<string, unknown>>(row: T, numericKeys: string[]): T {
  const out = { ...row };
  for (const key of numericKeys) {
    if (key in out && (typeof out[key] === 'string' || typeof out[key] === 'number')) {
      (out as Record<string, unknown>)[key] = Number((out as Record<string, unknown>)[key]);
    }
  }
  return out;
}

export const NUMERIC_KEYS: Record<string, string[]> = {
  empresas: ['id'],
  departamentos: ['id'],
  colaboradores: ['id', 'empresaId', 'salarioBase'],
  centros_custo: ['id', 'empresaId', 'orcamentoMensal', 'orcamentoAnual', 'gastoActual'],
  projectos: ['id', 'empresaId', 'orcamentoTotal', 'gasto'],
  reunioes: ['id'],
  actas: ['id', 'reuniaoId'],
  contratos: ['id', 'empresaId', 'valor', 'alertarAntesDias'],
  requisicoes: ['id', 'empresaId', 'quantidade', 'valorUnitario', 'valor', 'requisitanteColaboradorId'],
  pagamentos: ['id', 'requisicaoId', 'valor'],
  movimentos_tesouraria: ['id', 'empresaId', 'valor', 'centroCustoId', 'projectoId', 'requisicaoId'],
  ferias: ['id', 'colaboradorId', 'dias'],
  faltas: ['id', 'colaboradorId'],
  recibos_salario: ['id', 'colaboradorId', 'vencimentoBase', 'subsidioAlimentacao', 'subsidioTransporte', 'outrosSubsidios', 'inss', 'irt', 'outrasDeducoes', 'liquido'],
  declaracoes: ['id', 'colaboradorId'],
  processos_judiciais: ['id', 'empresaId', 'valorEmCausa'],
  prazos_legais: ['id', 'empresaId'],
  riscos_juridicos: ['id', 'empresaId'],
  processos_disciplinares: ['id', 'empresaId', 'colaboradorId'],
  rescisoes_contrato: ['id', 'contratoId', 'empresaId'],
  correspondencias: ['id'],
  documentos_oficiais: ['id', 'empresaId', 'colaboradorId'],
  pendencias_documentais: ['id', 'entidadeId'],
  relatorios_planeamento: ['id', 'empresaId', 'ebitda', 'margemBruta', 'margemEbitda'],
  notificacoes: ['destinatarioColaboradorId', 'empresaId'],
  noticias: ['id', 'empresaId'],
  eventos: ['id', 'empresaId', 'alertarAntesHoras'],
  noticias_comentarios: ['id', 'empresaId', 'noticiaId', 'autorColaboradorId', 'autorPerfilId', 'parentComentarioId'],
  noticias_gostos: ['id', 'empresaId', 'noticiaId', 'autorPerfilId', 'colaboradorId'],
};

export function mapRowFromDb<T>(tableName: keyof typeof NUMERIC_KEYS, row: Record<string, unknown>): T {
  const camel = toCamel<Record<string, unknown>>(row);
  const keys = NUMERIC_KEYS[tableName];
  if (keys) return ensureNumbers(camel, keys) as T;
  return camel as T;
}

export function mapRowsFromDb<T>(tableName: keyof typeof NUMERIC_KEYS, rows: Record<string, unknown>[]): T[] {
  return rows.map(r => mapRowFromDb<T>(tableName, r));
}

/** Para insert: converte objeto app (camelCase) para row DB (snake_case). Omite id (auto-gerado). */
export function mapToDb<T extends Record<string, unknown>>(obj: T, omitId = true): Record<string, unknown> {
  const snake = toSnake(obj);
  if (omitId) delete snake.id;
  delete snake.created_at;
  delete snake.updated_at;
  return snake;
}
