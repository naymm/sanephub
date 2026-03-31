import type { RelatorioMensalPlaneamento, LinhaPlaneamento, GastosPessoalItem } from '@/types';

export function totalLinhas(linhas: LinhaPlaneamento[]): number {
  return linhas.reduce((s, l) => s + (l.quantidade * l.precoUnitario), 0);
}

export function totalGastosPessoal(items: GastosPessoalItem[]): number {
  return items.reduce((s, l) => s + (l.total || l.quantidade * l.precoUnitario), 0);
}

const GASTOS_PESSOAL_EXCLUIDOS_EBITDA = new Set<GastosPessoalItem['tipo']>(['inss', 'irt']);

/** Gasto com pessoal incluído no EBITDA: exclui INSS e IRT. */
export function totalGastosPessoalEbitda(items: GastosPessoalItem[]): number {
  return items
    .filter(l => !GASTOS_PESSOAL_EXCLUIDOS_EBITDA.has(l.tipo))
    .reduce((s, l) => s + (l.total || l.quantidade * l.precoUnitario), 0);
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

/**
 * EBITDA = Volume de negócio (vendas produtos + serviços)
 *   − custo com mercadorias vendidas
 *   − gasto com pessoal (salários, subsídios; exclui INSS e IRT)
 *   − fornecimento de serviços externos.
 * Não inclui impostos sobre o lucro (ex.: IRC), juros nem depreciação — apenas o que consta nesta demonstração.
 */
export function calcularEbitda(r: RelatorioMensalPlaneamento): number {
  const volumeNegocio = totalVendas(r);
  const cmv = totalCMV(r);
  const gastosPessoal = totalGastosPessoalEbitda(r.gastosPessoal);
  const servExternos = totalServicosExternos(r);
  return volumeNegocio - cmv - gastosPessoal - servExternos;
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

/** Custos deduzidos no EBITDA: CMV + pessoal (sem INSS e IRT) + fornecimento de serviços externos. */
export function totalCustosBaseEbitda(r: RelatorioMensalPlaneamento): number {
  return totalCMV(r) + totalGastosPessoalEbitda(r.gastosPessoal) + totalServicosExternos(r);
}

/** Custos deduzidos no resultado líquido: CMV + pessoal (com INSS e IRT) + fornecimento de serviços externos. */
export function totalCustosBaseResultadoLiquido(r: RelatorioMensalPlaneamento): number {
  return totalCMV(r) + totalGastosPessoal(r.gastosPessoal) + totalServicosExternos(r);
}

/** Volume de negócio − custos com pessoal completo (inclui INSS e IRT). */
export function calcularResultadoLiquido(r: RelatorioMensalPlaneamento): number {
  return totalVendas(r) - totalCustosBaseResultadoLiquido(r);
}

/** Margem líquida = resultado líquido / vendas */
export function calcularMargemLiquida(r: RelatorioMensalPlaneamento): number {
  const vendas = totalVendas(r);
  if (vendas <= 0) return 0;
  return calcularResultadoLiquido(r) / vendas;
}

export function actualizarTotaisLinhas<T extends { quantidade: number; precoUnitario: number; total: number }>(linhas: T[]): T[] {
  return linhas.map(l => ({ ...l, total: l.quantidade * l.precoUnitario }));
}
