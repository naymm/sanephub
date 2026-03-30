/** Tolerância após `horario_entrada` antes de contar minutos de atraso (regra de RH). */
export const TOLERANCIA_ENTRADA_MINUTOS = 15;

/** 8 horas de atraso acumulado no mês → uma falta automática (em segundos). */
export const SEGUNDOS_ATRASO_POR_FALTA = 8 * 60 * 60;

/** Apresentação legível de segundos de atraso (só horas e minutos). */
export function formatarDuracaoHorasMinutos(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return '0 h';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Valores de `time_punches.kind` tratados como entrada (alinhado à função SQL). */
export function isMarcacaoEntradaKind(kind: string | null | undefined): boolean {
  const k = (kind ?? '').trim().toLowerCase();
  if (!k) return false;
  if (['in', 'entrada', 'clock_in', 'check_in'].includes(k)) return true;
  return k.startsWith('entrada');
}

/** Texto de referência para RH ao consultar uma marcação (fuso Africa/Luanda no servidor). */
export function textoReferenciaHorarioColaborador(c: {
  horarioEntrada?: string;
  isencaoHorario?: boolean;
} | null | undefined): string | null {
  if (!c) return null;
  if (c.isencaoHorario === true) {
    return 'Isenção de horário: atrasos não se aplicam.';
  }
  const h = (c.horarioEntrada ?? '08:00:00').trim().slice(0, 5);
  return `Contagem de atraso: após ${h} + ${TOLERANCIA_ENTRADA_MINUTOS} min (regra de entrada, mês Luanda).`;
}
