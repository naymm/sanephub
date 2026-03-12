import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Declaracao, Colaborador, Usuario } from '@/types';

function dataDeclaracao(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const dia = format(d, 'dd', { locale: pt });
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
  if (declaracao.tipo === 'Para Banco') {
    const banco = declaracao.banco ? ` ${declaracao.banco}` : '';
    return `Para efeitos de actualização de conta, junto do Banco${banco}, declara-se que `;
  }
  if (declaracao.tipo === 'Embaixada' && declaracao.paisEmbaixada) {
    return `Para efeitos junto da Embaixada (${declaracao.paisEmbaixada}), declara-se que `;
  }
  if (declaracao.tipo === 'Embaixada') {
    return 'Para efeitos junto da Embaixada, declara-se que ';
  }
  if (declaracao.tipo === 'Rendimentos') {
    return 'Para efeitos de declaração de rendimentos, declara-se que ';
  }
  return 'Para os devidos efeitos, declara-se que ';
}

const ASSINATURA_NOME_DEFAULT = 'Nestor Quindai';
const ASSINATURA_CARGO_DEFAULT = 'Direcção de Capital Humano';

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

/** Indica se o intervalo [start, end) intersecta algum dos intervalos em boldRanges. */
function isBoldRange(start: number, end: number, boldRanges: [number, number][]): boolean {
  return boldRanges.some(([s, e]) => start < e && end > s);
}

/**
 * Desenha uma linha justificada com partes em negrito (por palavra).
 * wordBoldFlags[i] = true se a palavra i deve ser negrito.
 */
function drawJustifiedLineWithBold(
  doc: jsPDF,
  line: string,
  wordBoldFlags: boolean[],
  x: number,
  y: number,
  lineWidth: number,
  isLastLine: boolean
): void {
  const words = line.trim().split(/\s+/);
  if (words.length <= 1 || isLastLine) {
    for (let i = 0; i < words.length; i++) {
      doc.setFont('times', wordBoldFlags[i] ? 'bold' : 'normal');
      doc.text(words[i], x, y);
      x += doc.getTextWidth(words[i] + (i < words.length - 1 ? ' ' : ''));
    }
    doc.setFont('times', 'normal');
    return;
  }
  let totalWidth = 0;
  for (let i = 0; i < words.length; i++) {
    doc.setFont('times', wordBoldFlags[i] ? 'bold' : 'normal');
    totalWidth += doc.getTextWidth(words[i]);
    if (i < words.length - 1) totalWidth += doc.getTextWidth(' ');
  }
  doc.setFont('times', 'normal');
  const totalSpaces = words.length - 1;
  const extraSpace = (lineWidth - totalWidth) / totalSpaces;
  let currentX = x;
  for (let i = 0; i < words.length; i++) {
    doc.setFont('times', wordBoldFlags[i] ? 'bold' : 'normal');
    doc.text(words[i], currentX, y);
    currentX += doc.getTextWidth(words[i]);
    if (i < words.length - 1) {
      currentX += doc.getTextWidth(' ') + extraSpace;
    }
  }
  doc.setFont('times', 'normal');
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

/**
 * Desenha um parágrafo justificado com trechos em negrito (nome, salarioFmt, salarioExtenso).
 */
function drawJustifiedParagraphWithBold(
  doc: jsPDF,
  fullText: string,
  boldRanges: [number, number][],
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(fullText, maxWidth);
  let lineStartIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const words = line.trim().split(/\s+/);
    const wordBoldFlags: boolean[] = [];
    let charIdx = lineStartIdx;
    for (const w of words) {
      const wordStart = fullText.indexOf(w, charIdx);
      if (wordStart === -1) {
        wordBoldFlags.push(false);
        charIdx = lineStartIdx + line.length;
        continue;
      }
      const wordEnd = wordStart + w.length;
      wordBoldFlags.push(isBoldRange(wordStart, wordEnd, boldRanges));
      charIdx = wordEnd + (wordEnd < fullText.length && fullText[wordEnd] === ' ' ? 1 : 0);
    }
    drawJustifiedLineWithBold(doc, line, wordBoldFlags, x, y, maxWidth, i === lines.length - 1);
    y += lineHeight;
    lineStartIdx = fullText.indexOf(lines[i].trim(), lineStartIdx) + lines[i].trim().length;
    if (lineStartIdx < fullText.length && fullText[lineStartIdx] === ' ') lineStartIdx += 1;
  }
  return y;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/** Carrega uma imagem do servidor e devolve como data URL (base64) para usar no jsPDF. */
function loadImageAsDataUrl(url: string): Promise<string> {
  return fetch(url)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    );
}

