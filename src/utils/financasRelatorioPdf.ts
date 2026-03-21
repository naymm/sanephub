import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { Requisicao } from '@/types';
import { formatKz, formatDate } from '@/utils/formatters';

const MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 36;
const GOLD: [number, number, number] = [165, 126, 38];
const GOLD_LIGHT: [number, number, number] = [212, 169, 38];

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}

function getFinalY(doc: JsPDFWithAutoTable): number {
  return doc.lastAutoTable?.finalY ?? HEADER_HEIGHT + 20;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export interface FinancasRelatorioPdfInput {
  ano: number;
  mesInicio: number;
  mesFim: number;
  centroFiltroLabel: string;
  requisicoes: Requisicao[];
  totalGasto: number;
  porStatus: { name: string; value: number }[];
  porCentroCusto: { name: string; value: number }[];
  porMes: { mes: string; valor: number }[];
}

function drawHeader(doc: jsPDF, subtitle: string) {
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Relatório Financeiro — Requisições', MARGIN, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const subLines = doc.splitTextToSize(subtitle, PAGE_WIDTH - MARGIN * 2);
  doc.text(subLines, MARGIN, 24);
  doc.setTextColor(0, 0, 0);
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(MARGIN, y - 4, CONTENT_WIDTH, 9, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(title, MARGIN + 3, y + 3);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  return y + 12;
}

function drawFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const left = `Gerado em ${new Date().toLocaleString('pt-PT')} • SANEP Hub`;
  doc.text(left, MARGIN, PAGE_HEIGHT - 8);
  const right = `Página ${pageNumber} / ${totalPages}`;
  doc.text(right, PAGE_WIDTH - MARGIN - doc.getTextWidth(right), PAGE_HEIGHT - 8);
  doc.setTextColor(0, 0, 0);
}

function drawBarBlock(
  doc: jsPDF,
  title: string,
  items: { label: string; value: number }[],
  startY: number,
  colors: [number, number, number][],
): number {
  let y = sectionTitle(doc, title, startY);
  if (items.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Sem dados no período.', MARGIN, y);
    doc.setTextColor(0, 0, 0);
    return y + 8;
  }
  const max = Math.max(...items.map(i => i.value), 1);
  const chartLeft = MARGIN;
  const chartWidth = CONTENT_WIDTH - 62;
  const barHeight = 4.5;
  const gap = 2.5;

  items.forEach((item, i) => {
    const barLen = (item.value / max) * chartWidth;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    const labelShort = item.label.length > 26 ? `${item.label.slice(0, 23)}…` : item.label;
    doc.text(labelShort, chartLeft, y + 3.2);
    const c = colors[i % colors.length];
    doc.setFillColor(...c);
    doc.roundedRect(chartLeft + 50, y, Math.max(barLen, 0.5), barHeight, 0.4, 0.4, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(formatKz(item.value), chartLeft + 52 + chartWidth, y + 3.2);
    doc.setFont('helvetica', 'normal');
    y += barHeight + gap;
  });
  return y + 4;
}

function addFootersAllPages(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total);
  }
}

/**
 * Exporta o relatório de requisições (finanças) em PDF com layout profissional.
 */
export function exportRelatorioFinanceiroPdf(input: FinancasRelatorioPdfInput): void {
  const {
    ano,
    mesInicio,
    mesFim,
    centroFiltroLabel,
    requisicoes,
    totalGasto,
    porStatus,
    porCentroCusto,
    porMes,
  } = input;

  const mesIniLabel = MESES[mesInicio - 1] ?? String(mesInicio);
  const mesFimLabel = MESES[mesFim - 1] ?? String(mesFim);
  const subtitle = `Ano ${ano}  •  Período: ${mesIniLabel} a ${mesFimLabel}  •  Centro de custo: ${centroFiltroLabel}`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPDFWithAutoTable;
  drawHeader(doc, subtitle);

  let y = HEADER_HEIGHT + 8;

  // Resumo em cartões (linhas)
  y = sectionTitle(doc, 'Resumo do período', y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const nReq = requisicoes.length;
  const media = nReq ? Math.round(totalGasto / nReq) : 0;
  doc.text(`Total de requisições: ${nReq}`, MARGIN, y);
  y += 6;
  doc.text(`Valor total: ${formatKz(totalGasto)}`, MARGIN, y);
  y += 6;
  doc.text(`Média por requisição: ${nReq ? formatKz(media) : '—'}`, MARGIN, y);
  y += 12;

  // Tabela despesas por mês
  y = sectionTitle(doc, 'Despesas por mês', y);
  const rowsMes = porMes.map(r => [r.mes, formatKz(r.valor)]);
  autoTable(doc, {
    head: [['Mês', 'Valor']],
    body: rowsMes.length ? rowsMes : [['—', '—']],
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_WIDTH,
    theme: 'striped',
    headStyles: { fillColor: GOLD, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = getFinalY(doc) + 8;

  // Barras por centro de custo
  y = drawBarBlock(
    doc,
    'Distribuição por centro de custo',
    porCentroCusto.map(p => ({ label: p.name, value: p.value })),
    y,
    [GOLD_LIGHT, GOLD, [16, 185, 129], [245, 158, 11], [100, 116, 139], [139, 92, 246]],
  );

  if (y > 230) {
    doc.addPage();
    y = MARGIN + 6;
  }

  // Valor por status (tabela + barras)
  y = sectionTitle(doc, 'Valor agregado por status', y);
  const rowsStatus = porStatus.map(p => [p.name, formatKz(p.value)]);
  autoTable(doc, {
    head: [['Status', 'Valor']],
    body: rowsStatus.length ? rowsStatus : [['—', '—']],
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_WIDTH,
    theme: 'striped',
    headStyles: { fillColor: GOLD, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = getFinalY(doc) + 6;

  if (porStatus.length > 0) {
    y = drawBarBlock(
      doc,
      'Visualização por status',
      porStatus.map(p => ({ label: p.name, value: p.value })),
      y,
      [GOLD, GOLD_LIGHT, [16, 185, 129], [245, 158, 11], [100, 116, 139]],
    );
  }

  if (y > 185) {
    doc.addPage();
    y = MARGIN + 6;
  } else {
    y += 4;
  }

  // Detalhe completo — sectionTitle devolve a posição Y correcta; antes ignorávamos e a tabela sobrepunha o título
  y = sectionTitle(doc, 'Detalhe das requisições', y);

  const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

  const bodyRows = requisicoes.map(r => [
    r.num,
    truncate(r.fornecedor, 28),
    truncate(r.descricao, 36),
    r.centroCusto,
    formatKz(r.valor),
    formatDate(r.data),
    r.status,
  ]);

  autoTable(doc, {
    head: [['Nº', 'Fornecedor', 'Descrição', 'Centro', 'Valor', 'Data', 'Status']],
    body: bodyRows.length ? bodyRows : [['—', '—', '—', '—', '—', '—', '—']],
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 16 },
    tableWidth: CONTENT_WIDTH,
    showHead: 'everyPage',
    theme: 'striped',
    headStyles: {
      fillColor: GOLD,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    bodyStyles: { fontSize: 7, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 32 },
      2: { cellWidth: 38 },
      3: { cellWidth: 22 },
      4: { cellWidth: 26 },
      5: { cellWidth: 20 },
      6: { cellWidth: 24 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  addFootersAllPages(doc);

  const fname = `relatorio-financeiro-${ano}-${String(mesInicio).padStart(2, '0')}-${String(mesFim).padStart(2, '0')}.pdf`;
  doc.save(fname);
}
