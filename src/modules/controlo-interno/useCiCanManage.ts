import { useAuth } from '@/context/AuthContext';

/** Admin, PCA ou Director — visão e gestão em todas as empresas do grupo. */
export function useCiCanManage(): boolean {
  const { user } = useAuth();
  return user?.perfil === 'Admin' || user?.perfil === 'PCA' || user?.perfil === 'Director';
}
