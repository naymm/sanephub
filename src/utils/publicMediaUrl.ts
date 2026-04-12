/**
 * Normaliza URLs de ficheiros públicos (ex.: Supabase Storage) para o ambiente actual.
 * Em PWA / produção, caminhos do proxy de dev (`/__supabase`) ou origins locais
 * deixam de ser válidos — o browser não consegue carregar as imagens.
 */
const supabaseBase = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export function normalizePublicMediaUrl(url: string | null | undefined): string | undefined {
  if (url == null) return undefined;
  const u = String(url).trim();
  if (!u) return undefined;
  if (u.startsWith('blob:') || u.startsWith('data:')) return u;

  if (u.startsWith('/__supabase')) {
    if (supabaseBase) return `${supabaseBase}${u.slice('/__supabase'.length)}`;
    return u;
  }

  if (supabaseBase) {
    try {
      const parsed = new URL(u);
      const storagePath =
        parsed.pathname.includes('/storage/v1/object/public/') ||
        parsed.pathname.includes('/storage/v1/object/sign/');
      const loopback = ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
      if (storagePath && loopback) {
        const origin = new URL(supabaseBase).origin;
        return `${origin}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      /* URL relativa ou inválida */
    }
  }

  return u;
}
