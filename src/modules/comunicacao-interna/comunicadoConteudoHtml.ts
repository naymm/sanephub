import DOMPurify from 'dompurify';

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Conteúdo novo (Tiptap) em HTML vs texto simples legado. */
export function comunicadoConteudoIsHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s.trim());
}

/** Converte texto plano da base para HTML inicial do editor. */
export function comunicadoConteudoToEditorHtml(s: string): string {
  if (!s.trim()) return '';
  if (comunicadoConteudoIsHtml(s)) return s;
  return `<p>${escapeHtmlText(s).replace(/\n/g, '<br>')}</p>`;
}

/** Texto plano para pesquisa / pré-visualização em cartões. */
export function comunicadoConteudoToPlainText(s: string): string {
  if (!s.trim()) return '';
  if (!comunicadoConteudoIsHtml(s)) return s;
  const d = document.createElement('div');
  d.innerHTML = s;
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

export function sanitizeComunicadoHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
