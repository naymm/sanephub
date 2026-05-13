import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/** Registo de sessão no painel de auditoria (só com Supabase + utilizador autenticado). */
export function logIntranetAuditClientEvent(
  category: 'login' | 'logout' | 'sistema',
  opts?: { action?: string; summary?: string | null; details?: Record<string, unknown> },
): void {
  if (!isSupabaseConfigured() || !supabase) return;
  void supabase
    .rpc('intranet_audit_client_event', {
      p_category: category,
      p_action: opts?.action ?? 'session',
      p_summary: opts?.summary ?? null,
      p_details: (opts?.details ?? {}) as any,
    })
    .then(({ error }) => {
      if (error && import.meta.env.DEV) console.warn('[intranetAudit]', error.message);
    });
}
