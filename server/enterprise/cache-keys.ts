/**
 * Namespaces de chave Redis (evitar colisões; prefixo único por produto).
 */
const P = 'sanephub';

export const cacheKeys = {
  dashboard: (empresaId: number | string) => `${P}:dash:v1:${empresaId}`,
  metrics: (empresaId: number | string, slice: string) => `${P}:metrics:v1:${empresaId}:${slice}`,
  user: (id: number | string) => `${P}:user:v1:${id}`,
  userList: (empresaId: number | string, fingerprint: string) =>
    `${P}:users:list:v1:${empresaId}:${fingerprint}`,
  permissions: (profileId: number | string) => `${P}:perm:v1:${profileId}`,
  menus: (profileId: number | string, empresaId: number | string) =>
    `${P}:menu:v1:${profileId}:${empresaId}`,
  departmentList: (empresaId: number | string) => `${P}:dept:list:v1:${empresaId}`,
  notificationInbox: (userId: number | string, cursor: string) =>
    `${P}:notif:v1:${userId}:${cursor}`,
  report: (reportId: string, paramsHash: string) => `${P}:report:v1:${reportId}:${paramsHash}`,
  stats: (empresaId: number | string, kind: string) => `${P}:stats:v1:${empresaId}:${kind}`,
  config: (scope: string, key: string) => `${P}:cfg:v1:${scope}:${key}`,
  cooperadoList: (empresaId: number | string, fingerprint: string) =>
    `${P}:coop:list:v1:${empresaId}:${fingerprint}`,
} as const;
