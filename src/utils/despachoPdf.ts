import { jsPDF } from 'jspdf';
import type { DocumentoOficial, Colaborador } from '@/types';
import type { AssinaturaDigitalInfo } from './declaracaoServicoPdf';

/**
 * Gera um PDF de Despacho (Nomeação / Exoneração) com layout próximo do modelo
 * oficial fornecido (título centrado, parágrafo introdutório, DETERMINO, etc.).
 */
export async function gerarPdfDespacho(
  despacho: DocumentoOficial,
  colaborador: Colaborador | null,
  assinatura: AssinaturaDigitalInfo,
  empresaNome?: string
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const left = 25;
  const right = pageW - 25;
  const maxWidth = right - left;
  const empresaLabel = empresaNome?.trim() || '';

  let y = 30;

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

  const linhasIntro = doc.splitTextToSize(paragrafoIntro, maxWidth);
  doc.text(linhasIntro, left, y);
  y += linhasIntro.length * 6 + 8;

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
    const empresaParte = empresaLabel ? `, da sociedade ${empresaLabel}` : '';
    texto.push(
      `É nomeado o Sr. ${nomeColab}, para exercer em comissão de serviço, a função de ${funcao}, na Direcção ${direccao}${empresaParte}` +
      `${despacho.acumulaFuncao ? ', acumulando assim, funções que tem desempenhado anteriormente.' : '.'}`
    );
  } else if (despacho.despachoTipo === 'Exoneração') {
    const nomeColab = colaborador?.nome ?? '________________';
    texto.push(
      `É o Sr. ${nomeColab}, exonerado do cargo que exercia,`,
      'produzindo este despacho efeitos a partir desta data.'
    );
    if (despacho.numeroEspacoExoneracao) {
      texto.push(`Registe-se no espaço de exoneração nº ${despacho.numeroEspacoExoneracao}.`);
    }
  } else {
    texto.push('Despacho emitido para os devidos efeitos internos.');
  }

  texto.forEach((paragrafo) => {
    const lines = doc.splitTextToSize(paragrafo, maxWidth);
    doc.text(lines, left, y);
    y += lines.length * 6 + 2;
  });

  // Local e data
  y += 5;
  doc.text('O presente despacho entra imediatamente em vigor.', left, y);
  y += 10;
  doc.text('CUMPRA-SE E PUBLIQUE-SE.', left, y);
  y += 16;

  // Local e data (simples; pode ser melhorado para data por extenso)
  doc.text(`Luanda, ${despacho.data}`, left, y);
  y += 24;

  // Assinatura
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

  const baseNome = despacho.numero.replace(/[^\w]/g, '_');
  doc.save(`Despacho_${baseNome}.pdf`);
}

