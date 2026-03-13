import { jsPDF } from 'jspdf';
import type { DocumentoOficial, Colaborador } from '@/types';
import type { AssinaturaDigitalInfo } from './declaracaoServicoPdf';

type JsPDFDoc = InstanceType<typeof jsPDF>;

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Formata uma data para "12 de Março de 2026". Aceita ISO (YYYY-MM-DD) ou string legível. */
function formatarDataPorExtenso(data: string | undefined | null): string {
  if (!data || !data.trim()) return '________________';
  const s = data.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoMatch) {
    const dia = parseInt(isoMatch[3], 10);
    const mes = MESES_PT[parseInt(isoMatch[2], 10) - 1];
    const ano = parseInt(isoMatch[1], 10);
    if (mes && dia >= 1 && dia <= 31) return `${dia} de ${mes} de ${ano}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return data;
  const dia = d.getDate();
  const mes = MESES_PT[d.getMonth()];
  const ano = d.getFullYear();
  return `${dia} de ${mes} de ${ano}`;
}

/** Desenha um parágrafo com segmentos em negrito ou normal, justificado em maxWidth. Retorna o y final. */
function drawMixedBoldParagraph(
  doc: JsPDFDoc,
  left: number,
  y: number,
  maxWidth: number,
  lineStep: number,
  segments: { text: string; bold: boolean }[]
): number {
  // 1. Flatten segments into tokens { word, bold }[]
  const tokens: { word: string; bold: boolean }[] = [];
  for (const seg of segments) {
    if (!seg.text) continue;
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      tokens.push({ word, bold: seg.bold });
    }
  }
  if (!tokens.length) return y + lineStep;

  doc.setFont('times', 'normal');
  const spaceBase = doc.getTextWidth(' ');

  // 2. Build lines (each line fits in maxWidth)
  const lines: { word: string; bold: boolean }[][] = [];
  let currentLine: { word: string; bold: boolean }[] = [];
  let currentWidth = 0;

  for (const token of tokens) {
    doc.setFont('times', token.bold ? 'bold' : 'normal');
    const w = doc.getTextWidth(token.word);
    const gaps = currentLine.length;
    const tentativeWidth = currentWidth + (gaps > 0 ? spaceBase : 0) + w;
    if (tentativeWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [token];
      currentWidth = w;
    } else {
      currentLine.push(token);
      currentWidth = tentativeWidth;
    }
  }
  if (currentLine.length) lines.push(currentLine);

  // 3. Draw lines (justified except last)
  let lineY = y;
  for (let i = 0; i < lines.length; i++) {
    const lineTokens = lines[i];
    const isLastLine = i === lines.length - 1;
    const n = lineTokens.length;

    if (n === 1 || isLastLine) {
      let x = left;
      for (const t of lineTokens) {
        doc.setFont('times', t.bold ? 'bold' : 'normal');
        doc.text(t.word, x, lineY);
        x += doc.getTextWidth(t.word) + spaceBase;
      }
    } else {
      let wordsWidth = 0;
      for (const t of lineTokens) {
        doc.setFont('times', t.bold ? 'bold' : 'normal');
        wordsWidth += doc.getTextWidth(t.word);
      }
      const gaps = n - 1;
      const extraTotal = Math.max(maxWidth - wordsWidth - gaps * spaceBase, 0);
      const spaceWidth = spaceBase + extraTotal / gaps;
      let x = left;
      for (let j = 0; j < lineTokens.length; j++) {
        const t = lineTokens[j];
        doc.setFont('times', t.bold ? 'bold' : 'normal');
        doc.text(t.word, x, lineY);
        x += doc.getTextWidth(t.word);
        if (j < lineTokens.length - 1) x += spaceWidth;
      }
    }
    lineY += lineStep;
  }
  return lineY;
}

/** Desenha um parágrafo justificado (alinhado à esquerda e à direita) dentro de maxWidth. Retorna o y final. */
function drawJustifiedParagraph(
  doc: JsPDFDoc,
  left: number,
  y: number,
  maxWidth: number,
  lineStep: number,
  text: string
): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return y;

  const spaceBase = doc.getTextWidth(' ');
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentWidth = 0;

  for (const word of words) {
    const w = doc.getTextWidth(word);
    const spaces = currentLine.length; // spaces already in line
    const tentativeWidth = currentWidth + (spaces > 0 ? spaceBase : 0) + w;
    if (tentativeWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [word];
      currentWidth = w;
    } else {
      if (currentLine.length === 0) {
        currentLine.push(word);
        currentWidth = w;
      } else {
        currentLine.push(word);
        currentWidth = tentativeWidth;
      }
    }
  }
  if (currentLine.length) {
    lines.push(currentLine);
  }

  let lineY = y;
  doc.setFont('times', 'normal');
  for (let i = 0; i < lines.length; i++) {
    const lineWords = lines[i];
    const isLastLine = i === lines.length - 1;
    if (lineWords.length === 1 || isLastLine) {
      // Última linha (ou linha com uma só palavra): alinhamento normal à esquerda
      let x = left;
      for (let j = 0; j < lineWords.length; j++) {
        const word = lineWords[j];
        doc.text(word, x, lineY);
        x += doc.getTextWidth(word) + spaceBase;
      }
    } else {
      // Linhas intermédias: justificar distribuindo o espaço extra
      const wordsWidth = lineWords.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
      const gaps = lineWords.length - 1;
      const baseWidth = wordsWidth + gaps * spaceBase;
      const extraTotal = Math.max(maxWidth - baseWidth, 0);
      const extraPerGap = gaps > 0 ? extraTotal / gaps : 0;
      const spaceWidth = spaceBase + extraPerGap;

      let x = left;
      for (let j = 0; j < lineWords.length; j++) {
        const word = lineWords[j];
        doc.text(word, x, lineY);
        x += doc.getTextWidth(word);
        if (j < lineWords.length - 1) {
          x += spaceWidth;
        }
      }
    }
    lineY += lineStep;
  }

  return lineY;
}

/**
 * Gera um PDF de Despacho (Nomeação / Exoneração) com layout próximo do modelo
 * oficial fornecido (título centrado, parágrafo introdutório, DETERMINO, etc.).
 */
export async function gerarPdfDespacho(
  despacho: DocumentoOficial,
  colaborador: Colaborador | null,
  assinatura?: AssinaturaDigitalInfo | null,
  empresaNome?: string
): Promise<string> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 25;
  const right = pageW - 25;
  const maxWidth = right - left;
  const empresaLabel = empresaNome?.trim() || '';

  // Fundo: folha.jpg (em public/folha.jpg), a cobrir toda a página
  try {
    const imgRes = await fetch('/folha.jpg');
    if (imgRes.ok) {
      const blob = await imgRes.blob();
      const mime = blob.type || 'image/jpeg';
      const format = mime.includes('png') ? 'PNG' : 'JPEG';
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      doc.addImage(dataUrl, format, 0, 0, pageW, pageH);
    }
  } catch {
    // Se folha.jpg não existir ou falhar o carregamento, o PDF é gerado sem fundo
  }

  // Espaçamento entre linhas: 1.5 (altura base ~6mm × 1.5 = 9mm por linha)
  const lineHeightBase = 6;
  const lineSpacing = 0.7;
  const lineStep = lineHeightBase * lineSpacing;

  let y = 50;

  // Linha de número do despacho (centrada)
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text(
    `DESPACHO Nº ${despacho.numero}`,
    pageW / 2,
    y,
    { align: 'center' }
  );
  y += 8;

  // Subtítulo (ex.: Despacho de Exoneração / Nomeação)
  doc.setFontSize(11);
  doc.text(
    despacho.titulo || (despacho.despachoTipo === 'Exoneração' ? 'Despacho de Exoneração' : 'Despacho de Nomeação'),
    pageW / 2,
    y,
    { align: 'center' }
  );
  y += 8;

  // Linha com a empresa (se existir)

    y += 10;


  // Corpo — parágrafo introdutório
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  const paragrafoIntro =
    'Em conformidade com o plano de reestruturação orgânica do GRUPO SANEP e no sentido de garantir ' +
    'a implementação dos manuais, regulamentos e normativos vigentes pelo Conselho de Administração para o efeito, ' +
    'usando das faculdades que me são conferidas pelos estatutos, regulamentos e normativos vigentes, como Presidente ' +
    'do Conselho de Administração;';

  y = drawJustifiedParagraph(doc, left, y, maxWidth, lineStep, paragrafoIntro);
  y += 8;

  // Título "DETERMINO:"
  doc.setFont('times', 'bold');
  doc.text('DETERMINO:', left, y);
  y += 10;

  // Corpo específico (nomeação / exoneração)
  doc.setFont('times', 'normal');
  const texto: string[] = [];

  if (despacho.despachoTipo === 'Nomeação') {
    const nomeColab = colaborador?.nome ?? '________________';
    const funcao = despacho.funcao ?? '__________';
    const direccao = despacho.direccao ?? '__________';
    const tratamento = despacho.tratamento === 'Sr(a).' ? 'a Sra.' : 'o Sr.';
    const verboNomeacao = despacho.tratamento === 'Sr(a).' ? 'É nomeada ' : 'É nomeado ';
    const segmentsNomeacao: { text: string; bold: boolean }[] = [
      { text: `${verboNomeacao}${tratamento} `, bold: false },
      { text: nomeColab, bold: true },
      { text: ', para exercer em comissão de serviço, a função de ', bold: false },
      { text: funcao, bold: true },
      { text: ', na', bold: false },
      { text: direccao, bold: true },
      ...(empresaLabel
        ? [
            { text: ', da sociedade ', bold: false },
            { text: empresaLabel, bold: true },
          ]
        : []),
      {
        text: despacho.acumulaFuncao
          ? ', acumulando assim, funções que tem desempenhado anteriormente.'
          : ', cessando assim, todas as funções desempenhadas anteriormente.',
        bold: false,
      },
    ];
    y = drawMixedBoldParagraph(doc, left, y, maxWidth, lineStep, segmentsNomeacao);
    y += 2;
  } else {
    if (despacho.despachoTipo === 'Exoneração') {
      const nomeColab = colaborador?.nome ?? '________________';
      const tratamentoExo = despacho.tratamento === 'Sr(a).' ? 'a Sra.' : 'o Sr.';
      const exonerado = despacho.tratamento === 'Sr(a).' ? 'exonerada' : 'exonerado';
      const queNomeou = despacho.tratamento === 'Sr(a).' ? 'que a nomeou' : 'que o nomeou';
      const funcao = despacho.funcao?.trim() || '________________';
      const direccao = despacho.direccao?.trim() || '________________';
      const empresaParte = empresaLabel ? ` ${empresaLabel}` : '';
      const numeroRef = despacho.numeroEspacoExoneracao?.trim() || '______';
      const dataRefExtenso = formatarDataPorExtenso(despacho.dataReferenciaNomeacao);
      const segmentsExoneracao: { text: string; bold: boolean }[] = [
        { text: 'É ', bold: false },
        { text: tratamentoExo, bold: true },
        { text: ' ', bold: false },
        { text: nomeColab, bold: true },
        { text: ', ', bold: false },
        { text: exonerado, bold: false },
        { text: ' do cargo que exercia como ', bold: false },
        { text: funcao, bold: true },
        { text: ' ', bold: false },
        { text: direccao, bold: true },
        ...(empresaParte
          ? [
              { text: empresaParte, bold: true },
            ]
          : []),
        { text: ', em virtude do Despacho N ° ', bold: false },
        { text: numeroRef, bold: true },
        { text: ' ', bold: false },
        { text: queNomeou, bold: false },
        { text: ', desde o dia ', bold: false },
        { text: dataRefExtenso, bold: false },
        {
          text: ', e por sua vez, cessam imediatamente todas as funções outrora desempenhadas.',
          bold: false,
        },
      ];
      y = drawMixedBoldParagraph(doc, left, y, maxWidth, lineStep, segmentsExoneracao);
      y += 2;
    } else {
      texto.push('Despacho emitido para os devidos efeitos internos.');
      texto.forEach((paragrafo) => {
        const lines = doc.splitTextToSize(paragrafo, maxWidth);
        doc.text(lines, left, y);
        y += lines.length * lineStep + 2;
      });
    }
  }

  // Local e data
  y += 5;
  doc.text('O presente despacho entra imediatamente em vigor.', left, y);
  y += 10;
  doc.text('CUMPRA-SE E PUBLIQUE-SE.', left, y);
  y += 16;

  // Local e data (por extenso: "12 de Março de 2026")
  const dataExtenso = formatarDataPorExtenso(despacho.data);
  doc.text(`Luanda, aos ${dataExtenso}`, left, y);
  y += 24;

  // Assinatura (apenas se fornecida — por exemplo, depois do PCA assinar)
  if (assinatura) {
    const nomeAssinatura = assinatura.linha?.trim() || '_______________________';
    const cargoAssinatura = assinatura.cargo?.trim() || '';
    const sigUrl = assinatura.imagemUrl?.trim() || '';

    // Reservar área para assinatura: imagem (se houver) por cima da linha
    const lineSigY = y + 10;
    const lineSigW = 60;

    if (sigUrl) {
      try {
        const imgRes = await fetch(sigUrl);
        const blob = await imgRes.blob();
        const mime = blob.type || 'image/png';
        const format = mime.includes('jpeg') || mime.includes('jpg') ? 'JPEG' : 'PNG';
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const sigW = 45;
        const sigH = 30;
        // imagem centrada, sobrepondo a linha (linha passa sensivelmente a meio da imagem)
        const imgY = lineSigY - sigH / 2;
        doc.addImage(dataUrl, format, pageW / 2 - sigW / 2, imgY, sigW, sigH);
      } catch {
        // Se falhar o carregamento da imagem, segue apenas com linha + texto
      }
    }

    // Linha de assinatura
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(pageW / 2 - lineSigW / 2, lineSigY, pageW / 2 + lineSigW / 2, lineSigY);

    // Nome imediatamente abaixo da linha
    y = lineSigY + 6;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text(nomeAssinatura, pageW / 2, y, { align: 'center' });

    if (cargoAssinatura) {
      y += 6;
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text(cargoAssinatura, pageW / 2, y, { align: 'center' });
    }
  }

  // Devolve um blob URL (string) para ser usado em pré-visualização (por exemplo, num modal com <iframe />)
  const blobUrl = doc.output('bloburl');
  return typeof blobUrl === 'string' ? blobUrl : String(blobUrl);
}

