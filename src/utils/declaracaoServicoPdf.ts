import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Declaracao, Colaborador } from '@/types';

function dataDeclaracao(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const dia = format(d, 'd', { locale: pt });
    const mes = format(d, 'MMMM', { locale: pt });
    const ano = format(d, 'yyyy', { locale: pt });
    const mesCapitalized = mes.charAt(0).toUpperCase() + mes.slice(1);
    return `Luanda aos, ${dia} de ${mesCapitalized} de ${ano}`;
  } catch {
    return 'Luanda aos, ___ de ___________ de ______';
  }
}

function dataShort(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: pt });
  } catch {
    return dateStr;
  }
}

function fmtSalario(n: number): string {
  const [int, dec] = n.toFixed(2).split('.');
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `AKZ. ${withDots},${dec}`;
}

function numeroParaExtenso(n: number): string {
  const int = Math.round(n);
  if (int === 0) return 'Zero';
  
  const unidade = ['', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove'];
  const dez = ['', 'Dez', 'Onze', 'Doze', 'Treze', 'Catorze', 'Quinze', 'Dezasseis', 'Dezassete', 'Dezoito', 'Dezanove'];
  const dezenas = ['', '', 'Vinte', 'Trinta', 'Quarenta', 'Cinquenta', 'Sessenta', 'Setenta', 'Oitenta', 'Noventa'];
  const centenas = ['', 'Cento', 'Duzentos', 'Trezentos', 'Quatrocentos', 'Quinhentos', 'Seiscentos', 'Setecentos', 'Oitocentos', 'Novecentos'];

  if (int < 10) return unidade[int];
  if (int < 20) return dez[int - 9];
  if (int < 100) {
    const d = Math.floor(int / 10);
    const u = int % 10;
    return dezenas[d] + (u > 0 ? ' e ' + unidade[u] : '');
  }
  if (int < 1000) {
    const c = Math.floor(int / 100);
    const rest = int % 100;
    const cent = c === 1 && rest === 0 ? 'Cem' : centenas[c];
    return cent + (rest > 0 ? ' e ' + numeroParaExtenso(rest) : '');
  }
  if (int < 1000000) {
    const mil = Math.floor(int / 1000);
    const rest = int % 1000;
    const milStr = mil === 1 ? 'Mil' : numeroParaExtenso(mil) + ' Mil';
    return milStr + (rest > 0 ? ' e ' + numeroParaExtenso(rest) : '');
  }
  return String(int);
}

function efeitosDeclaracao(declaracao: Declaracao): string {
  if (declaracao.tipo === 'Para Banco' && declaracao.descricao) {
    return `Para efeitos de ${declaracao.descricao}, junto da entidade bancária, declara-se que `;
  }
  if (declaracao.tipo === 'Para Banco') {
    return 'Para efeitos de actualização de conta, junto do Banco, declara-se que ';
  }
  if (declaracao.tipo === 'Rendimentos') {
    return 'Para efeitos de declaração de rendimentos, declara-se que ';
  }
  if (declaracao.tipo === 'Antiguidade') {
    return 'Para efeitos de comprovação de antiguidade, declara-se que ';
  }
  return 'Para os devidos efeitos, declara-se que ';
}

const ASSINATURA_NOME = 'Nestor Quindai';
const ASSINATURA_CARGO = 'Direcção de Capital Humano';

/**
 * Desenha uma linha de texto justificada (alinhada à esquerda e à direita).
 * Se for a última linha do parágrafo ou tiver uma só palavra, desenha alinhada à esquerda.
 */
function drawJustifiedLine(
  doc: jsPDF,
  line: string,
  x: number,
  y: number,
  lineWidth: number,
  isLastLine: boolean
): void {
  const words = line.trim().split(/\s+/);
  if (words.length <= 1 || isLastLine) {
    doc.text(line, x, y);
    return;
  }
  const totalWordsWidth = words.reduce((sum, w) => sum + doc.getTextWidth(w + ' '), 0) - doc.getTextWidth(' ');
  const totalSpaces = words.length - 1;
  const extraSpace = (lineWidth - totalWordsWidth) / totalSpaces;
  let currentX = x;
  for (let i = 0; i < words.length; i++) {
    doc.text(words[i], currentX, y);
    currentX += doc.getTextWidth(words[i]);
    if (i < words.length - 1) {
      currentX += doc.getTextWidth(' ') + extraSpace;
    }
  }
}

/**
 * Desenha um parágrafo justificado, sem indentação.
 */
function drawJustifiedParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  for (let i = 0; i < lines.length; i++) {
    drawJustifiedLine(doc, lines[i], x, y, maxWidth, i === lines.length - 1);
    y += lineHeight;
  }
  return y;
}

const A4_WIDTH_MM = 210;

export function gerarPdfDeclaracaoServico(declaracao: Declaracao, colaborador: Colaborador): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = A4_WIDTH_MM;
  const left = 25;
  const right = pageW - 25;
  const maxWidth = right - left;
  const fontSize = 11;
  const lineHeight = 6;
  let y = 28;

  // ---------- Título ----------
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.text('DECLARAÇÃO DE SERVIÇO', pageW / 2, y, { align: 'center' });
  y += 14;

  // ---------- Primeiro parágrafo (justificado) ----------
  doc.setFont('times', 'normal');
  doc.setFontSize(fontSize);

  const efeitos = efeitosDeclaracao(declaracao);
  const nascido = dataShort(colaborador.dataNascimento);
  const salarioFmt = fmtSalario(colaborador.salarioBase);
  const salarioExtenso = numeroParaExtenso(colaborador.salarioBase) + ' Kwanzas';

  const p1 = efeitos + 'o Sr. ' + colaborador.nome +
    ', nascido a ' + nascido +
    ', titular do B.I nº ' + colaborador.bi +
    ', emitido pelos serviços de identificação, residente em ' + colaborador.endereco +
    ', é trabalhador desta firma, exerce a função de ' + colaborador.cargo +
    ', e aufere um salário mensal de ' + salarioFmt +
    ' (' + salarioExtenso + ').';

  y = drawJustifiedParagraph(doc, p1, left, y, maxWidth, lineHeight);
  y += lineHeight;

  // ---------- Segundo parágrafo (justificado) ----------
  const p2 = 'Por ser verdade passou-se a presente declaração que será assinada e autenticada com carimbo a óleo, em uso nesta Instituição.';

  y = drawJustifiedParagraph(doc, p2, left, y, maxWidth, lineHeight);
  y += 18;

  // ---------- Data ----------
  const dataEmissao = declaracao.dataEmissao ?? declaracao.dataPedido;
  doc.setFontSize(12);
  doc.text(dataDeclaracao(dataEmissao), pageW / 2, y, { align: 'center' });
  y += 30;

  // ---------- Assinatura ----------
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  const lineSigW = 60;
  doc.line(pageW / 2 - lineSigW / 2, y, pageW / 2 + lineSigW / 2, y);
  
  y += 8;
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text(ASSINATURA_NOME, pageW / 2, y, { align: 'center' });
  
  y += 6;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(ASSINATURA_CARGO, pageW / 2, y, { align: 'center' });

  // Gerar o PDF
  doc.save(`Declaracao_Servico_${colaborador.nome.replace(/\s+/g, '_')}_${declaracao.id}.pdf`);
}