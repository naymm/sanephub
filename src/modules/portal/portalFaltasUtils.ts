import { formatarDuracaoHorasMinutos, SEGUNDOS_ATRASO_POR_FALTA } from '@/lib/pontoHorario';
import type { Falta } from '@/types';

export function chaveAtrasoMes(colaboradorId: number, mesAno: string): string {
  return `${colaboradorId}|${mesAno}`;
}

export function textoAtrasoFaltaCelula(f: Falta, totaisMes: Map<string, number>): string {
  if (f.tipo !== 'Por atrasos') return '—';
  const mes = f.referenciaMesAtrasos?.trim();
  const limiar = formatarDuracaoHorasMinutos(SEGUNDOS_ATRASO_POR_FALTA);
  if (!mes) return `1×${limiar} por falta`;
  const total = totaisMes.get(chaveAtrasoMes(f.colaboradorId, mes));
  if (total != null) {
    return `${formatarDuracaoHorasMinutos(total)} acum. · +${limiar}/falta`;
  }
  return `+${limiar}/falta · ${mes}`;
}

export function numeroFaltaAtrasoNoMes(f: Falta, todas: Falta[]): number | null {
  if (f.tipo !== 'Por atrasos' || !f.referenciaMesAtrasos) return null;
  const ordem = todas
    .filter(
      x =>
        x.tipo === 'Por atrasos' &&
        x.referenciaMesAtrasos === f.referenciaMesAtrasos &&
        x.colaboradorId === f.colaboradorId,
    )
    .sort((a, b) => a.id - b.id);
  const i = ordem.findIndex(x => x.id === f.id);
  return i >= 0 ? i + 1 : null;
}
