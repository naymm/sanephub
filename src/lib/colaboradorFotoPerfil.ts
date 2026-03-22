import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'colaboradores-fotos';

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

function extensaoSegura(nome: string): string {
  const i = nome.lastIndexOf('.');
  const ext = i >= 0 ? nome.slice(i + 1).toLowerCase() : '';
  return ALLOWED_EXT.has(ext) ? ext : 'jpg';
}

/** Carrega imagem para o bucket público; path: {empresaId}/{colaboradorId}/{uuid}.ext */
export async function uploadColaboradorFotoPerfil(
  supabase: SupabaseClient,
  empresaId: number,
  colaboradorId: number,
  file: File,
): Promise<string> {
  const ext = extensaoSegura(file.name);
  const path = `${empresaId}/${colaboradorId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
