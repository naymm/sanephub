import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'gestao-documentos';

const ALLOWED_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx']);

function extensaoDeNome(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : '';
}

function sanitizeFileName(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
}

/** Primeiro + último nome em maiúsculas (pt), p.ex. «Maria Santos Silva» → «MARIA SILVA». */
export function nomePastaColaboradorMaiusculo(nomeCompleto: string): string {
  const parts = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'COLABORADOR';
  if (parts.length === 1) return parts[0].toLocaleUpperCase('pt-PT');
  return `${parts[0]} ${parts[parts.length - 1]}`.toLocaleUpperCase('pt-PT');
}

function tituloSugeridoDeNomeArquivo(nome: string): string {
  const i = nome.lastIndexOf('.');
  const base = i >= 0 ? nome.slice(0, i) : nome;
  const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.toLocaleUpperCase('pt-PT');
}

type PastaRow = {
  id: number;
  empresa_id: number;
  parent_id: number | null;
  nome: string;
};

function normNomePasta(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ');
}

function nomeRaizCapitalHumanoKey(nome: string): 'ch' | 'rh' | null {
  const k = normNomePasta(nome).toLocaleUpperCase('pt-PT');
  if (k === 'CAPITAL HUMANO') return 'ch';
  if (k === 'RH') return 'rh';
  return null;
}

/**
 * Localiza apenas pastas já existentes: raiz «Capital Humano» ou legado «RH», depois «Colaboradores».
 * Não cria nem renomeia pastas — a árvore deve existir (seed / Gestão documental).
 */
async function resolverPastaColaboradoresExistente(
  supabase: SupabaseClient,
  empresaId: number,
): Promise<{ colaboradoresPastaId: number } | { error: string }> {
  const { data: rows, error } = await supabase
    .from('gestao_documentos_pastas')
    .select('id, empresa_id, parent_id, nome')
    .eq('empresa_id', empresaId);

  if (error) return { error: error.message };
  const pastas = (rows ?? []) as PastaRow[];

  const roots = pastas.filter((p) => p.parent_id == null);
  const chRoot =
    roots.find((p) => nomeRaizCapitalHumanoKey(p.nome) === 'ch') ??
    roots.find((p) => nomeRaizCapitalHumanoKey(p.nome) === 'rh');

  if (!chRoot) {
    return {
      error:
        'Não existe pasta raiz «Capital Humano» nem «RH» na Gestão documental desta empresa. Crie a estrutura em Gestão documental (sem criar pastas automaticamente aqui).',
    };
  }

  const colabParent = pastas.find(
    (p) =>
      p.parent_id === chRoot.id &&
      normNomePasta(p.nome).toLocaleUpperCase('pt-PT') === 'COLABORADORES',
  );
  if (!colabParent) {
    return {
      error:
        'Não existe a subpasta «Colaboradores» dentro de «Capital Humano» / «RH». Crie-a em Gestão documental.',
    };
  }

  return { colaboradoresPastaId: Number(colabParent.id) };
}

/**
 * Cria pasta do colaborador sob «…/ Colaboradores». Em conflito de nome, sufixo com id.
 */
export async function criarPastaColaboradorNaGestao(
  supabase: SupabaseClient,
  empresaId: number,
  colaboradorId: number,
  nomeCompleto: string,
): Promise<{ pastaId: number } | { error: string }> {
  const base = nomePastaColaboradorMaiusculo(nomeCompleto);
  const ensured = await resolverPastaColaboradoresExistente(supabase, empresaId);
  if ('error' in ensured) return ensured;

  const tryInsert = async (nomePasta: string) => {
    const { data, error } = await supabase
      .from('gestao_documentos_pastas')
      .insert({
        empresa_id: empresaId,
        parent_id: ensured.colaboradoresPastaId,
        nome: nomePasta,
        ordem: 99,
      })
      .select('id')
      .single();
    return { data, error };
  };

  let { data, error } = await tryInsert(base);
  if (error?.code === '23505' || /unique|duplicate/i.test(error?.message ?? '')) {
    const alt = `${base} (${colaboradorId})`;
    ({ data, error } = await tryInsert(alt));
  }
  if (error) return { error: error.message };
  const rawId = (data as { id: number | string }).id;
  const pastaId = typeof rawId === 'string' ? Number(rawId) : rawId;
  if (!Number.isFinite(pastaId)) return { error: 'Resposta inválida ao criar pasta.' };
  return { pastaId };
}

export async function uploadDocumentosColaboradorParaPasta(
  supabase: SupabaseClient,
  empresaId: number,
  profileId: number,
  pastaId: number,
  files: File[],
): Promise<{ ok: number; errors: string[] }> {
  const errors: string[] = [];
  let ok = 0;

  for (const f of files) {
    const ext = extensaoDeNome(f.name);
    if (!ALLOWED_EXT.has(ext)) {
      errors.push(`${f.name}: formato não permitido (use PDF, Word ou Excel).`);
      continue;
    }
    try {
      const safe = sanitizeFileName(f.name);
      const objectPath = `${crypto.randomUUID()}_${safe}`;
      const fullPath = `${empresaId}/${objectPath}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(fullPath, f, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;

      const tituloDoc = tituloSugeridoDeNomeArquivo(f.name);
      const { data: ins, error: insErr } = await supabase
        .from('gestao_documentos_arquivos')
        .insert({
          empresa_id: empresaId,
          pasta_id: pastaId,
          titulo: tituloDoc,
          observacao: 'Documento anexado no cadastro do colaborador.',
          storage_path: fullPath,
          nome_ficheiro: f.name,
          mime_type: f.type || 'application/octet-stream',
          tamanho_bytes: f.size,
          tipo_ficheiro: ext,
          modulos_acesso: ['capital-humano'],
          sectores_acesso: [],
          origem_modulo: 'capital-humano',
          uploaded_by: profileId,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      const newId = (ins as { id: number }).id;
      await supabase.from('gestao_documentos_auditoria').insert({
        arquivo_id: newId,
        profile_id: profileId,
        accao: 'upload',
        detalhe: { nome: f.name, titulo: tituloDoc, origem: 'cadastro_colaborador' },
      });
      ok++;
    } catch (e) {
      errors.push(`${f.name}: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  return { ok, errors };
}
