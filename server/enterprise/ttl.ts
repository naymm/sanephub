/**
 * TTLs em segundos (cache-aside). Ajuste por domínio conforme frescura vs carga no Postgres.
 */
export const CacheTTL = {
  /** Dashboards agregados */
  dashboard: 5 * 60,
  /** Métricas / KPIs */
  metrics: 2 * 60,
  /** Listagens e detalhe de utilizadores / perfis */
  users: 30 * 60,
  /** Configurações da app / tenant */
  config: 24 * 60 * 60,
  /** Permissões e menus (invalidar em mudança de perfil) */
  permissions: 15 * 60,
  menus: 15 * 60,
  /** Estatísticas e relatórios pesados */
  stats: 5 * 60,
  reports: 10 * 60,
  /** Notificações recentes */
  notifications: 60,
  /** Departamentos, cooperados, listas de referência */
  departments: 30 * 60,
  cooperados: 30 * 60,
  /** Dados ERP genéricos (usar chaves específicas sempre que possível) */
  erpDefault: 5 * 60,
} as const;

export type CacheTTLKey = keyof typeof CacheTTL;
