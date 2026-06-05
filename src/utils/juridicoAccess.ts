import type { Usuario } from '@/types';

/** Acesso ao módulo Jurídico (menu e rotas): apenas Admin e perfil Jurídico. */
export function canAccessJuridicoModule(user: Usuario | null | undefined): boolean {
  if (!user) return false;
  return user.perfil === 'Admin' || user.perfil === 'Juridico';
}

/** Criar, editar e eliminar registos jurídicos (contratos, processos, prazos, etc.). */
export function canManageJuridicoRecords(user: Usuario | null | undefined): boolean {
  return canAccessJuridicoModule(user);
}
