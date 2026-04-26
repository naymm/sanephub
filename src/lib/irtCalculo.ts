import type { Colaborador, IRTEscalao, Falta, LicencaAssiduidade } from '@/types';
import {
  calculateAttendanceImpact,
  type AttendancePayrollImpactDetalhe,
} from '@/services/assiduidade/attendanceImpact';

const LIMITE_SUBSIDIO_TRIBUTAVEL = 30000;
const TAXA_SEGURANCA_SOCIAL = 0.03;

/**
 * Referência de dias úteis por mês para valorizar um dia de falta no bruto (prática usual alinhada à LGT).
 * Valor do dia = componente / DIAS_UTEIS_MES_NORMA_TRABALHO.
 */
export const DIAS_UTEIS_MES_NORMA_TRABALHO = 22;

/** Fallback local para não bloquear processamento quando `irt_escalaes` não estiver carregada. */
export const IRT_ESCALOES_FALLBACK: IRTEscalao[] = [
  { id: -1, ordem: 1, valorMin: 0, valorMax: 150000, parcelaFixa: 0, taxaPercent: 0, excessoDe: 0 },
  { id: -2, ordem: 2, valorMin: 150000, valorMax: 200000, parcelaFixa: 12500, taxaPercent: 16, excessoDe: 150000 },
  { id: -3, ordem: 3, valorMin: 200000, valorMax: 300000, parcelaFixa: 31250, taxaPercent: 18, excessoDe: 200000 },
  { id: -4, ordem: 4, valorMin: 300000, valorMax: 500000, parcelaFixa: 49250, taxaPercent: 19, excessoDe: 300000 },
  { id: -5, ordem: 5, valorMin: 500000, valorMax: 1000000, parcelaFixa: 87250, taxaPercent: 20, excessoDe: 500000 },
  { id: -6, ordem: 6, valorMin: 1000000, valorMax: 1500000, parcelaFixa: 187250, taxaPercent: 21, excessoDe: 1000000 },
  { id: -7, ordem: 7, valorMin: 1500000, valorMax: 2000000, parcelaFixa: 292250, taxaPercent: 22, excessoDe: 1500000 },
  { id: -8, ordem: 8, valorMin: 2000000, valorMax: 2500000, parcelaFixa: 402250, taxaPercent: 23, excessoDe: 2000000 },
  { id: -9, ordem: 9, valorMin: 2500000, valorMax: 5000000, parcelaFixa: 517250, taxaPercent: 24, excessoDe: 2500000 },
  { id: -10, ordem: 10, valorMin: 5000000, valorMax: 10000000, parcelaFixa: 1117250, taxaPercent: 24.5, excessoDe: 5000000 },
  { id: -11, ordem: 11, valorMin: 10000000, valorMax: null, parcelaFixa: 2342250, taxaPercent: 25, excessoDe: 10000000 },
];

function arredondar2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface MateriaColetavelInput {
  salarioBase: number;
  subsidioAlimentacao: number;
  subsidioTransporte: number;
  outrosSubsidios: number;
  limiteTributavel?: number;
  taxaSegurancaSocial?: number; // ex.: 0.03
}

export interface MateriaColetavelResultado {
  salarioBruto: number;
  segurancaSocial: number;
  segurancaSocialRounded: number;
  subsidioAlimentacaoExcesso: number;
  subsidioTransporteExcesso: number;
  materiaColetavel: number;
}

export function calcularMateriaColetavel({
  salarioBase,
  subsidioAlimentacao,
  subsidioTransporte,
  outrosSubsidios,
  limiteTributavel = LIMITE_SUBSIDIO_TRIBUTAVEL,
  taxaSegurancaSocial = TAXA_SEGURANCA_SOCIAL,
}: MateriaColetavelInput): MateriaColetavelResultado {
  const salarioBruto = salarioBase + subsidioAlimentacao + subsidioTransporte + outrosSubsidios;
  const segurancaSocial = salarioBruto * taxaSegurancaSocial;
  const subsidioAlimentacaoExcesso = Math.max(0, subsidioAlimentacao - limiteTributavel);
  const subsidioTransporteExcesso = Math.max(0, subsidioTransporte - limiteTributavel);

  // Regra conforme exemplo do utilizador:
  // MATÉRIA COLETÁVEL = SALÁRIO BASE - SEGURANÇA SOCIAL + SUBSÍDIOS (outros) + EXCESSOS tributáveis
  const materiaColetavel = salarioBase - segurancaSocial + outrosSubsidios + subsidioAlimentacaoExcesso + subsidioTransporteExcesso;

  return {
    salarioBruto,
    segurancaSocial,
    segurancaSocialRounded: arredondar2(segurancaSocial),
    subsidioAlimentacaoExcesso,
    subsidioTransporteExcesso,
    materiaColetavel,
  };
}

