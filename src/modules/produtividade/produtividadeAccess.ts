import type { Usuario } from '@/types';

/** Substrings de cargo que indicam responsável de área (Direcção). */
export const PRODUTIVIDADE_DIRECCAO_CARGO_NEEDLES = [
  'director',
  'diretor',
  'coordenador',
  'responsável',
  'responsavel',
  'chefe',
] as const;

export function cargoIndicaDireccaoProdutividade(cargo: string | null | undefined): boolean {
  const c = (cargo ?? '').toLowerCase();
  return PRODUTIVIDADE_DIRECCAO_CARGO_NEEDLES.some(needle => c.includes(needle));
}

export function usuarioTemCargoDireccaoProdutividade(
  user: Pick<Usuario, 'colaboradorId' | 'cargo'> | null | undefined,
  colaboradores?: ReadonlyArray<{ id: number; cargo?: string | null }>,
): boolean {
  if (!user) return false;
  if (cargoIndicaDireccaoProdutividade(user.cargo)) return true;
  if (user.colaboradorId != null && colaboradores?.length) {
    const col = colaboradores.find(c => c.id === user.colaboradorId);
    if (col && cargoIndicaDireccaoProdutividade(col.cargo)) return true;
  }
  return false;
}

/** Admin, PCA ou Director (perfil) — visão de todas as actividades da empresa no ecrã Direcção. */
export function podeVerTodasActividadesProdutividadeEmpresa(
  user: Pick<Usuario, 'perfil'> | null | undefined,
): boolean {
  const p = user?.perfil;
  return p === 'Admin' || p === 'PCA' || p === 'Director';
}

export function podeAcederDireccaoProdutividade(
  user: Pick<Usuario, 'perfil' | 'colaboradorId' | 'cargo'> | null | undefined,
  colaboradores?: ReadonlyArray<{ id: number; cargo?: string | null }>,
): boolean {
  if (!user) return false;
  if (podeVerTodasActividadesProdutividadeEmpresa(user)) return true;
  return usuarioTemCargoDireccaoProdutividade(user, colaboradores);
}
