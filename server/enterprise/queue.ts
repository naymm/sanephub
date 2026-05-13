import type Redis from 'ioredis';

const Q = 'sanephub:queue:jobs';

export type QueueJob = {
  type: string;
  payload: Record<string, unknown>;
  enqueuedAt: number;
};

export async function enqueueJob(redis: Redis | undefined, job: Omit<QueueJob, 'enqueuedAt'>): Promise<boolean> {
  if (!redis) return false;
  const full: QueueJob = { ...job, enqueuedAt: Date.now() };
  try {
    await redis.rpush(Q, JSON.stringify(full));
    return true;
  } catch {
    return false;
  }
}

/** BRPOP: bloqueia até haver trabalho (usar no worker). */
export async function blockingPopJob(
  redis: Redis,
  timeoutSeconds: number,
): Promise<QueueJob | null> {
  const res = await redis.brpop(Q, timeoutSeconds);
  if (!res) return null;
  const [, raw] = res;
  try {
    return JSON.parse(raw) as QueueJob;
  } catch {
    return null;
  }
}
