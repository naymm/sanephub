import { useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';

/** Empresa activa para filtros CI (consolidado → primeira empresa do utilizador). */
export function useCiEmpresaId(): number | null {
  const { currentEmpresaId } = useTenant();
  const { user } = useAuth();
  const { colaboradoresTodos } = useData();
  return useMemo(() => {
    if (typeof currentEmpresaId === 'number') return currentEmpresaId;
    if (typeof user?.empresaId === 'number') return user.empresaId;
    if (user?.colaboradorId) {
      return colaboradoresTodos.find(c => c.id === user.colaboradorId)?.empresaId ?? null;
    }
    return null;
  }, [currentEmpresaId, user?.empresaId, user?.colaboradorId, colaboradoresTodos]);
}
