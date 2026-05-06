/**
 * Resolve VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para o browser.
 * Em produção rejeita loopback (evita build de cloud a apontar para máquina local).
 * HTTP só em produção se VITE_SUPABASE_ALLOW_HTTP=1 (ex.: Supabase self-hosted em Docker na LAN).
 */

const LOOPBACK = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

function isForbiddenLoopback(hostname: string): boolean {
  return LOOPBACK.has(hostname);
}

function allowHttpInProd(): boolean {
  const v = import.meta.env.VITE_SUPABASE_ALLOW_HTTP as string | undefined;
  return v === '1' || v === 'true';
}

export interface ResolvedSupabaseBrowserEnv {
  url: string;
  anonKey: string;
}

export function resolveSupabaseBrowserEnv(): ResolvedSupabaseBrowserEnv | null {
  const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!rawUrl || !rawKey) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.replace(/\/+$/, ''));
  } catch {
    if (import.meta.env.DEV) console.warn('[supabase] VITE_SUPABASE_URL inválido (URL malformada).');
    return null;
  }

  const prod = import.meta.env.PROD;
  const hostname = parsed.hostname.toLowerCase();

  if (prod) {
    if (isForbiddenLoopback(hostname)) {
      console.error(
        '[Sanep Hub] Em produção VITE_SUPABASE_URL não pode usar localhost/127.0.0.1 (o browser dos utilizadores não alcança o teu PC). ' +
          'Use o URL público do Supabase (cloud ou host/DNS na rede) e faça rebuild da imagem.',
      );
      return null;
    }
    if (parsed.protocol !== 'https:' && !allowHttpInProd()) {
      console.error(
        '[Sanep Hub] Em produção use VITE_SUPABASE_URL com https://, ou defina VITE_SUPABASE_ALLOW_HTTP=1 para Supabase em HTTP na rede interna.',
      );
      return null;
    }
  }

  return {
    url: `${parsed.origin}`,
    anonKey: rawKey,
  };
}
