import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const CHAT_ATTACHMENTS_BUCKET = 'intranet-chat-attachments';

const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXT = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
]);

function extensionOf(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const i = base.lastIndexOf('.');
  return i >= 0 ? base.slice(i + 1).toLowerCase() : '';
}

/** Erro humano ou null se válido. */
export function validateChatAttachmentFile(file: File): string | null {
  if (file.size > MAX_BYTES) {
    return `Ficheiro demasiado grande (máx. ${Math.round(MAX_BYTES / (1024 * 1024))} MB).`;
  }
  if (file.type.startsWith('image/')) {
    return null;
  }
  const ext = extensionOf(file.name);
  if (!ext || !ALLOWED_EXT.has(ext)) {
    return 'Tipo não permitido. Use PDF, imagem (PNG, JPG, GIF, WebP) ou Office (DOC, DOCX, XLS, XLSX, PPT, PPTX).';
  }
  return null;
}

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'ficheiro';
  return base.replace(/[^\w.\-À-ÿ\s]+/g, '_').trim().slice(0, 160) || 'ficheiro';
}

export async function uploadChatAttachment(
  client: SupabaseClient<Database>,
  conversationId: string,
  file: File,
): Promise<{ publicUrl: string; storagePath: string }> {
  const err = validateChatAttachmentFile(file);
  if (err) throw new Error(err);

  const safe = sanitizeFilename(file.name);
  const storagePath = `${conversationId}/${crypto.randomUUID()}_${safe}`;

  const { error: upErr } = await client.storage.from(CHAT_ATTACHMENTS_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (upErr) throw new Error(upErr.message || 'Falha no envio do anexo.');

  const { data } = client.storage.from(CHAT_ATTACHMENTS_BUCKET).getPublicUrl(storagePath);
  const publicUrl = data.publicUrl;
  if (!publicUrl) throw new Error('URL pública do anexo indisponível.');
  return { publicUrl, storagePath };
}
