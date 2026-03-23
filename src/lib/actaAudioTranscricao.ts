import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'actas-audio';

const ALLOWED_EXT = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm', 'flac', 'opus']);

/** Aceita MIME audio/* ou extensão suportada (para drag-and-drop e validação no cliente). */
export function isActaAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  const i = file.name.lastIndexOf('.');
  const ext = i >= 0 ? file.name.slice(i + 1).toLowerCase() : '';
  return ALLOWED_EXT.has(ext);
}

function extensaoSegura(nome: string): string {
  const i = nome.lastIndexOf('.');
  const ext = i >= 0 ? nome.slice(i + 1).toLowerCase() : '';
  return ALLOWED_EXT.has(ext) ? ext : 'webm';
}

/** Upload de áudio para transcrição (n8n); path: {actaId}/{uuid}.ext — devolve URL pública. */
export async function uploadActaAudioTranscricao(
  supabase: SupabaseClient,
  actaId: number,
  file: File,
): Promise<string> {
  const ext = extensaoSegura(file.name);
  const path = `${actaId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || `audio/${ext === 'mp3' ? 'mpeg' : ext}`,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
