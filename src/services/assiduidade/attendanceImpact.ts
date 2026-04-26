import type { Colaborador, Falta, LicencaAssiduidade, TipoFalta } from '@/types';
import { colaboradorComLicencaMaternidadeNoMes } from '@/services/assiduidade/attendanceValidation';

/** Mesmo divisor que `irtCalculo` (evita import circular). */
const DIAS_UTEIS_REF = 22;

function arredondar2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function valorDiaComponente(valor: number, diasUteis: number): number {
  const d = diasUteis > 0 ? diasUteis : DIAS_UTEIS_REF;
  return arredondar2((Math.max(0, valor) / d) * 1);
}

function faltasNoMes(colaboradorId: number, mesAnoPrefix: string, faltas: Falta[]): Falta[] {
  const p = mesAnoPrefix.trim().slice(0, 7);
  return faltas.filter(f => f.colaboradorId === colaboradorId && String(f.data).startsWith(p));
}

/** Tipos que descontam apenas subsídios (alim., transp., risco, disponibilidade), não o salário base. */
const TIPOS_FALTA_SO_SUBSIDIOS = new Set<TipoFalta>(['Justificada', 'Atestado Médico', 'Licença']);

/** Tipos que descontam salário base + todos os subsídios (valor/22 cada). */
const TIPOS_FALTA_COMPLETA = new Set<TipoFalta>(['Injustificada', 'Por atrasos']);

function contarFaltasPorTipoOrdenado(lista: Falta[]): { tipo: TipoFalta; dias: number }[] {
  const map = new Map<TipoFalta, number>();
  for (const f of lista) {
    map.set(f.tipo, (map.get(f.tipo) ?? 0) + 1);
  }
  const ordem: TipoFalta[] = ['Injustificada', 'Por atrasos', 'Justificada', 'Atestado Médico', 'Licença'];
  const out: { tipo: TipoFalta; dias: number }[] = [];
  for (const tipo of ordem) {
    const dias = map.get(tipo);
    if (dias && dias > 0) out.push({ tipo, dias });
  }
  return out;
}

export type AttendancePayrollModo = 'normal' | 'licenca_maternidade';

export interface AttendancePayrollImpactDetalhe {
  modo: AttendancePayrollModo;
  diasInjustificados: number;
  diasJustificadosSoSubsidios: number;
  descontoSalarioBase: number;
  descontoAlimentacao: number;
  descontoTransporte: number;
  descontoRisco: number;
  descontoDisponibilidade: number;
  descontoOutrosSubsidios: number;
  totalDescontoBruto: number;
  /** Registos de falta no mês por tipo (para processamento / recibo). */
  faltasContagemPorTipo: { tipo: TipoFalta; dias: number }[];
  /**
   * Parte do `totalDescontoBruto` correspondente a dias «completos» (injustificada, por atrasos):
   * base + outros subsídios + quota de alim./transp./risco/disponibilidade desses dias.
   */
  descontoMontanteRegraCompleta: number;
  /**
   * Parte do `totalDescontoBruto` correspondente a dias «só subsídios» (justificada, atestado, licença em falta):
   * apenas alim., transp., risco e disponibilidade.
   */
  descontoMontanteSoSubsidios: number;
  /** Em maternidade: INSS apenas sobre salário base nominal (sem subsídios no bruto). */
  inssApenasSalarioBaseNominal: boolean;
  /** Em maternidade: subsídios não pagos no recibo. */
  subsidiosRemovidos: boolean;
}

export interface CalculateAttendanceImpactInput {
  mesAno: string;
  faltas: Falta[];
  licencas: LicencaAssiduidade[];
  diasUteisReferencia?: number;
}

/**
 * Calcula o impacto financeiro da assiduidade no mês, para integrar no processamento salarial.
 * Regras:
 * - Falta justificada (e atestado / licença em falta): só desconta subsídios alim., transp., risco, disponibilidade (cada /22 por dia).
 * - Falta injustificada e «Por atrasos»: desconta base + todos os subsídios (incl. `outrosSubsidios` e risco/disponibilidade).
 * - Licença de maternidade (tabela `assiduidade_licencas`): remove subsídios, ignora faltas/atrasos no cálculo, INSS só sobre base nominal.
 */
