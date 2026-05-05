/**
 * Resolve VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para o browser.
 * Em produção rejeita URLs locais / porta API local e HTTP (evita mixed content no Vercel).
 */

const LOOPBACK = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

function isLocalSupabaseApiUrl(hostname: string, port: string): boolean {
  if (LOOPBACK.has(hostname)) return true;
  if (port === '54321') return true;
  return false;
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
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : parsed.protocol === 'http:' ? '80' : '');

  if (prod) {
    if (isLocalSupabaseApiUrl(hostname, port)) {
      console.error(
        '[Sanep Hub] Em produção VITE_SUPABASE_URL não pode apontar para localhost nem para a API local (porta 54321). ' +
          'No Vercel, defina o URL HTTPS do projecto (ex.: https://xxxx.supabase.co) em Environment Variables e faça um novo deploy.',
      );
      return null;
    }
    if (parsed.protocol !== 'https:') {
      console.error(
        '[Sanep Hub] Em produção use VITE_SUPABASE_URL com https:// (evita mixed content no browser).',
      );
      return null;
    }
  }

  return {
    url: `${parsed.origin}`,
    anonKey: rawKey,
  };
}
