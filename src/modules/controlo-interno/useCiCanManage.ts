import { useAuth, hasModuleAccess } from '@/context/AuthContext';

/** Gestão (criar/editar) no CI: requer acesso ao módulo e perfil de direcção. */
export function useCiCanManage(): boolean {
  const { user } = useAuth();
  if (!user || !hasModuleAccess(user, 'controlo-interno')) return false;
  return user.perfil === 'Admin' || user.perfil === 'PCA' || user.perfil === 'Director';
}
