import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { canManageControloInternoRecords } from '@/utils/controloInternoAccess';

/** Gestão (criar/editar) no CI: requer acesso ao módulo e perfil autorizado. */
export function useCiCanManage(): boolean {
  const { user } = useAuth();
  if (!user || !hasModuleAccess(user, 'controlo-interno')) return false;
  return canManageControloInternoRecords(user);
}
