import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

const STORAGE_TENANT = 'sanep_tenant_empresa_id';

export type TenantValue = number | 'consolidado';

interface TenantContextType {
  /** Empresa em contexto: número = uma empresa; 'consolidado' = visão Grupo. */
  currentEmpresaId: TenantValue;
  setCurrentEmpresaId: (id: TenantValue) => void;
  /** true se pode alternar entre visão consolidada (Grupo) e cada empresa: sempre Admin; PCA só sem `empresaId` fixo na conta. */
  isGroupLevel: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentEmpresaId, setCurrentEmpresaIdState] = useState<TenantValue>(() => {
    const saved = localStorage.getItem(STORAGE_TENANT);
    if (saved === 'consolidado') return 'consolidado';
    const n = parseInt(saved ?? '', 10);
    return Number.isFinite(n) ? n : 'consolidado';
  });

  const isGroupLevel = !!(
    user &&
    (user.perfil === 'Admin' || (user.perfil === 'PCA' && user.empresaId == null))
  );

  useEffect(() => {
    if (!user) {
      setCurrentEmpresaIdState('consolidado');
      return;
    }
    /** Admin: contexto vem do `localStorage` (select Grupo / empresa), nunca preso a `user.empresaId`. */
    if (user.perfil === 'Admin') {
      const saved = localStorage.getItem(STORAGE_TENANT);
      if (saved === 'consolidado') setCurrentEmpresaIdState('consolidado');
      else {
        const n = parseInt(saved ?? '', 10);
        setCurrentEmpresaIdState(Number.isFinite(n) ? n : 'consolidado');
      }
      return;
    }
    if (user.empresaId != null) {
      setCurrentEmpresaIdState(user.empresaId);
      return;
    }
    const saved = localStorage.getItem(STORAGE_TENANT);
    if (saved === 'consolidado') setCurrentEmpresaIdState('consolidado');
    else {
      const n = parseInt(saved ?? '', 10);
      setCurrentEmpresaIdState(Number.isFinite(n) ? n : 'consolidado');
    }
  }, [user?.id, user?.empresaId, user?.perfil]);

  const setCurrentEmpresaId = (id: TenantValue) => {
    if (!isGroupLevel) return;
    setCurrentEmpresaIdState(id);
    localStorage.setItem(STORAGE_TENANT, id === 'consolidado' ? 'consolidado' : String(id));
  };

  return (
    <TenantContext.Provider value={{ currentEmpresaId, setCurrentEmpresaId, isGroupLevel }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
