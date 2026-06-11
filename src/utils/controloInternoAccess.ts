import type { Perfil, Usuario } from '@/types';

export function perfilLabelControloInterno(perfil: Perfil | string): string {
  return perfil === 'ControloInterno' ? 'Controlo Interno' : perfil;
}

/**
 * Acesso ao módulo Controlo Interno (menu e rotas):
 * Admin, perfil ControloInterno, ou checkbox «Controlo Interno» em Acesso a módulos.
 */
export function canAccessControloInternoModule(user: Usuario | null | undefined): boolean {
  if (!user) return false;
  if (user.perfil === 'Admin' || user.perfil === 'ControloInterno') return true;
  return Array.isArray(user.modulos) && user.modulos.includes('controlo-interno');
}

/** Criar, editar e eliminar registos de Controlo Interno. */
export function canManageControloInternoRecords(user: Usuario | null | undefined): boolean {
  if (!user) return false;
  return (
    user.perfil === 'Admin' ||
    user.perfil === 'ControloInterno' ||
    user.perfil === 'PCA' ||
    user.perfil === 'Director'
  );
}
