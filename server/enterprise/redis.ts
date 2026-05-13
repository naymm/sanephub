import Redis from 'ioredis';

let shared: Redis | undefined;

/**
 * Cliente Redis partilhado (lazy). Sem `REDIS_URL` devolve `undefined` (degraded mode).
 */
export function getOptionalRedis(): Redis | undefined {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return undefined;
  if (!shared) {
    shared = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    shared.on('error', err => {
      console.error('[redis]', err.message);
    });
  }
  return shared;
}

/** Fechar ligação (testes / shutdown gracioso). */
export async function closeRedis(): Promise<void> {
  if (shared) {
    await shared.quit().catch(() => {});
    shared = undefined;
  }
}
