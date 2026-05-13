import type Redis from 'ioredis';

/**
 * Apaga chaves que coincidem com `prefix*`. Limite de iterações evita loops infinitos.
 */
export async function deleteKeysByPrefix(
  redis: Redis,
  prefix: string,
  maxIterations = 5000,
): Promise<number> {
  let cursor = '0';
  let total = 0;
  let iterations = 0;
  const match = `${prefix}*`;

  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 200);
    if (keys.length > 0) {
      total += await redis.del(...keys);
    }
    cursor = next;
    iterations++;
    if (iterations > maxIterations) break;
  } while (cursor !== '0');

  return total;
}
