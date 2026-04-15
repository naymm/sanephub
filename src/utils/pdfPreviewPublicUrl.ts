import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { normalizePublicMediaUrl } from '@/utils/publicMediaUrl';

const BUCKET = 'comprovativos' as const;
const PREFIX = 'capital-humano-preview';

export type PdfPreviewKind = 'recibo' | 'declaracao';

/** `crypto.randomUUID()` não existe ou rebenta em contextos não seguros (ex.: HTTP no telemóvel). */
function randomPreviewFileId(): string {
  try {
    const c = globalThis.crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* insecure context */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Envia o PDF gerado no browser para o Storage (URL HTTPS pública) para o iframe
 * carregar de forma fiável (mobile/PWA), alinhado com Finanças / comprovativos.
 * Se Supabase não estiver disponível ou o upload falhar, devolve `null`.
 */
export async function uploadPdfBlobForPreview(blob: Blob, kind: PdfPreviewKind): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  try {
    const path = `${PREFIX}/${kind}/${randomPreviewFileId()}.pdf`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (error) {
      console.warn('[pdfPreview]', error.message);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.warn('[pdfPreview]', e);
    return null;
  }
}

/** Preferir URL pública; caso contrário `blob:` local. Nunca lança (fallback seguro em mobile). */
export async function pdfPreviewUrlFromGeneratedBlob(blob: Blob, kind: PdfPreviewKind): Promise<string> {
  try {
    const publicUrl = await uploadPdfBlobForPreview(blob, kind);
    if (publicUrl) return publicUrl;
  } catch (e) {
    console.warn('[pdfPreview] pdfPreviewUrlFromGeneratedBlob', e);
  }
  return URL.createObjectURL(blob);
}

/**
 * `src` do iframe: normaliza origem Supabase em dev e força ajuste à largura no leitor PDF
 * (`#view=FitH`) — também para `blob:` dos recibos/declarações gerados no browser, onde antes
 * ficava tudo cortado à direita no mobile.
 */
export function resolvePdfIframeSrc(url: string | null | undefined): string | undefined {
  if (url == null || url === '') return undefined;
  const u = url.trim();
  if (u.includes('#')) {
    return u.startsWith('blob:') || u.startsWith('data:') ? u : normalizePublicMediaUrl(u) ?? u;
  }
  const base = u.startsWith('blob:') || u.startsWith('data:') ? u : normalizePublicMediaUrl(u) ?? u;
  if (/^(blob:|data:|https?:)/i.test(base)) {
    return `${base}#view=FitH`;
  }
  return base;
}

export function releasePdfPreviewUrl(url: string | null | undefined): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}