export interface IrtResultado {
  irt: number;
  escalon: IRTEscalao | null;
}

function selecionarEscalonPorBase(salarioBase: number, irtEscalaes: IRTEscalao[]): IRTEscalao | null {
  if (!irtEscalaes.length) return null;

  const base = Math.max(0, salarioBase);
  const sorted = [...irtEscalaes].sort((a, b) => a.ordem - b.ordem);

  let esc: IRTEscalao | null = null;
  for (const s of sorted) {
    const maxOk = s.valorMax == null ? true : base <= s.valorMax;
    if (!maxOk) continue;

    if (s.ordem === 1) {
      // 1º escalão: [0 .. valor_max] => IRT 0 (taxa 0 no DB)
      esc = s;
      break;
    }

    // restantes escalões: base > valor_min e (sem valor_max ou base <= valor_max)
    if (base > s.valorMin) {
      esc = s;
      break;
    }
  }

  if (!esc) return sorted[sorted.length - 1] ?? null;
  return esc;
}

export function selecionarEscalaoIrtPorSalarioBase(salarioBase: number, irtEscalaes: IRTEscalao[]): IRTEscalao | null {
  return selecionarEscalonPorBase(salarioBase, irtEscalaes);
}

export function calcularIrt(materiaColetavel: number, salarioBase: number, irtEscalaes: IRTEscalao[]): IrtResultado {
  if (!irtEscalaes.length) return { irt: 0, escalon: null };

  const materia = Math.max(0, materiaColetavel);
  const esc = selecionarEscalonPorBase(salarioBase, irtEscalaes);
  if (!esc) return { irt: 0, escalon: null };

  const irtPrecisa = esc.parcelaFixa + (materia - esc.excessoDe) * (esc.taxaPercent / 100);
  const irt = Math.max(0, arredondar2(irtPrecisa));

  return { irt, escalon: esc };
}

export interface ProcessamentoSalarialInput {
  salarioBase: number;
  subsidioAlimentacao: number;
  subsidioTransporte: number;
  outrosSubsidios: number;
  outrasDeducoes?: number;
  /** Faltas Injustificada e «Por atrasos» no mês: desconto (base+alim.+transp.)/22 por dia antes de impostos. */
  diasFaltaDesconto?: number;
}

export interface ComponentesAposFaltas {
  salarioBaseEfetivo: number;
  subsidioAlimentacaoEfetivo: number;
  subsidioTransporteEfetivo: number;
  descontoBase: number;
  descontoAlimentacao: number;
  descontoTransporte: number;
  totalDescontoFaltas: number;
}

export function calcularComponentesAposFaltas(
  salarioBase: number,
  subsidioAlimentacao: number,
  subsidioTransporte: number,
  diasFalta: number,
  diasUteisRef: number = DIAS_UTEIS_MES_NORMA_TRABALHO,
): ComponentesAposFaltas {
  const n = Math.max(0, Math.floor(diasFalta));
  const d = diasUteisRef > 0 ? diasUteisRef : DIAS_UTEIS_MES_NORMA_TRABALHO;
  const descontoBase = arredondar2((Math.max(0, salarioBase) / d) * n);
  const descontoAlimentacao = arredondar2((Math.max(0, subsidioAlimentacao) / d) * n);
  const descontoTransporte = arredondar2((Math.max(0, subsidioTransporte) / d) * n);
  const totalDescontoFaltas = arredondar2(descontoBase + descontoAlimentacao + descontoTransporte);

  return {
    salarioBaseEfetivo: Math.max(0, arredondar2(salarioBase - descontoBase)),
    subsidioAlimentacaoEfetivo: Math.max(0, arredondar2(subsidioAlimentacao - descontoAlimentacao)),
    subsidioTransporteEfetivo: Math.max(0, arredondar2(subsidioTransporte - descontoTransporte)),
    descontoBase,
    descontoAlimentacao,
    descontoTransporte,
    totalDescontoFaltas,
  };
}

