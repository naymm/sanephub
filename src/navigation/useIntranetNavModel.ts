import { useMemo } from 'react';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { getModulosAtivosForContext, empresaTemFacturacaoActiva, empresaTemModuloActivado } from '@/utils/empresaModulos';
import { orgModuloEstaActivado, rotaBloqueadaPorRecursosDesactivados } from '@/utils/orgFeatureAccess';
import {
  GENERAL_ITEMS,
  MODULE_GROUPS,
  PORTAL_ITEMS,
  type MenuChild,
  type MenuGroup,
} from '@/navigation/intranetNavConfig';

export type IntranetNavModel = {
  topItems: MenuChild[];
  portalNavItems: MenuChild[];
  groups: MenuGroup[];
  isColaborador: boolean;
  hasPortalColaborador: boolean;
  hasAnyNonPortalModule: boolean;
  canShowModule: (moduleId?: string) => boolean;
  canShowChild: (child: MenuChild) => boolean;
  /** Links extra no modo «flat» (Colaborador com portal + outros módulos). */
  flatMixedLinks: MenuChild[];
};

/**
 * Filtros e listas do menu intranet (barra horizontal + drawer mobile).
 * Mantém a mesma lógica de permissões que o menu horizontal original.
 */
export function useIntranetNavModel(): IntranetNavModel | null {
  const { user } = useAuth();
  const { empresas, organizacaoSettings } = useData();
  const { currentEmpresaId } = useTenant();

  return useMemo(() => {
    if (!user) return null;

    const modulosAtivos = getModulosAtivosForContext(currentEmpresaId, empresas);
    const facturacaoActiva = empresaTemFacturacaoActiva(currentEmpresaId, empresas);

    const canShowModule = (moduleId?: string) => {
      if (!moduleId) return true;
      if (moduleId === 'facturacao' && !facturacaoActiva) return false;
      if (!orgModuloEstaActivado(organizacaoSettings, moduleId)) return false;
      if (user.perfil === 'Colaborador' && moduleId === 'dashboard') return true;
      if (user.perfil === 'Colaborador' && moduleId === 'comunicacao-interna') return true;
      if (!hasModuleAccess(user, moduleId)) return false;
      if (user.perfil === 'Colaborador') return true;
      if (modulosAtivos == null) return true;
      return empresaTemModuloActivado(modulosAtivos, moduleId);
    };

    const isColaborador = user.perfil === 'Colaborador';
    const hasPortalColaborador =
      isColaborador && Array.isArray(user.modulos) && user.modulos.includes('portal-colaborador');
    const hasAnyNonPortalModule =
      hasPortalColaborador && Array.isArray(user.modulos) && user.modulos.some(m => m !== 'portal-colaborador');

    const canShowChild = (child: MenuChild) => {
      if (child.adminOnly && user.perfil !== 'Admin') return false;
      if (rotaBloqueadaPorRecursosDesactivados(child.path, organizacaoSettings.recursosDesactivados))
        return false;
      if (!child.module) return true;
      return canShowModule(child.module);
    };

    const topItems = GENERAL_ITEMS.filter(i => canShowModule(i.module));
    const portalItems = PORTAL_ITEMS.filter(
      i =>
        canShowModule(i.module) &&
        !rotaBloqueadaPorRecursosDesactivados(i.path, organizacaoSettings.recursosDesactivados),
    );
    const portalNavItems = isColaborador ? [] : portalItems;
    const groups = MODULE_GROUPS.filter(g => canShowModule(g.module))
      .map(g => ({ ...g, children: g.children.filter(canShowChild) }))
      .filter(g => g.children.length > 0);

    const flatMixedLinks: MenuChild[] = [];
    if (hasPortalColaborador && hasAnyNonPortalModule) {
      for (const g of MODULE_GROUPS) {
        const shouldShowComunicacao =
          isColaborador && hasPortalColaborador && g.module === 'comunicacao-interna';
        const allowed = shouldShowComunicacao || canShowModule(g.module);
        if (allowed) {
          for (const child of g.children.filter(canShowChild)) {
            flatMixedLinks.push(child);
          }
        }
      }
    }

    return {
      topItems,
      portalNavItems,
      groups,
      isColaborador,
      hasPortalColaborador,
      hasAnyNonPortalModule,
      canShowModule,
      canShowChild,
      flatMixedLinks,
    };
  }, [user, empresas, organizacaoSettings, currentEmpresaId]);
}
