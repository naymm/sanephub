import type Redis from 'ioredis';
import { invalidateKeys, invalidatePrefix } from './cache-aside';
import { cacheKeys } from './cache-keys';

/**
 * Mapa lógico: após mutação de domínio, que prefixos/chaves invalidar.
 * Estender quando existir API Node que escreva no Postgres.
 */
export async function afterEmployeeMutation(
  redis: Redis | undefined,
  empresaId: number | string,
  employeeId?: number | string,
): Promise<void> {
  if (!redis) return;
  const tasks: Promise<unknown>[] = [
    invalidatePrefix(redis, `sanephub:users:list:v1:${empresaId}:`),
    invalidatePrefix(redis, `sanephub:dash:v1:${empresaId}`),
    invalidatePrefix(redis, `sanephub:stats:v1:${empresaId}:`),
    invalidatePrefix(redis, `sanephub:report:v1:`),
  ];
  if (employeeId != null) {
    tasks.push(invalidateKeys(redis, [cacheKeys.user(employeeId)]));
  }
  await Promise.all(tasks);
}

export async function afterDepartmentMutation(
  redis: Redis | undefined,
  empresaId: number | string,
): Promise<void> {
  if (!redis) return;
  await Promise.all([
    invalidateKeys(redis, [cacheKeys.departmentList(empresaId)]),
    invalidatePrefix(redis, `sanephub:dash:v1:${empresaId}`),
  ]);
}

export async function afterConfigMutation(redis: Redis | undefined, scope: string): Promise<void> {
  if (!redis) return;
  await invalidatePrefix(redis, `sanephub:cfg:v1:${scope}:`);
}
