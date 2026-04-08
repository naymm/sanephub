import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'gestao-documentos';

const ALLOWED_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg']);

function extensaoDeNome(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : '';
}

function sanitizeFileName(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
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

/**
 * Localiza «Jurídico» → «Contratos» na gestão documental da empresa (estrutura criada na migração).
 */
async function resolverPastaContratosParent(
  supabase: SupabaseClient,
  empresaId: number,
): Promise<{ contratosPastaId: number } | { error: string }> {
  const { data: rows, error } = await supabase
    .from('gestao_documentos_pastas')
    .select('id, empresa_id, parent_id, nome')
    .eq('empresa_id', empresaId);

  if (error) return { error: error.message };
  const pastas = (rows ?? []) as PastaRow[];

  const roots = pastas.filter(p => p.parent_id == null);
  const jurRoot = roots.find(
    p => normNomePasta(p.nome).toLocaleUpperCase('pt-PT') === 'JURÍDICO',
  );
  if (!jurRoot) {
    return {
      error:
        'Não existe a pasta raiz «Jurídico» na Gestão documental desta empresa. Crie-a ou execute as migrações iniciais.',
    };
  }

  const contratos = pastas.find(
    p =>
      p.parent_id === jurRoot.id &&
      normNomePasta(p.nome).toLocaleUpperCase('pt-PT') === 'CONTRATOS',
  );
  if (!contratos) {
    return {
      error:
        'Não existe a subpasta «Contratos» dentro de «Jurídico». Crie-a em Gestão documental.',
    };
  }

  return { contratosPastaId: Number(contratos.id) };
}

/**
 * Garante pasta com o nome do número do contrato (ex. CONT-2026-000001) sob Jurídico/Contratos.
 */
export async function garantirPastaNumeroContratoNaGestao(
  supabase: SupabaseClient,
  empresaId: number,
  numeroContrato: string,
): Promise<{ pastaId: number } | { error: string }> {
  const parent = await resolverPastaContratosParent(supabase, empresaId);
  if ('error' in parent) return parent;

  const nomePasta = numeroContrato.trim();
  if (!nomePasta) return { error: 'Número de contrato vazio.' };

  const { data: existing, error: qErr } = await supabase
    .from('gestao_documentos_pastas')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('parent_id', parent.contratosPastaId)
    .eq('nome', nomePasta)
    .maybeSingle();

  if (qErr) return { error: qErr.message };
  if (existing?.id != null) {
    return { pastaId: Number((existing as { id: number }).id) };
  }

  const { data: ins, error: insErr } = await supabase
    .from('gestao_documentos_pastas')
    .insert({
      empresa_id: empresaId,
      parent_id: parent.contratosPastaId,
      nome: nomePasta,
      ordem: 99,
      modulos_acesso: ['juridico'],
      sectores_acesso: [],
    })
    .select('id')
    .single();

  if (insErr) return { error: insErr.message };
  const id = Number((ins as { id: number }).id);
  if (!Number.isFinite(id)) return { error: 'Resposta inválida ao criar pasta do contrato.' };
  return { pastaId: id };
}

export async function uploadAnexosContratoParaGestao(
  supabase: SupabaseClient,
  empresaId: number,
  profileId: number,
  pastaId: number,
  files: File[],
  prefixoObservacao: string,
): Promise<{ ok: number; errors: string[] }> {
  const errors: string[] = [];
  let ok = 0;

  for (const f of files) {
    const ext = extensaoDeNome(f.name);
    if (!ALLOWED_EXT.has(ext)) {
      errors.push(`${f.name}: formato não permitido (PDF, Word, Excel ou imagem).`);
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
      const { data: row, error: insErr } = await supabase
        .from('gestao_documentos_arquivos')
        .insert({
          empresa_id: empresaId,
          pasta_id: pastaId,
          titulo: tituloDoc,
          observacao: `${prefixoObservacao} ${f.name}`.trim(),
          storage_path: fullPath,
          nome_ficheiro: f.name,
          mime_type: f.type || 'application/octet-stream',
          tamanho_bytes: f.size,
          tipo_ficheiro: ext,
          modulos_acesso: ['juridico'],
          sectores_acesso: [],
          origem_modulo: 'juridico',
          uploaded_by: profileId,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      const newId = (row as { id: number }).id;
      await supabase.from('gestao_documentos_auditoria').insert({
        arquivo_id: newId,
        profile_id: profileId,
        accao: 'upload',
        detalhe: { nome: f.name, titulo: tituloDoc, origem: 'novo_contrato' },
      });
      ok++;
    } catch (e) {
      errors.push(`${f.name}: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  return { ok, errors };
}
