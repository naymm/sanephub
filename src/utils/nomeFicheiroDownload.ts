/**
 * Nome sugerido para descarga: título sanitizado + extensão do ficheiro original.
 */
export function nomeFicheiroParaDownload(titulo: string, nomeFicheiroOriginal: string): string {
  const orig = nomeFicheiroOriginal.trim() || 'ficheiro';
  const dot = orig.lastIndexOf('.');
  const ext = dot >= 0 ? orig.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/gi, '') : '';
  const fallbackBase = dot >= 0 ? orig.slice(0, dot) : orig;
  const raw = titulo.trim() || fallbackBase || 'documento';
  const sanitized = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\.+$/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  const base = sanitized || 'documento';
  return ext ? `${base}.${ext}` : base;
}
