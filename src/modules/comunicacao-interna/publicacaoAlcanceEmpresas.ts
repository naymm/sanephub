import type { Empresa, Usuario } from '@/types';

export type AlcancePublicacaoModo = 'empresa_actual' | 'uma_empresa' | 'empresas_escolhidas' | 'todas_empresas';

/** Admin ou PCA ao nível Grupo (sem `empresaId` no perfil) podem publicar em várias empresas. */
export function podePublicarEmMultiplasEmpresas(user: Usuario | null | undefined): boolean {
  if (!user) return false;
  if (user.perfil === 'Admin') return true;
  if (user.perfil === 'PCA' && (user.empresaId == null || user.empresaId === undefined)) return true;
  return false;
}

export function empresaIdsActivos(empresas: Empresa[]): number[] {
  return empresas
    .filter(e => e.activo)
    .map(e => e.id)
    .sort((a, b) => a - b);
}

export function resolveEmpresaIdsParaPublicacao(input: {
  podeMulti: boolean;
  modo: AlcancePublicacaoModo;
  empresaIdContexto: number | null;
  umaEmpresaId: number | null;
  empresasEscolhidas: number[];
  todasEmpresasActivasIds: number[];
}): { ok: true; ids: number[] } | { ok: false; message: string } {
  if (!input.podeMulti) {
    if (input.empresaIdContexto == null) {
      return { ok: false, message: 'Seleccione uma empresa no selector (topo) para publicar.' };
    }
    return { ok: true, ids: [input.empresaIdContexto] };
  }

  switch (input.modo) {
    case 'empresa_actual': {
      if (input.empresaIdContexto == null) {
        return {
          ok: false,
          message: 'Para «empresa actual», seleccione uma empresa no selector ou escolha outra opção de alcance.',
        };
      }
      return { ok: true, ids: [input.empresaIdContexto] };
    }
    case 'uma_empresa': {
      if (input.umaEmpresaId == null) {
        return { ok: false, message: 'Seleccione a empresa onde pretende publicar.' };
      }
      return { ok: true, ids: [input.umaEmpresaId] };
    }
    case 'empresas_escolhidas': {
      const uniq = [...new Set(input.empresasEscolhidas)].filter(id => input.todasEmpresasActivasIds.includes(id));
      if (!uniq.length) {
        return { ok: false, message: 'Seleccione pelo menos uma empresa na lista.' };
      }
      return { ok: true, ids: uniq.sort((a, b) => a - b) };
    }
    case 'todas_empresas': {
      if (!input.todasEmpresasActivasIds.length) {
        return { ok: false, message: 'Não há empresas activas para publicar.' };
      }
      return { ok: true, ids: [...input.todasEmpresasActivasIds] };
    }
    default:
      return { ok: false, message: 'Alcance inválido.' };
  }
}
