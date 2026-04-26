import type { LicencaAssiduidade } from '@/types';

/** Início do dia civil local (00:00) para comparar datas de registo. */
function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Atraso só pode ser justificado no mesmo dia civil que `dataRef` (YYYY-MM-DD).
 * Se `agora` for depois desse dia → false.
 */
export function podeJustificarAtrasoMesmoDia(dataRefIso: string, agora: Date = new Date()): boolean {
  const part = String(dataRefIso).slice(0, 10);
  const m = part.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const ref = startOfLocalDay(new Date(y, mo, da));
  const hoje = startOfLocalDay(agora);
  return ref.getTime() === hoje.getTime();
}

/** `dia` (YYYY-MM-DD) está coberto por alguma licença de maternidade. */
export function colaboradorEmLicencaMaternidadeNoDia(
  colaboradorId: number,
  diaIso: string,
  licencas: LicencaAssiduidade[],
): boolean {
  const part = String(diaIso).slice(0, 10);
  const t = new Date(part + 'T12:00:00').getTime();
  if (Number.isNaN(t)) return false;
  return licencas.some(
    l =>
      l.colaboradorId === colaboradorId &&
      l.tipo === 'maternidade' &&
      String(l.dataInicio).slice(0, 10) <= part &&
      part <= String(l.dataFim).slice(0, 10),
  );
}

/** O mês `mesAno` (YYYY-MM) intersecta o período de maternidade (qualquer dia). */
export function colaboradorComLicencaMaternidadeNoMes(
  colaboradorId: number,
  mesAno: string,
  licencas: LicencaAssiduidade[],
): boolean {
  const prefix = mesAno.trim().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(prefix)) return false;
  const [yy, mm] = prefix.split('-').map(Number);
  const ultimo = new Date(yy, mm, 0).getDate();
  for (let d = 1; d <= ultimo; d++) {
    const dia = `${yy}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (colaboradorEmLicencaMaternidadeNoDia(colaboradorId, dia, licencas)) return true;
  }
  return false;
}
