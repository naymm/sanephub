import type { ProdutividadeActividade, ProdutividadeStatus } from '@/types';

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isoTodayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Data mínima para «Próximo prazo» ao extender (posterior ao prazo actual e ≥ hoje/data actividade). */
export function minProximoPrazoExtensao(
  actividade: Pick<ProdutividadeActividade, 'prazo' | 'dataActividade'>,
  todayIso = isoTodayLocal(),
): string {
  const minDb = todayIso >= actividade.dataActividade ? todayIso : actividade.dataActividade;
  const dayAfterPrazo = addDaysIso(actividade.prazo, 1);
  return dayAfterPrazo > minDb ? dayAfterPrazo : minDb;
}

export function canExtendProdutividadeDeadline(status: ProdutividadeStatus): boolean {
  return status !== 'Concluída' && status !== 'Cancelada';
}
