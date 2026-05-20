import type { SupabaseClient } from '@supabase/supabase-js';
import { mapRowFromDb, mapRowsFromDb, mapToDb } from '@/lib/supabaseMappers';
import type { TutorialVideo } from '@/types';
import { detectVideoProvedorFromUrl, parseVideoEmbedInput } from '@/utils/videoEmbed';

export async function fetchTutoriaisVideos(
  supabase: SupabaseClient,
  opts?: { includeUnpublished?: boolean },
): Promise<TutorialVideo[]> {
  let q = supabase.from('tutoriais_videos').select('*').order('ordem', { ascending: false }).order('id', { ascending: false });
  if (!opts?.includeUnpublished) {
    q = q.eq('publicado', true);
  }
  const { data, error } = await q;
  if (error) throw error;
  return mapRowsFromDb<TutorialVideo>('tutoriais_videos', (data ?? []) as Record<string, unknown>[]);
}

export async function insertTutorialVideo(
  supabase: SupabaseClient,
  payload: Omit<TutorialVideo, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<TutorialVideo> {
  const parsed = parseVideoEmbedInput(payload.videoUrl, payload.videoProvedor);
  if (!parsed) throw new Error('URL de vídeo inválida. Use um link YouTube, Vimeo ou URL directa (MP4).');

  const row = mapToDb({
    ...payload,
    videoProvedor: parsed.provedor,
    videoUrl: payload.videoUrl.trim(),
    updatedAt: new Date().toISOString(),
  });

  const { data, error } = await supabase.from('tutoriais_videos').insert(row).select('*').single();
  if (error) throw error;
  return mapRowFromDb<TutorialVideo>('tutoriais_videos', data as Record<string, unknown>);
}

export async function updateTutorialVideo(
  supabase: SupabaseClient,
  id: number,
  payload: Partial<Omit<TutorialVideo, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<TutorialVideo> {
  const patch = { ...payload, updatedAt: new Date().toISOString() };
  if (payload.videoUrl != null) {
    const provedor = payload.videoProvedor ?? detectVideoProvedorFromUrl(payload.videoUrl);
    const parsed = parseVideoEmbedInput(payload.videoUrl, provedor);
    if (!parsed) throw new Error('URL de vídeo inválida.');
    patch.videoProvedor = parsed.provedor;
    patch.videoUrl = payload.videoUrl.trim();
  }
  const row = mapToDb(patch);
  const { data, error } = await supabase.from('tutoriais_videos').update(row).eq('id', id).select('*').single();
  if (error) throw error;
  return mapRowFromDb<TutorialVideo>('tutoriais_videos', data as Record<string, unknown>);
}

export async function deleteTutorialVideo(supabase: SupabaseClient, id: number): Promise<void> {
  const { error } = await supabase.from('tutoriais_videos').delete().eq('id', id);
  if (error) throw error;
}
