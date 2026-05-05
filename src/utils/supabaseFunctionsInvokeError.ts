const GENERIC_INVOKE_MSG = 'Edge Function returned a non-2xx status code';

type ErrorBody = {
  error?: unknown;
  message?: unknown;
};

function pickString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

/**
 * Com `functions.invoke`, respostas non-2xx expõem muitas vezes só a mensagem genérica em inglês;
 * o detalhe útil costuma estar no JSON do body (`error.context` como Response).
 */
function fetchFailureDetail(err: unknown): string | null {
  const e = err as { name?: string; cause?: unknown; message?: string };
  if (e?.name !== 'FunctionsFetchError' && !String(e?.message || '').includes('Failed to send a request')) {
    return null;
  }
  const c = e?.cause;
  if (c instanceof Error && c.message) return withContext(c.message);
  if (typeof c === 'object' && c !== null && 'message' in c && typeof (c as { message: unknown }).message === 'string') {
    return withContext((c as { message: string }).message);
  }
  return withContext(
    'Falha de rede ao contactar a Edge Function (ver rede, CORS, URL do projecto e se a função está deployada).',
  );
}

function cMessage(v: unknown): string {
  const t = typeof v === 'string' ? v.trim() : '';
  return t || 'Erro desconhecido';
}

function cWindowContext(): string {
  try {
    if (typeof window === 'undefined') return '';
    const origin = typeof window.location?.origin === 'string' ? window.location.origin : '';
    const online = typeof navigator !== 'undefined' && 'onLine' in navigator ? String((navigator as any).onLine) : '';
    const parts: string[] = [];
    if (origin) parts.push(`origin=${origin}`);
    if (online) parts.push(`online=${online}`);
    return parts.length ? ` (${parts.join(', ')})` : '';
  } catch {
    return '';
  }
}

function withContext(base: string): string {
  // Tentativa de dar pistas para produção: "blocked by client", "Failed to fetch", etc.
  // Mantém o texto curto (vai para UI).
  const msg = cMessage(base);
  return `${msg}${cWindowContext()}`;
}

export async function getSupabaseFunctionsInvokeErrorMessage(
  err: unknown,
  fallback: string,
): Promise<string> {
  const fromFetch = fetchFailureDetail(err);
  if (fromFetch) return fromFetch;

  const ctx = (err as { context?: unknown })?.context;
  if (ctx && typeof ctx === 'object' && ctx !== null && 'json' in ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = (await (ctx as Response).json()) as ErrorBody;
      const fromError = pickString(body.error);
      if (fromError) return fromError;
      const fromMessage = pickString(body.message);
      if (fromMessage) return fromMessage;
    } catch {
      /* body já consumido ou não-JSON */
    }
  }

  const base = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (base && base !== GENERIC_INVOKE_MSG) return base;
  return fallback;
}
