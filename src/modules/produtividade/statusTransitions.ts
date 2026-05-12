import type { ProdutividadeStatus } from '@/types';

/** Destinos permitidos por estado actual (sem recuar; «Atrasada» só entra por trigger). */
const ALLOWED_NEXT: Record<ProdutividadeStatus, readonly ProdutividadeStatus[]> = {
  Pendente: ['Em Progresso', 'Em aprovação', 'Concluída', 'Cancelada'],
  'Em Progresso': ['Em aprovação', 'Concluída', 'Cancelada'],
  Atrasada: ['Em Progresso', 'Em aprovação', 'Concluída', 'Cancelada'],
  'Em aprovação': ['Em Progresso', 'Concluída', 'Cancelada'],
  Concluída: [],
  Cancelada: [],
};

export function canTransitionProdutividadeStatus(
  from: ProdutividadeStatus | null | undefined,
  to: ProdutividadeStatus,
): boolean {
  if (!from || from === to) return true;
  const allowed = ALLOWED_NEXT[from];
  return Boolean(allowed?.includes(to));
}

export function produtividadeTransitionBlockedMessage(from: ProdutividadeStatus, to: ProdutividadeStatus): string {
  return `Não é permitido passar de «${from}» para «${to}». Só pode avançar o estado (não recuar, por exemplo de «Em Progresso» para «Pendente»).`;
}

/** Para Select: o valor actual permanece clicável; combina bloqueios extra (entregável, aprovação). */
export function produtividadeStatusSelectDisabled(
  current: ProdutividadeStatus,
  option: ProdutividadeStatus,
  extraBlocked?: boolean,
): boolean {
  if (current === option) return false;
  if (extraBlocked) return true;
  return !canTransitionProdutividadeStatus(current, option);
}
