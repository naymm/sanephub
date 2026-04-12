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
export async function getSupabaseFunctionsInvokeErrorMessage(
  err: unknown,
  fallback: string,
): Promise<string> {
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
