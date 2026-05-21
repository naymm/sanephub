import type { SupabaseClient } from '@supabase/supabase-js';

export const CI_EVIDENCIAS_BUCKET = 'controlo-interno-evidencias';

const ALLOWED_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp']);

export const CI_EVIDENCIAS_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,application/pdf,image/*';

function extensao(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : '';
}

export function validateCiEvidenciaFile(file: File): string | null {
  if (!ALLOWED_EXT.has(extensao(file.name))) {
    return 'Formato não permitido. Use PDF, Word, Excel ou imagem.';
  }
  if (file.size > 25 * 1024 * 1024) return 'Ficheiro até 25 MB.';
  return null;
}

export async function uploadCiChecklistEvidencia(
  supabase: SupabaseClient,
  checklistItemId: number,
  file: File,
  profileId?: number | null,
): Promise<{ storagePath: string; nomeFicheiro: string; mimeType: string; tamanhoBytes: number }> {
  const err = validateCiEvidenciaFile(file);
  if (err) throw new Error(err);
  const safe = file.name.replace(/[^\w.\-() ]+/g, '_').slice(0, 120);
  const storagePath = `item-${checklistItemId}/${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage.from(CI_EVIDENCIAS_BUCKET).upload(storagePath, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  });
  if (upErr) throw new Error(upErr.message);
  const { data: row, error: insErr } = await supabase
    .from('ci_checklist_evidencias')
    .insert({
      checklist_item_id: checklistItemId,
      storage_path: storagePath,
      nome_ficheiro: file.name,
      mime_type: file.type || 'application/octet-stream',
      tamanho_bytes: file.size,
      uploaded_by_profile_id: profileId ?? null,
    })
    .select('id')
    .single();
  if (insErr) throw new Error(insErr.message);
  void row;
  return {
    storagePath,
    nomeFicheiro: file.name,
    mimeType: file.type || 'application/octet-stream',
    tamanhoBytes: file.size,
  };
}

export function ciEvidenciaPublicUrl(supabase: SupabaseClient, path: string): string | null {
  const { data } = supabase.storage.from(CI_EVIDENCIAS_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export type CiRelatorioFinalMeta = {
  relatorioFinalStoragePath: string;
  relatorioFinalNomeFicheiro: string;
  relatorioFinalMimeType: string;
  relatorioFinalTamanhoBytes: number;
};

export async function uploadCiAuditoriaRelatorioFinal(
  supabase: SupabaseClient,
  auditoriaId: number,
): Promise<(file: File) => Promise<CiRelatorioFinalMeta>> {
  return async (file: File) => {
    const err = validateCiEvidenciaFile(file);
    if (err) throw new Error(err);
    const safe = file.name.replace(/[^\w.\-() ]+/g, '_').slice(0, 120);
    const storagePath = `auditoria-${auditoriaId}/relatorio-final-${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from(CI_EVIDENCIAS_BUCKET).upload(storagePath, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
    if (upErr) throw new Error(upErr.message);
    return {
      relatorioFinalStoragePath: storagePath,
      relatorioFinalNomeFicheiro: file.name,
      relatorioFinalMimeType: file.type || 'application/octet-stream',
      relatorioFinalTamanhoBytes: file.size,
    };
  };
}

export function ciAuditoriaRelatorioFinalUrl(supabase: SupabaseClient, path: string | null | undefined): string | null {
  if (!path) return null;
  return ciEvidenciaPublicUrl(supabase, path);
}
