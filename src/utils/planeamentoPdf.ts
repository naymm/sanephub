import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { RelatorioMensalPlaneamento, LinhaPlaneamento, SaldoBancario, PendenteValor } from '@/types';
import { totalVendas, totalCMV, totalServicosExternos, totalGastosPessoal, calcularEbitda } from '@/utils/planeamentoCalculos';
import { formatPlaneamentoTextListForDisplay } from '@/utils/planeamentoTextLists';
import { unifiedMateriasStockFromLegacy } from '@/utils/planeamentoStocks';

const MARGIN = 14;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 288;

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}

function getFinalY(doc: JsPDFWithAutoTable): number {
  return doc.lastAutoTable?.finalY ?? CONTENT_START_Y;
}

function addPageIfNeeded(doc: jsPDF, y: number, needSpace: number): number {
  if (y + needSpace > 270) {
    doc.addPage();
    return CONTENT_START_Y; // conteúdo sempre abaixo do header
  }
  return y;
}

const HEADER_HEIGHT = 32;
const CONTENT_START_Y = 40;

function drawHeader(doc: jsPDF, empresaNome: string, mesAno: string, status: string) {
  doc.setFillColor(165, 126, 38); // Amarelo escuro
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Relatório Mensal de Planeamento Estratégico', MARGIN, 14);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const subLine = `${empresaNome}  •  Período: ${mesAno}  •  Status: ${status}`;
  const subLines = doc.splitTextToSize(subLine, PAGE_WIDTH - MARGIN * 2);
  doc.text(subLines, MARGIN, 22);
  doc.setTextColor(0, 0, 0);
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(241, 245, 249); // cinza claro
  doc.rect(MARGIN, y - 5, CONTENT_WIDTH, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(165, 126, 38);
  doc.text(title, MARGIN + 2, y + 2);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  return y + 12;
}

function textBlock(doc: jsPDF, label: string, text: string, y: number): number {
  if (!text) return y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`${label}:`, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
  doc.text(lines, MARGIN, y + 5);
  return y + 5 + lines.length * 4.5;
}

function tableWithAutoTable(
  doc: JsPDFWithAutoTable,
  headers: string[],
  rows: (string | number)[][],
  startY: number,
  colWidths?: number[],
  tableTitle?: string
): number {
  let y = startY;
  if (tableTitle) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(tableTitle, MARGIN, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    y += 5;
  }
  if (rows.length === 0) return y;
  const w = CONTENT_WIDTH;
  const cols = headers.length;
  const defaultW = w / cols;
  const widths = colWidths ?? headers.map(() => defaultW);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: y,
    margin: { left: MARGIN },
    tableWidth: w,
    columnStyles: Object.fromEntries(headers.map((_, i) => [i, { cellWidth: widths[i] ?? defaultW }])),
    theme: 'striped',
    headStyles: {
      fillColor: [165, 126, 38],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  return getFinalY(doc) + 6;
}

/** Gráfico de barras horizontais (valores em Kz ou percentagem) */
function drawBarChart(
  doc: jsPDF,
  title: string,
  items: { label: string; value: number; color: [number, number, number] }[],
  startY: number,
  maxVal?: number,
  isPercent = false
): number {
  let y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, MARGIN, y);
  y += 7;

  const chartLeft = MARGIN;
  const chartWidth = CONTENT_WIDTH - 55; // 55mm para rótulos
  const barHeight = 5;
  const gap = 3;
  const max = maxVal ?? Math.max(...items.map(i => Math.abs(i.value)), 1);

  items.forEach((item, i) => {
    const barLen = Math.max(0, (Math.abs(item.value) / (max || 1)) * chartWidth);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    const labelShort = item.label.length > 22 ? item.label.slice(0, 19) + '…' : item.label;
    doc.text(labelShort, chartLeft, y + 3.5);
    doc.setFillColor(...item.color);
    doc.roundedRect(chartLeft + 52, y, barLen, barHeight, 0.5, 0.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const str = isPercent ? `${(item.value * 100).toFixed(1)}%` : item.value.toLocaleString('pt-PT');
    doc.text(str, chartLeft + 54 + chartWidth, y + 3.5);
    y += barHeight + gap;
  });
  return y + 8;
}

/** Gráfico de barras para margens (0–100%) */
function drawMarginsChart(
  doc: jsPDF,
  title: string,
  items: { label: string; percent: number; color: [number, number, number] }[],
  startY: number
): number {
  let y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, MARGIN, y);
  y += 7;
  const chartLeft = MARGIN + 50;
  const chartWidth = CONTENT_WIDTH - 90;
  const barHeight = 6;
  const gap = 4;
  items.forEach((item, i) => {
    const barLen = Math.min(chartWidth, Math.max(0, (item.percent / 100) * chartWidth));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.text(item.label, MARGIN, y + 4);
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(chartLeft, y, chartWidth, barHeight, 0.5, 0.5, 'F');
    doc.setFillColor(...item.color);
    doc.roundedRect(chartLeft, y, barLen, barHeight, 0.5, 0.5, 'F');
    doc.text(`${item.percent.toFixed(1)}%`, chartLeft + chartWidth + 4, y + 4);
    y += barHeight + gap;
  });
  return y + 6;
}

function drawFooter(doc: jsPDF, rel: RelatorioMensalPlaneamento) {
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const parts: string[] = [];
  if (rel.submetidoPor && rel.submetidoEm) parts.push(`Submetido por ${rel.submetidoPor} em ${rel.submetidoEm}`);
  if (rel.analisadoPor && rel.analisadoEm) parts.push(`Analisado por ${rel.analisadoPor} em ${rel.analisadoEm}`);
  if (parts.length) doc.text(parts.join('  •  '), MARGIN, FOOTER_Y);
  doc.text(
    `Documento gerado em ${new Date().toLocaleString('pt-PT')}  •  Sanep Hub`,
    PAGE_WIDTH - MARGIN,
    FOOTER_Y,
    { align: 'right' }
  );
}

function mapLinhas(linhas: LinhaPlaneamento[]): (string | number)[][] {
  return linhas.map(l => [
    l.descricao || '—',
    l.quantidade,
    l.precoUnitario.toLocaleString('pt-PT'),
    (l.quantidade * l.precoUnitario).toLocaleString('pt-PT'),
  ]);
}

export function gerarPdfRelatorioMensal(rel: RelatorioMensalPlaneamento, empresaNome: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as JsPDFWithAutoTable;
  const mes = rel.mesAno.slice(5);
  const ano = rel.mesAno.slice(0, 4);
  const mesAnoLabel = `${mes}/${ano}`;

  drawHeader(doc, empresaNome, mesAnoLabel, rel.status);
  let y = CONTENT_START_Y;

  // ——— 1. Análise da Empresa e do Negócio ———
  y = sectionTitle(doc, '1. Análise da Empresa e do Negócio', y);
  y = textBlock(
    doc,
    'Actividades comerciais desenvolvidas no período',
    formatPlaneamentoTextListForDisplay(rel.actividadesComerciais),
    y,
  );
  y = textBlock(
    doc,
    'Principais constrangimentos identificados',
    formatPlaneamentoTextListForDisplay(rel.principaisConstrangimentos),
    y,
  );
  y = textBlock(
    doc,
    'Estratégias para aumento de receitas',
    formatPlaneamentoTextListForDisplay(rel.estrategiasReceitas),
    y,
  );
  y = textBlock(
    doc,
    'Estratégias para redução de custos',
    formatPlaneamentoTextListForDisplay(rel.estrategiasCustos),
    y,
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Ciclo de vida da empresa:', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(rel.cicloVida, MARGIN + 45, y);
  y += 10;

  y = addPageIfNeeded(doc, y, 50);
  if (y === CONTENT_START_Y) {
    drawHeader(doc, empresaNome, mesAnoLabel, rel.status);
  }

  // ——— 2. Necessidades de investimento ———
  y = sectionTitle(doc, '2. Necessidades de investimento', y);
  y = tableWithAutoTable(
    doc,
    ['Descrição', 'Qtd.', 'Preço unit. (Kz)', 'Total (Kz)'],
    mapLinhas(rel.necessidadesInvestimento),
    y,
    [90, 18, 35, 32]
  );

  y = addPageIfNeeded(doc, y, 40);
  if (y === CONTENT_START_Y) {
    drawHeader(doc, empresaNome, mesAnoLabel, rel.status);
  }

  // ——— 3. Gestão de Stocks ———
  y = sectionTitle(doc, '3. Gestão de Stocks', y);
  const materiasStock = unifiedMateriasStockFromLegacy(rel.stockInicial, rel.stockFinal);
  const rowsMaterias: (string | number)[][] = materiasStock.map(r => [
    r.descricao || '—',
    r.qtdStockInicial,
    r.precoUnitInicial.toLocaleString('pt-PT'),
    (r.qtdStockInicial * r.precoUnitInicial).toLocaleString('pt-PT'),
    r.qtdStockFinal,
    r.precoUnitFinal.toLocaleString('pt-PT'),
    (r.qtdStockFinal * r.precoUnitFinal).toLocaleString('pt-PT'),
  ]);
  y = tableWithAutoTable(
    doc,
    ['Matéria-prima', 'Ini. qtd', 'Ini. p.u.', 'Ini. total', 'Fin. qtd', 'Fin. p.u.', 'Fin. total'],
    rowsMaterias,
    y,
    [46, 18, 20, 22, 18, 20, 22],
    'Stock inicial e stock final de matéria-prima (por linha)',
  );
  y = tableWithAutoTable(
    doc,
    ['Descrição', 'Qtd.', 'Preço unit. (Kz)', 'Total (Kz)'],
    mapLinhas(rel.comprasPeriodo),
    y,
    [90, 18, 35, 32],
    'Compras do período',
  );
  y += 4;

  y = addPageIfNeeded(doc, y, 50);
  if (y === CONTENT_START_Y) {
    drawHeader(doc, empresaNome, mesAnoLabel, rel.status);
  }

  // ——— 4. Demonstração de Resultados (tabelas) ———
  y = sectionTitle(doc, '4. Demonstração de Resultados', y);
  y = tableWithAutoTable(doc, ['Descrição', 'Qtd.', 'Preço unit. (Kz)', 'Total (Kz)'], mapLinhas(rel.vendasProdutos), y, [90, 18, 35, 32]);
  y = tableWithAutoTable(doc, ['Descrição', 'Qtd.', 'Preço unit. (Kz)', 'Total (Kz)'], mapLinhas(rel.vendasServicos), y, [90, 18, 35, 32]);
  y = tableWithAutoTable(doc, ['Descrição', 'Qtd.', 'Preço unit. (Kz)', 'Total (Kz)'], mapLinhas(rel.custoMercadoriasVendidas), y, [90, 18, 35, 32]);
  y = tableWithAutoTable(doc, ['Descrição', 'Qtd.', 'Preço unit. (Kz)', 'Total (Kz)'], mapLinhas(rel.fornecimentoServicosExternos), y, [90, 18, 35, 32]);
  y += 4;

  // ——— Gráfico: Demonstração de Resultados (barras) ———
  const vendas = totalVendas(rel);
  const cmv = totalCMV(rel);
  const servExt = totalServicosExternos(rel);
  const gastosPess = totalGastosPessoal(rel.gastosPessoal);
  const ebitda = rel.ebitda ?? calcularEbitda(rel);
  y = addPageIfNeeded(doc, y, 55);
  if (y === CONTENT_START_Y) {
    drawHeader(doc, empresaNome, mesAnoLabel, rel.status);
  }
  y = drawBarChart(
    doc,
    'Resumo financeiro (Kz)',
    [
      { label: 'Vendas (produtos + serviços)', value: vendas, color: [34, 197, 94] },
      { label: 'Custo mercadorias vendidas', value: cmv, color: [239, 68, 68] },
      { label: 'Serviços externos', value: servExt, color: [249, 115, 22] },
      { label: 'Gastos com pessoal', value: gastosPess, color: [234, 179, 8] },
      { label: 'EBITDA', value: ebitda, color: ebitda >= 0 ? [165, 126, 38] : [185, 28, 28] },
    ],
    y,
    Math.max(vendas, cmv, servExt, gastosPess, Math.abs(ebitda), 1)
  );

  // ——— Margens (gráfico de barras %) ———
  const margemBruta = rel.margemBruta ?? (vendas > 0 ? (vendas - cmv) / vendas : 0);
  const margemEbitda = rel.margemEbitda ?? (vendas > 0 ? ebitda / vendas : 0);
  y = drawMarginsChart(
    doc,
    'Margens (%)',
    [
      { label: 'Margem Bruta', percent: margemBruta * 100, color: [165, 126, 38] },
      { label: 'Margem EBITDA', percent: margemEbitda * 100, color: [16, 185, 129] },
    ],
    y
  );
  y += 6;

  y = addPageIfNeeded(doc, y, 60);
  if (y === CONTENT_START_Y) {
    drawHeader(doc, empresaNome, mesAnoLabel, rel.status);
  }

  // ——— 5. Liquidez Financeira ———
  y = sectionTitle(doc, '5. Liquidez Financeira', y);
  const saldosRows = rel.saldosBancarios.map(s => [s.banco, s.numeroConta, s.saldoActual.toLocaleString('pt-PT')]);
  y = tableWithAutoTable(doc, ['Banco', 'Nº conta', 'Saldo (Kz)'], saldosRows, y, [60, 50, 52]);
  const pendPagRows = rel.pendentesPagamento.map(p => [p.nome, p.valor.toLocaleString('pt-PT')]);
  y = tableWithAutoTable(doc, ['Fornecedor / Descrição', 'Valor (Kz)'], pendPagRows, y, [100, 82]);
  const pendRecRows = rel.pendentesRecebimento.map(p => [p.nome, p.valor.toLocaleString('pt-PT')]);
  y = tableWithAutoTable(doc, ['Cliente / Descrição', 'Valor (Kz)'], pendRecRows, y, [100, 82]);

  // Rodapé em todas as páginas
  const totalPages = (doc as any).internal?.getNumberOfPages?.() ?? 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, rel);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${p} / ${totalPages}`, PAGE_WIDTH / 2, FOOTER_Y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  const fileName = `Relatorio_Planeamento_${empresaNome.replace(/\s+/g, '_')}_${rel.mesAno}.pdf`;
  doc.save(fileName);
}