export interface AssinaturaDigitalInfo {
  linha?: string;
  cargo?: string;
  imagemUrl?: string;
}

export async function gerarPdfDeclaracaoServico(
  declaracao: Declaracao,
  colaborador: Colaborador,
  assinatura?: AssinaturaDigitalInfo
): Promise<void> {
  let imgData: string | null = null;
  let carimboData: string | null = null;
  let assinaturaData: string | null = null;
  try {
    imgData = await loadImageAsDataUrl('/folha.jpg');
  } catch {
    // Se a imagem não carregar (ex.: desenvolvimento sem public), gera o PDF sem fundo
  }
  try {
    carimboData = await loadImageAsDataUrl('/carimbo-capital-humano.png');
  } catch {
    // Carimbo opcional
  }
  const assinaturaUrl = assinatura?.imagemUrl?.trim() || '/assinatura-digital.png';
  try {
    assinaturaData = await loadImageAsDataUrl(assinaturaUrl);
  } catch {
    // Assinatura opcional
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = A4_WIDTH_MM;
  const left = 25;
  const right = pageW - 25;
  const maxWidth = right - left;
  const fontSize = 11;
  const lineHeight = 6;
  let y = 28;

  // ---------- Fundo A4 (folha.jpg) ----------
  if (imgData) {
    doc.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
  }

  y += 30;
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

  const iNome = p1.indexOf(colaborador.nome);
  const iSalarioFmt = p1.indexOf(salarioFmt);
  const iSalarioExtenso = p1.indexOf(salarioExtenso);
  const boldRanges: [number, number][] = [];
  if (iNome >= 0) boldRanges.push([iNome, iNome + colaborador.nome.length]);
  if (iSalarioFmt >= 0) boldRanges.push([iSalarioFmt, iSalarioFmt + salarioFmt.length]);
  if (iSalarioExtenso >= 0) boldRanges.push([iSalarioExtenso, iSalarioExtenso + salarioExtenso.length]);

  y = drawJustifiedParagraphWithBold(doc, p1, boldRanges, left, y, maxWidth, lineHeight);
  y += lineHeight;

  // ---------- Segundo parágrafo (justificado) ----------
  const p2 = 'Por ser verdade passou-se a presente declaração que será assinada e autenticada com carimbo a óleo, em uso nesta Instituição.';

  y = drawJustifiedParagraph(doc, p2, left, y, maxWidth, lineHeight);
  y += 18;

  // ---------- Data ----------
  const dataEmissao = declaracao.dataEmissao ?? declaracao.dataPedido;
  doc.setFontSize(12);
  doc.text(dataDeclaracao(dataEmissao), pageW / 2, y, { align: 'center' });
  y += 20;

  // ---------- Assinatura e carimbo ----------
  const lineSigY = y;
  const lineSigW = 60;
  const carimboW = 42;
  const carimboH = 25;

  if (carimboData) {
    doc.addImage(carimboData, 'PNG', right-carimboW, lineSigY - carimboH + 4, carimboW, carimboH);
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - lineSigW / 2, lineSigY, pageW / 2 + lineSigW / 2, lineSigY);

  if (assinaturaData) {
    const sigW = 50;
    const sigH = 34;
    doc.addImage(assinaturaData, 'PNG', pageW / 2 - sigW / 2, lineSigY - sigH, sigW, sigH);
  }

  y += 8;
  const nomeAssinatura = assinatura?.linha?.trim() || ASSINATURA_NOME_DEFAULT;
  const cargoAssinatura = assinatura?.cargo?.trim() || ASSINATURA_CARGO_DEFAULT;

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text(nomeAssinatura, pageW / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(cargoAssinatura, pageW / 2, y, { align: 'center' });

  // Gerar o PDF
  doc.save(`Declaracao_Servico_${colaborador.nome.replace(/\s+/g, '_')}_${declaracao.id}.pdf`);
}