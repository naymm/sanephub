import type { IRTEscalao } from '@/types';

const LIMITE_SUBSIDIO_TRIBUTAVEL = 30000;
const TAXA_SEGURANCA_SOCIAL = 0.03;

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
}

export interface ProcessamentoSalarialResultado {
  salarioBruto: number;
  inss: number; // segurança social
  irt: number;
  liquido: number;
  escalonIrt?: IRTEscalao | null;
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
  } = input;

  const { salarioBruto, segurancaSocialRounded, materiaColetavel } = calcularMateriaColetavel({
    salarioBase,
    subsidioAlimentacao,
    subsidioTransporte,
    outrosSubsidios,
  });

  const { irt, escalon } = calcularIrt(materiaColetavel, salarioBase, irtEscalaes);
  const liquido = Math.max(0, arredondar2(salarioBruto - segurancaSocialRounded - irt - outrasDeducoes));

  return {
    salarioBruto,
    inss: segurancaSocialRounded,
    irt,
    liquido,
    escalonIrt: escalon,
  };
}

