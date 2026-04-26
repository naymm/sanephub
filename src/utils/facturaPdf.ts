import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const RIGHT = PAGE_W - MARGIN;
const CONTENT_W = PAGE_W - MARGIN * 2;
const GREEN: [number, number, number] = [16, 124, 65];

export type FacturaLinhaPdf = {
  codArtigo: string;
  descricao: string;
  quantidade: string;
  un: string;
  precoUnitario: string;
  desconto: string;
  iva: string;
  valor: string;
};

export type FacturaPdfInput = {
  emitente: {
    nome: string;
    nif?: string | null;
    morada?: string | null;
    contactoLinha?: string | null;
  };
  /** Ex.: «FT FA.2024/4» (texto completo após a palavra Factura no cabeçalho). */
  referenciaDocumento: string;
  tipoDocumento?: string | null;
  cliente: {
    nome: string;
    morada?: string | null;
    nif?: string | null;
  };
  dataEmissao: string;
  moeda?: string;
  cambio?: string | null;
  requisicao?: string | null;
  descontoComercial?: string | null;
  descontoAdicional?: string | null;
  vencimento?: string | null;
  condicaoPagamento?: string | null;
  linhas: FacturaLinhaPdf[];
  totMercadoria: string;
  totIva: string;
  totalFactura: string;
  motivoIsencaoIva?: string | null;
  dadosBancarios?: string[] | null;
};

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}

function finalY(doc: jsPDF): number {
  return (doc as JsPDFWithAutoTable).lastAutoTable?.finalY ?? MARGIN;
}

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

function drawPrimaveraLogoMark(doc: jsPDF, x: number, y: number, size: number) {
  // Não temos o logo oficial no repo; desenhamos um marcador vetorial simples
  // que ocupa o mesmo espaço visual do símbolo no exemplo.
  const r = size / 2;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.circle(x + r, y + r, r, 'S');
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    const x2 = x + r + Math.cos(a) * (r - 0.8);
    const y2 = y + r + Math.sin(a) * (r - 0.8);
    doc.line(x + r, y + r, x2, y2);
  }
}

function hLine(doc: jsPDF, y: number) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.45);
  doc.line(MARGIN, y, RIGHT, y);
}

function fmtOrDash(v?: string | null) {
  const t = (v ?? '').trim();
  return t || '—';
}

/**
 * PDF de pré-visualização alinhado ao modelo típico Primavera (factura comercial AO).
 * Valores monetários vêm como texto (formato ERP) sempre que possível.
 */
