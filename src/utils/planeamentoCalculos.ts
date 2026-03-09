import type { RelatorioMensalPlaneamento, LinhaPlaneamento, GastosPessoalItem } from '@/types';

export function totalLinhas(linhas: LinhaPlaneamento[]): number {
  return linhas.reduce((s, l) => s + (l.quantidade * l.precoUnitario), 0);
}

export function totalGastosPessoal(items: GastosPessoalItem[]): number {
  return items.reduce((s, l) => s + (l.total || l.quantidade * l.precoUnitario), 0);
}

/** Total vendas (produtos + serviços) */
export function totalVendas(r: RelatorioMensalPlaneamento): number {
  const vProd = r.vendasProdutos.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0);
  const vServ = r.vendasServicos.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0);
  return vProd + vServ;
}

/** Custo mercadorias vendidas total */
export function totalCMV(r: RelatorioMensalPlaneamento): number {
  return r.custoMercadoriasVendidas.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0);
}

/** Total fornecimento serviços externos */
export function totalServicosExternos(r: RelatorioMensalPlaneamento): number {
  return r.fornecimentoServicosExternos.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0);
}

/** EBITDA = (Vendas Prod + Vendas Serv) - CMV - Gastos Pessoal - Serviços Externos */
export function calcularEbitda(r: RelatorioMensalPlaneamento): number {
  const vendas = totalVendas(r);
  const cmv = totalCMV(r);
  const gastosPessoal = totalGastosPessoal(r.gastosPessoal);
  const servExternos = totalServicosExternos(r);
  return vendas - cmv - gastosPessoal - servExternos;
}

/** Margem Bruta = (Vendas - CMV) / Vendas (ou 0 se Vendas 0) */
export function calcularMargemBruta(r: RelatorioMensalPlaneamento): number {
  const vendas = totalVendas(r);
  if (vendas <= 0) return 0;
  const cmv = totalCMV(r);
  return (vendas - cmv) / vendas;
}

/** Margem EBITDA = EBITDA / Vendas (ou 0 se Vendas 0) */
export function calcularMargemEbitda(r: RelatorioMensalPlaneamento): number {
  const vendas = totalVendas(r);
  if (vendas <= 0) return 0;
  return calcularEbitda(r) / vendas;
}

export function actualizarTotaisLinhas<T extends { quantidade: number; precoUnitario: number; total: number }>(linhas: T[]): T[] {
  return linhas.map(l => ({ ...l, total: l.quantidade * l.precoUnitario }));
}