export function calculateAttendanceImpact(
  employee: Colaborador,
  input: CalculateAttendanceImpactInput,
): AttendancePayrollImpactDetalhe {
  const diasU = input.diasUteisReferencia ?? DIAS_UTEIS_REF;
  const mes = input.mesAno.trim().slice(0, 7);

  if (colaboradorComLicencaMaternidadeNoMes(employee.id, mes, input.licencas)) {
    return {
      modo: 'licenca_maternidade',
      diasInjustificados: 0,
      diasJustificadosSoSubsidios: 0,
      descontoSalarioBase: 0,
      descontoAlimentacao: 0,
      descontoTransporte: 0,
      descontoRisco: 0,
      descontoDisponibilidade: 0,
      descontoOutrosSubsidios: 0,
      totalDescontoBruto: 0,
      faltasContagemPorTipo: [],
      descontoMontanteRegraCompleta: 0,
      descontoMontanteSoSubsidios: 0,
      inssApenasSalarioBaseNominal: true,
      subsidiosRemovidos: true,
    };
  }

  const lista = faltasNoMes(employee.id, mes, input.faltas);
  let diasI = 0;
  let diasJ = 0;
  for (const f of lista) {
    if (TIPOS_FALTA_COMPLETA.has(f.tipo)) diasI += 1;
    else if (TIPOS_FALTA_SO_SUBSIDIOS.has(f.tipo)) diasJ += 1;
  }

  const base = employee.salarioBase ?? 0;
  const alim = employee.subsidioAlimentacao ?? 0;
  const transp = employee.subsidioTransporte ?? 0;
  const risco = employee.subsidioRisco ?? 0;
  const disp = employee.subsidioDisponibilidade ?? 0;
  const outros = employee.outrosSubsidios ?? 0;

  const vdBase = valorDiaComponente(base, diasU);
  const vdAlim = valorDiaComponente(alim, diasU);
  const vdTransp = valorDiaComponente(transp, diasU);
  const vdRisco = valorDiaComponente(risco, diasU);
  const vdDisp = valorDiaComponente(disp, diasU);
  const vdOutros = valorDiaComponente(outros, diasU);

  const descontoSalarioBase = arredondar2(vdBase * diasI);
  const descontoAlimentacao = arredondar2(vdAlim * (diasI + diasJ));
  const descontoTransporte = arredondar2(vdTransp * (diasI + diasJ));
  const descontoRisco = arredondar2(vdRisco * (diasI + diasJ));
  const descontoDisponibilidade = arredondar2(vdDisp * (diasI + diasJ));
  const descontoOutrosSubsidios = arredondar2(vdOutros * diasI);

  const totalDescontoBruto = arredondar2(
    descontoSalarioBase +
      descontoAlimentacao +
      descontoTransporte +
      descontoRisco +
      descontoDisponibilidade +
      descontoOutrosSubsidios,
  );

  const dAlimJ = arredondar2(vdAlim * diasJ);
  const dTranspJ = arredondar2(vdTransp * diasJ);
  const dRiscoJ = arredondar2(vdRisco * diasJ);
  const dDispJ = arredondar2(vdDisp * diasJ);
  const descontoMontanteSoSubsidios = arredondar2(dAlimJ + dTranspJ + dRiscoJ + dDispJ);
  const descontoMontanteRegraCompleta = Math.max(0, arredondar2(totalDescontoBruto - descontoMontanteSoSubsidios));

  return {
    modo: 'normal',
    diasInjustificados: diasI,
    diasJustificadosSoSubsidios: diasJ,
    descontoSalarioBase,
    descontoAlimentacao,
    descontoTransporte,
    descontoRisco,
    descontoDisponibilidade,
    descontoOutrosSubsidios,
    totalDescontoBruto,
    faltasContagemPorTipo: contarFaltasPorTipoOrdenado(lista),
    descontoMontanteRegraCompleta,
    descontoMontanteSoSubsidios,
    inssApenasSalarioBaseNominal: false,
    subsidiosRemovidos: false,
  };
}