export function generateFacturaPdfBlob(input: FacturaPdfInput): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPDFWithAutoTable;
  let y = MARGIN;

  const moeda = fmtOrDash(input.moeda ?? 'AKZ');
  const cambio = fmtOrDash(input.cambio);
  const tipoDoc = (input.tipoDocumento ?? 'Factura').trim() || 'Factura';

  // --- Topo: logo + emitente (verde) + Paginação ---
  drawPrimaveraLogoMark(doc, MARGIN, y - 1, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...GREEN);
  doc.text((input.emitente.nome || 'Empresa').toUpperCase(), MARGIN + 18, y + 6);
  doc.setTextColor(0, 0, 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Pág. 1/1', RIGHT, y + 2, { align: 'right' });

  // Linha de actividade (pequena, abaixo do nome) + morada/contactos (lado esquerdo)
  y += 14;
  doc.setFontSize(8.2);
  const moradaEmit = fmtOrDash(input.emitente.morada);
  const contactoEmit = (input.emitente.contactoLinha ?? '').trim();
  const emitLines = [
    ...wrapLines(doc, moradaEmit, 95),
    ...(contactoEmit ? [contactoEmit] : []),
    input.emitente.nif ? `Contribuinte: ${input.emitente.nif}` : '',
  ].filter(Boolean);
  doc.text(emitLines, MARGIN, y);

  // --- Cliente (lado direito) --- (fiel ao texto do exemplo)
  const cx = 118;
  let cy = y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Exmo.(s) Sr.(s)', cx, cy);
  cy += 4.6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const cn = wrapLines(doc, fmtOrDash(input.cliente.nome), PAGE_W - cx - MARGIN);
  doc.text(cn, cx, cy);
  cy += cn.length * 4.2;
  const cm = (input.cliente.morada ?? '').trim();
  if (cm) {
    doc.setFontSize(8.5);
    const cl = wrapLines(doc, cm, PAGE_W - cx - MARGIN);
    doc.text(cl, cx, cy);
    cy += cl.length * 3.8;
  }
  if (input.cliente.nif?.trim()) {
    doc.setFontSize(8.5);
    doc.text(`NIF: ${input.cliente.nif.trim()}`, cx, cy);
    cy += 3.8;
  }

  y = Math.max(y + emitLines.length * 3.8, cy) + 12;

  // --- Título: Factura FT ... + separador grosso ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`${tipoDoc} ${input.referenciaDocumento}`.trim(), MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Original', RIGHT, y, { align: 'right' });
  y += 6;
  hLine(doc, y);
  y += 6;

  // --- Cabeçalho de campos (exacto no estilo da imagem) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const x1 = MARGIN;
  const x2 = 62;
  const x3 = 102;
  const x4 = 132;
  const x5 = 162;

  doc.text('V/N.º Contrib.', x1, y);
  doc.text('Requisição', x2, y);
  doc.text('Moeda', x3, y);
  doc.text('Câmbio', x4, y);
  doc.text('Data', x5, y);
  y += 4.6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.7);
  doc.text(fmtOrDash(input.cliente.nif), x1, y);
  doc.text(fmtOrDash(input.requisicao), x2, y);
  doc.text(moeda, x3, y);
  doc.text(cambio, x4, y);
  doc.text(fmtOrDash(input.dataEmissao), x5, y);
  y += 6.2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Desconto Comercial', x1, y);
  doc.text('Desconto Adicional', x2, y);
  doc.text('Vencimento', x3, y);
  doc.text('Condição Pagamento', x4, y);
  y += 4.6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.7);
  doc.text(fmtOrDash(input.descontoComercial ?? '0,00'), x1, y);
  doc.text(fmtOrDash(input.descontoAdicional ?? '0,00'), x2, y);
  doc.text(fmtOrDash(input.vencimento), x3, y);
  doc.text(fmtOrDash(input.condicaoPagamento), x4, y);
  y += 6;

  // Linha fina acima da tabela de artigos
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, RIGHT, y);
  y += 2.5;

  // --- Linhas ---
  const body =
    input.linhas.length > 0
      ? input.linhas.map(l => [
          l.codArtigo,
          l.descricao,
          l.quantidade,
          l.un || 'UN',
          l.precoUnitario,
          l.desconto,
          l.iva,
          l.valor,
        ])
      : [['—', 'Sem linhas de artigo na base de dados.', '—', '—', '—', '—', '—', '—']];

  autoTable(doc, {
    head: [['Artigo', 'Descrição', 'Qtd.', 'Un.', 'Pr. Unitário', 'Desc.', 'IVA', 'Valor']],
    body,
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    theme: 'plain',
    styles: { fontSize: 8.2, cellPadding: 1.2, textColor: [0, 0, 0], lineWidth: 0 },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    didDrawCell: data => {
      // linha horizontal fina abaixo do cabeçalho (como no PDF Primavera)
      if (data.section === 'head' && data.row.index === 0) {
        const yLine = data.cell.y + data.cell.height;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.line(MARGIN, yLine, RIGHT, yLine);
      }
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 62 },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 14, halign: 'right' },
      6: { cellWidth: 14, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
    },
  });

  y = finalY(doc) + 6;

  // --- Resumo IVA + totais ---
  if (y > PAGE_H - 72) {
    doc.addPage();
    y = MARGIN;
  }

  // Texto de certificação (rodapé acima dos quadros)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(70, 70, 70);
  const cert =
    'Processado por programa validado n.º 41/AGT/2019. Os bens e/ou serviços foram colocados à disposição na data indicada. PRIMAVERA BSS';
  doc.text(wrapLines(doc, cert, CONTENT_W), MARGIN, y);
  doc.setTextColor(0, 0, 0);
  y += 14;

  // Quadro resumo de impostos (esquerda)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Quadro Resumo de Impostos', MARGIN, y);
  y += 4.8;
  doc.setFontSize(8);
  doc.text('Taxa/Valor', MARGIN, y);
  doc.text('Incid./Qtd.', MARGIN + 44, y);
  doc.text('Total', MARGIN + 82, y);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y + 1.2, MARGIN + 95, y + 1.2);
  y += 5;
  doc.setFont('helvetica', 'normal');
  const ivaTxt = fmtOrDash(input.totIva ?? '0,00');
  doc.text('IVA (0,00)', MARGIN, y);
  doc.text('(90)', MARGIN + 44, y);
  doc.text(ivaTxt, MARGIN + 82, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Motivo Isenção', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(fmtOrDash(input.motivoIsencaoIva), MARGIN + 30, y);

  // Totais (direita)
  const ry = y - 10.8;
  const bx = 128;
  let ty = ry;
  const totPairs: Array<[string, string]> = [
    ['Mercadoria/Serviços', fmtOrDash(input.totMercadoria)],
    ['Desconto Comercial', fmtOrDash(input.descontoComercial ?? '0,00')],
    ['Desconto Adicional', fmtOrDash(input.descontoAdicional ?? '0,00')],
    ['Portes', '0,00'],
    ['Outros Serviços', '0,00'],
    ['Adiantamentos', '0,00'],
    ['IEC/Outras Contribuições', '0,00'],
    ['IVA', fmtOrDash(input.totIva)],
    ['Acerto', '0,00'],
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  for (const [lab, val] of totPairs) {
    doc.text(lab, bx, ty);
    doc.text(val, RIGHT, ty, { align: 'right' });
    ty += 4.2;
  }
  ty += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total ( ${moeda} )`, bx + 18, ty);
  doc.setFontSize(12);
  doc.text(fmtOrDash(input.totalFactura), RIGHT, ty, { align: 'right' });

  // Dados bancários (linha inferior)
  const bankY = PAGE_H - 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Dados Bancários', MARGIN, bankY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  const bankLines = input.dadosBancarios?.filter(Boolean) ?? [];
  doc.text(bankLines.length ? bankLines : ['—'], MARGIN, bankY + 4.2);

  return doc.output('blob');
}
