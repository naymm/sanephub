import type { SupabaseClient } from '@supabase/supabase-js';

/** Resolve URL pública de um objecto no bucket (aceita URL antiga ou path). */
export async function resolveComprovativoPublicUrl(
  supabase: SupabaseClient,
  bucket: 'proformas' | 'comprovativos',
  value: string,
): Promise<string | null> {
  if (!value) return null;

  let objectPath = value;
  if (value.startsWith('http')) {
    const re = new RegExp(`storage\\/v1\\/object\\/public\\/${bucket}\\/(.+)$`);
    const m = value.match(re);
    if (m?.[1]) objectPath = m[1];
    else return value;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data?.publicUrl ?? null;
}

export function inferBucketFromStoragePublicUrl(value: string): 'proformas' | 'comprovativos' {
  const m = value.match(/storage\/v1\/object\/public\/([^/]+)\//);
  const b = m?.[1];
  if (b === 'comprovativos' || b === 'proformas') return b;
  return 'proformas';
}
