import type Redis from 'ioredis';

const P = 'sanephub:presence:v1';

/**
 * Marca utilizador como online (TTL curto; renovar por heartbeat).
 */
export async function touchPresence(
  redis: Redis | undefined,
  userId: string,
  ttlSeconds = 90,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(`${P}:user:${userId}`, Math.max(10, ttlSeconds), Date.now().toString());
  } catch {
    /* ignore */
  }
}

export async function isUserOnline(redis: Redis | undefined, userId: string): Promise<boolean> {
  if (!redis) return false;
  try {
    const v = await redis.exists(`${P}:user:${userId}`);
    return v === 1;
  } catch {
    return false;
  }
}
