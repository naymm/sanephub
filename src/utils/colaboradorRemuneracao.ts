import type { Colaborador, ReciboSalario } from '@/types';

function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const RETENCAO_OPCOES = [2, 6.5] as const;
export type RetencaoPercent = (typeof RETENCAO_OPCOES)[number];

export function retencaoPercentColaborador(c: Colaborador): RetencaoPercent {
  return c.retencaoPercent === 2 ? 2 : 6.5;
}

export function formatRetencaoPercentLabel(pct: number): string {
  return pct === 2 ? '2%' : '6,5%';
}

/**
 * Remuneração mensal total na listagem RH: salário base + todos os subsídios.
 * Avençado: apenas o líquido cadastrado (`salarioBase`).
 */
export function salarioLiquidoColaborador(c: Colaborador): number {
  if (c.isAvencado) return Math.max(0, c.salarioBase ?? 0);

  const detalhados =
    (c.subsidioNatal ?? 0) +
    (c.abonoFamilia ?? 0) +
    (c.subsidioTurno ?? 0) +
    (c.subsidioDisponibilidade ?? 0) +
    (c.subsidioRisco ?? 0) +
    (c.subsidioAtavio ?? 0) +
    (c.subsidioRepresentacao ?? 0);
  const outros = detalhados > 0 ? detalhados : (c.outrosSubsidios ?? 0);

  return (
    (c.salarioBase ?? 0) +
    (c.subsidioAlimentacao ?? 0) +
    (c.subsidioTransporte ?? 0) +
    outros
  );
}

/** Processamento / recibo avençado: vencimento = líquido cadastrado; retenção informativa. */
export function calcularProcessamentoAvencado(
  salarioLiquidoCadastrado: number,
  retencaoPercent: number,
  outrasDeducoes = 0,
): {
  salarioBruto: number;
  inss: number;
  irt: number;
  retencao: number;
  retencaoPercent: RetencaoPercent;
  liquido: number;
  descontoFaltas: number;
  diasFaltaDesconto: number;
} {
  const vencimento = Math.max(0, arredondar2(salarioLiquidoCadastrado));
  const pct: RetencaoPercent = retencaoPercent === 2 ? 2 : 6.5;
  const retencao = arredondar2(vencimento * (pct / 100));
  void outrasDeducoes;
  return {
    salarioBruto: vencimento,
    inss: 0,
    irt: 0,
    retencao,
    retencaoPercent: pct,
    liquido: vencimento,
    descontoFaltas: 0,
    diasFaltaDesconto: 0,
  };
}

export function totalDeducoesRecibo(r: ReciboSalario): number {
  const retencao = r.retencao ?? 0;
  if (retencao > 0 && r.inss === 0 && r.irt === 0) {
    return (r.descontoFaltas ?? 0) + retencao + r.outrasDeducoes;
  }
  return (r.descontoFaltas ?? 0) + r.inss + r.irt + r.outrasDeducoes;
}

export function reciboEhAvencado(r: ReciboSalario, col?: Colaborador | null): boolean {
  if (col?.isAvencado) return true;
  return (r.retencao ?? 0) > 0 && r.inss === 0 && r.irt === 0;
}
