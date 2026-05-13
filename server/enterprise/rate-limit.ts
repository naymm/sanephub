import type Redis from 'ioredis';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * Janela fixa com INCR + EXPIRE na primeira ocorrência (rate limit distribuído).
 */
export async function consumeRateLimit(
  redis: Redis | undefined,
  bucket: string,
  identifier: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!redis) {
    return { allowed: true, remaining: max, retryAfterSec: 0 };
  }
  const key = `sanephub:rl:v1:${bucket}:${identifier}`;
  try {
    const n = await redis.incr(key);
    if (n === 1) {
      await redis.expire(key, Math.max(1, windowSeconds));
    }
    const ttl = n > max ? await redis.ttl(key) : 0;
    const allowed = n <= max;
    return {
      allowed,
      remaining: Math.max(0, max - n),
      retryAfterSec: allowed ? 0 : Math.max(1, ttl > 0 ? ttl : windowSeconds),
    };
  } catch {
    return { allowed: true, remaining: max, retryAfterSec: 0 };
  }
}

/** Presets alinhados com requisitos enterprise (ajustar por rota). */
export const RateLimitPresets = {
  login: { max: 5, windowSec: 60 },
  api: { max: 100, windowSec: 60 },
  chatMessage: { max: 30, windowSec: 60 },
  upload: { max: 10, windowSec: 60 },
  /** Novas ligações SSE por IP (gateway). */
  sseConnect: { max: 120, windowSec: 60 },
} as const;