/** Salário base após desconto proporcional por faltas — para selecção de escalão IRT coerente com o processamento. */
export function salarioBaseParaEscalaoIrtAposFaltas(
  vencimentoBaseNominal: number,
  diasFaltaDesconto: number,
  diasUteisRef: number = DIAS_UTEIS_MES_NORMA_TRABALHO,
): number {
  const n = Math.max(0, Math.floor(diasFaltaDesconto));
  if (n === 0) return Math.max(0, vencimentoBaseNominal);
  const c = calcularComponentesAposFaltas(vencimentoBaseNominal, 0, 0, n, diasUteisRef);
  return c.salarioBaseEfetivo;
}

export interface ProcessamentoSalarialResultado {
  salarioBruto: number;
  inss: number; // segurança social
  irt: number;
  liquido: number;
  escalonIrt?: IRTEscalao | null;
  descontoFaltas: number;
  diasFaltaDesconto: number;
}

export function calcularInssIrtLiquido(
  input: ProcessamentoSalarialInput,
  irtEscalaes: IRTEscalao[],
): ProcessamentoSalarialResultado {
  const {
    salarioBase,
    subsidioAlimentacao,
    subsidioTransporte,
    outrosSubsidios,
    outrasDeducoes = 0,
    diasFaltaDesconto: diasFaltaBruto = 0,
  } = input;

  const diasFalta = Math.max(0, Math.floor(diasFaltaBruto));
  const apos = calcularComponentesAposFaltas(salarioBase, subsidioAlimentacao, subsidioTransporte, diasFalta);

  const { salarioBruto, segurancaSocialRounded, materiaColetavel } = calcularMateriaColetavel({
    salarioBase: apos.salarioBaseEfetivo,
    subsidioAlimentacao: apos.subsidioAlimentacaoEfetivo,
    subsidioTransporte: apos.subsidioTransporteEfetivo,
    outrosSubsidios,
  });

  const { irt, escalon } = calcularIrt(materiaColetavel, apos.salarioBaseEfetivo, irtEscalaes);
  const liquido = Math.max(0, arredondar2(salarioBruto - segurancaSocialRounded - irt - outrasDeducoes));

  return {
    salarioBruto,
    inss: segurancaSocialRounded,
    irt,
    liquido,
    escalonIrt: escalon,
    descontoFaltas: apos.totalDescontoFaltas,
    diasFaltaDesconto: diasFalta,
  };
}

/** Linhas de pré-visualização alinhadas a um «processamento individual» (ex.: Primavera). */
export interface ResumoProcessamentoIndividual {
  periodoLabel: string;
  diasUteisReferencia: number;
  /** Vencimento base efectivo ÷ (dias úteis ref. × 8 h) — indicativo. */
  salarioHoraAprox: number;
  materiaColetavel: number;
  componentes: {
    salarioBaseNominal: number;
    salarioBaseEfetivo: number;
    subsidioAlimentacaoNominal: number;
    subsidioAlimentacaoEfetivo: number;
    subsidioTransporteNominal: number;
    subsidioTransporteEfetivo: number;
    outrosSubsidiosAgregadoNominal: number;
    outrosSubsidiosEfetivo: number;
    subsidioRiscoNominal: number;
    subsidioDisponibilidadeNominal: number;
  };
}

export type ProcessamentoSalarialComAssiduidadeResultado = ProcessamentoSalarialResultado & {
  detalheAssiduidade: AttendancePayrollImpactDetalhe;
  resumoIndividual: ResumoProcessamentoIndividual;
};

/**
 * Processamento salarial com regras de assiduidade (faltas justificadas/injustificadas, licença de maternidade).
 * Subsídios risco e disponibilidade entram no montante «outros» para matéria colectável (alinhado ao modelo actual do recibo).
 */
function labelPeriodoMesAno(mesAno: string): string {
  const p = mesAno.trim().slice(0, 7);
  const m = p.match(/^(\d{4})-(\d{2})$/);
  if (!m) return mesAno;
  return `${m[2]}-${m[1]}`;
}

