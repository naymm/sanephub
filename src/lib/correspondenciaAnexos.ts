import type { SupabaseClient } from '@supabase/supabase-js';
import type { Correspondencia } from '@/types';

export const CORRESPONDENCIAS_ANEXOS_BUCKET = 'correspondencias-anexos';

const ALLOWED_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp']);

export const CORRESPONDENCIAS_ANEXOS_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,application/pdf,image/*';

function extensaoDeNome(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : '';
}

function sanitizeFileName(nome: string): string {
  return nome.replace(/[^\w.\-() ]+/g, '_').slice(0, 120);
}

export function validateCorrespondenciaAnexoFile(file: File): string | null {
  const ext = extensaoDeNome(file.name);
  if (!ALLOWED_EXT.has(ext)) {
    return 'Formato não permitido. Use PDF, Word, Excel ou imagem.';
  }
  if (file.size > 25 * 1024 * 1024) return 'O ficheiro não pode exceder 25 MB.';
  return null;
}

export type CorrespondenciaAnexoCampo = 'documento' | 'protocolo';

export async function uploadCorrespondenciaAnexo(
  supabase: SupabaseClient,
  correspondenciaId: number,
  campo: CorrespondenciaAnexoCampo,
  file: File,
): Promise<Pick<Correspondencia, 'documentoStoragePath' | 'documentoNomeFicheiro' | 'protocoloStoragePath' | 'protocoloNomeFicheiro'>> {
  const err = validateCorrespondenciaAnexoFile(file);
  if (err) throw new Error(err);

  const safe = sanitizeFileName(file.name);
  const storagePath = `corr-${correspondenciaId}/${campo}-${Date.now()}-${safe}`;

  const { error: upErr } = await supabase.storage
    .from(CORRESPONDENCIAS_ANEXOS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
  if (upErr) throw new Error(upErr.message || 'Falha ao carregar o ficheiro.');

  if (campo === 'documento') {
    return { documentoStoragePath: storagePath, documentoNomeFicheiro: file.name };
  }
  return { protocoloStoragePath: storagePath, protocoloNomeFicheiro: file.name };
}

export function correspondenciaAnexoPublicUrl(
  supabase: SupabaseClient,
  storagePath: string | null | undefined,
): string | null {
  if (!storagePath?.trim()) return null;
  const { data } = supabase.storage.from(CORRESPONDENCIAS_ANEXOS_BUCKET).getPublicUrl(storagePath.trim());
  return data?.publicUrl ?? null;
}
