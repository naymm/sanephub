import type Redis from 'ioredis';
import { deleteKeysByPrefix } from './scan-delete';

/**
 * Cache-aside: lê Redis; em miss executa loader, grava TTL e devolve.
 * Falhas de Redis não bloqueiam: faz fallback ao loader.
 */
export async function getOrSetJson<T>(
  redis: Redis | undefined,
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  if (!redis) return loader();
  try {
    const raw = await redis.get(key);
    if (raw != null) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        await redis.del(key).catch(() => {});
      }
    }
  } catch {
    return loader();
  }

  const value = await loader();
  try {
    await redis.setex(key, Math.max(1, ttlSeconds), JSON.stringify(value));
  } catch {
    /* ignore */
  }
  return value;
}

/** Invalidação por chaves exactas. */
export async function invalidateKeys(redis: Redis | undefined, keys: string[]): Promise<number> {
  if (!redis || keys.length === 0) return 0;
  try {
    return await redis.del(...keys);
  } catch {
    return 0;
  }
}

/** Invalidação por prefixo (SCAN + DEL; usar com prefixos curtos). */
export async function invalidatePrefix(redis: Redis | undefined, prefix: string): Promise<number> {
  if (!redis) return 0;
  return deleteKeysByPrefix(redis, prefix);
}