export function calcularInssIrtLiquidoComAssiduidade(
  colaborador: Colaborador,
  mesAno: string,
  faltas: Falta[],
  licencas: LicencaAssiduidade[],
  irtEscalaes: IRTEscalao[],
  extra?: { outrasDeducoes?: number },
): ProcessamentoSalarialComAssiduidadeResultado {
  const outrasDeducoes = extra?.outrasDeducoes ?? 0;
  const detalhe = calculateAttendanceImpact(colaborador, { mesAno, faltas, licencas });
  const periodoLabel = labelPeriodoMesAno(mesAno);
  const horasMesRef = Math.max(1, DIAS_UTEIS_MES_NORMA_TRABALHO * 8);

  if (detalhe.modo === 'licenca_maternidade') {
    const salarioBase = Math.max(0, colaborador.salarioBase ?? 0);
    const segurancaSocial = arredondar2(salarioBase * TAXA_SEGURANCA_SOCIAL);
    const materiaColetavel = salarioBase - segurancaSocial;
    const { irt, escalon } = calcularIrt(materiaColetavel, salarioBase, irtEscalaes);
    const liquido = Math.max(0, arredondar2(salarioBase - segurancaSocial - irt - outrasDeducoes));
    const salarioHoraAprox = arredondar2(salarioBase / horasMesRef);
    return {
      salarioBruto: salarioBase,
      inss: segurancaSocial,
      irt,
      liquido,
      escalonIrt: escalon,
      descontoFaltas: 0,
      diasFaltaDesconto: 0,
      detalheAssiduidade: detalhe,
      resumoIndividual: {
        periodoLabel,
        diasUteisReferencia: DIAS_UTEIS_MES_NORMA_TRABALHO,
        salarioHoraAprox,
        materiaColetavel,
        componentes: {
          salarioBaseNominal: salarioBase,
          salarioBaseEfetivo: salarioBase,
          subsidioAlimentacaoNominal: 0,
          subsidioAlimentacaoEfetivo: 0,
          subsidioTransporteNominal: 0,
          subsidioTransporteEfetivo: 0,
          outrosSubsidiosAgregadoNominal: 0,
          outrosSubsidiosEfetivo: 0,
          subsidioRiscoNominal: 0,
          subsidioDisponibilidadeNominal: 0,
        },
      },
    };
  }

  const salarioBaseNominal = Math.max(0, colaborador.salarioBase ?? 0);
  const alimNominal = Math.max(0, colaborador.subsidioAlimentacao ?? 0);
  const transpNominal = Math.max(0, colaborador.subsidioTransporte ?? 0);
  const outrosAgregado =
    Math.max(0, colaborador.outrosSubsidios ?? 0) +
    Math.max(0, colaborador.subsidioRisco ?? 0) +
    Math.max(0, colaborador.subsidioDisponibilidade ?? 0);

  const salarioBaseEfetivo = Math.max(0, arredondar2(salarioBaseNominal - detalhe.descontoSalarioBase));
  const alimEfetivo = Math.max(0, arredondar2(alimNominal - detalhe.descontoAlimentacao));
  const transpEfetivo = Math.max(0, arredondar2(transpNominal - detalhe.descontoTransporte));
  const outrosEfetivo = Math.max(
    0,
    arredondar2(
      outrosAgregado - detalhe.descontoOutrosSubsidios - detalhe.descontoRisco - detalhe.descontoDisponibilidade,
    ),
  );

  const { salarioBruto, segurancaSocialRounded, materiaColetavel } = calcularMateriaColetavel({
    salarioBase: salarioBaseEfetivo,
    subsidioAlimentacao: alimEfetivo,
    subsidioTransporte: transpEfetivo,
    outrosSubsidios: outrosEfetivo,
  });

  const { irt, escalon } = calcularIrt(materiaColetavel, salarioBaseEfetivo, irtEscalaes);
  const liquido = Math.max(0, arredondar2(salarioBruto - segurancaSocialRounded - irt - outrasDeducoes));
  const salarioHoraAprox = arredondar2(salarioBaseEfetivo / horasMesRef);

  return {
    salarioBruto,
    inss: segurancaSocialRounded,
    irt,
    liquido,
    escalonIrt: escalon,
    descontoFaltas: detalhe.totalDescontoBruto,
    diasFaltaDesconto: detalhe.diasInjustificados,
    detalheAssiduidade: detalhe,
    resumoIndividual: {
      periodoLabel,
      diasUteisReferencia: DIAS_UTEIS_MES_NORMA_TRABALHO,
      salarioHoraAprox,
      materiaColetavel,
      componentes: {
        salarioBaseNominal: salarioBaseNominal,
        salarioBaseEfetivo: salarioBaseEfetivo,
        subsidioAlimentacaoNominal: alimNominal,
        subsidioAlimentacaoEfetivo: alimEfetivo,
        subsidioTransporteNominal: transpNominal,
        subsidioTransporteEfetivo: transpEfetivo,
        outrosSubsidiosAgregadoNominal: outrosAgregado,
        outrosSubsidiosEfetivo: outrosEfetivo,
        subsidioRiscoNominal: Math.max(0, colaborador.subsidioRisco ?? 0),
        subsidioDisponibilidadeNominal: Math.max(0, colaborador.subsidioDisponibilidade ?? 0),
      },
    },
  };
}

