import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { resolveSupabaseBrowserEnv } from '@/lib/resolveSupabaseBrowserEnv';

const resolved = resolveSupabaseBrowserEnv();

/**
 * URL HTTPS do projecto usada no bundle (normalizada). Útil para reescrever URLs de Storage
 * em `publicMediaUrl` / PDFs com a mesma lógica que o cliente Supabase.
 */
export const supabaseBrowserUrl = resolved?.url ?? '';

/** Cliente Supabase. Só está disponível quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são válidos. */
export const supabase = resolved ? createClient<Database>(resolved.url, resolved.anonKey) : null;

export const isSupabaseConfigured = (): boolean => !!supabase;
