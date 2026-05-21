import type { ProdutividadeStatus } from '@/types';

type ProdutividadeMetricRow = {
  status: ProdutividadeStatus;
  prazo: string;
  concluidaEm?: string | null;
  canceladaEm?: string | null;
};

/** Já terminada (estado ou data de conclusão/cancelamento). */
export function isProdutividadeActividadeFechada(a: ProdutividadeMetricRow): boolean {
  if (a.status === 'Concluída' || a.status === 'Cancelada') return true;
  if ((a.concluidaEm ?? '').trim().length > 0) return true;
  if ((a.canceladaEm ?? '').trim().length > 0) return true;
  return false;
}

/** Prazo vencido — só actividades ainda abertas (nunca concluídas/canceladas). */
export function isProdutividadeOverdue(a: ProdutividadeMetricRow): boolean {
  if (isProdutividadeActividadeFechada(a)) return false;
  const today = new Date();
  const t = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const d = new Date(a.prazo + 'T00:00:00Z');
  return d < t;
}

/** Estado de origem para validar transições (Pendente vencido ≈ «Atrasada» nas regras). */
export function getProdutividadeTransitionFrom(
  status: ProdutividadeStatus,
  opts?: { overdue?: boolean },
): ProdutividadeStatus {
  if (status === 'Atrasada') return 'Atrasada';
  if (opts?.overdue && status === 'Pendente') return 'Atrasada';
  return status;
}

/** Coluna Kanban → estado persistido (a coluna «Atrasada» não é um estado manual). */
export function produtividadeStatusFromKanbanColumn(
  col: ProdutividadeStatus,
): ProdutividadeStatus | null {
  if (col === 'Atrasada') return null;
  return col;
}

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

export function produtividadeStatusSelectDisabledForActivity(
  activity: { status: ProdutividadeStatus; prazo: string },
  option: ProdutividadeStatus,
  extraBlocked?: boolean,
): boolean {
  const from = getProdutividadeTransitionFrom(activity.status, {
    overdue: isProdutividadeOverdue(activity),
  });
  return produtividadeStatusSelectDisabled(from, option, extraBlocked);
}

/**
 * KPIs do topo:
 * - Em progresso / pendente / em aprovação: pelo estado persistido.
 * - Atrasadas: prazo vencido e ainda aberta (real), mesmo em «Em Progresso» — pode sobrepor-se a Em progresso.
 */
export function produtividadeMetricsCounts(rows: readonly ProdutividadeMetricRow[]): {
  total: number;
  concluida: number;
  atrasada: number;
  emProgresso: number;
  pendente: number;
  emAprovacao: number;
  pct: number;
} {
  let concluida = 0;
  let atrasada = 0;
  let emProgresso = 0;
  let pendente = 0;
  let emAprovacao = 0;

  for (const a of rows) {
    if (isProdutividadeActividadeFechada(a)) {
      if (a.status === 'Concluída' || (a.concluidaEm ?? '').trim().length > 0) concluida++;
      continue;
    }

    if (a.status === 'Em aprovação') emAprovacao++;
    if (a.status === 'Em Progresso') emProgresso++;
    if (a.status === 'Pendente' && !isProdutividadeOverdue(a)) pendente++;

    if (isProdutividadeAtrasadaAberta(a)) atrasada++;
  }

  const total = rows.length;
  const pct = total === 0 ? 0 : Math.round((concluida / total) * 100);
  return { total, concluida, atrasada, emProgresso, pendente, emAprovacao, pct };
}

/** Actividades abertas com prazo já vencido (para relatórios, filtros e KPI «Atrasadas»). */
export function isProdutividadeAtrasadaAberta(a: ProdutividadeMetricRow): boolean {
  return isProdutividadeOverdue(a);
}
