/** Listas da secção 1 do relatório de planeamento (persistidas em colunas `text` como JSON). */

export function deserializePlaneamentoTextList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean);
  const s = String(raw);
  if (!s.trim()) return [];
  try {
    const p = JSON.parse(s);
    if (Array.isArray(p)) return p.map(v => String(v).trim()).filter(Boolean);
  } catch {
    /* texto legado em parágrafo único */
  }
  return [s.trim()];
}

/** Grava array como JSON na coluna texto (filtra linhas vazias). */
export function serializePlaneamentoTextList(arr: string[] | undefined): string {
  const cleaned = (arr ?? []).map(s => s.trim()).filter(Boolean);
  return JSON.stringify(cleaned);
}

/** Texto para PDF ou pré-visualização (bullet por linha). */
export function formatPlaneamentoTextListForDisplay(items: string[] | string): string {
  const list = Array.isArray(items) ? items : items ? deserializePlaneamentoTextList(items) : [];
  const cleaned = list.map(s => s.trim()).filter(Boolean);
  if (!cleaned.length) return '';
  return cleaned.map(line => `• ${line}`).join('\n');
}
