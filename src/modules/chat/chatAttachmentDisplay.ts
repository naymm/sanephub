import type { ChatAttachment } from '@/types/chat';

export type ChatAttachmentDisplayKind = 'image' | 'pdf' | 'office' | 'other';

export function chatAttachmentDisplayKind(att: ChatAttachment): ChatAttachmentDisplayKind {
  const lower = (att.name ?? '').toLowerCase();
  const url = (att.url ?? '').toLowerCase();
  if (att.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(lower)) return 'image';
  if (lower.endsWith('.pdf') || att.type === 'application/pdf' || url.includes('.pdf')) return 'pdf';
  if (/\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(lower)) return 'office';
  return 'other';
}

export function canUseMicrosoftViewerForAttachment(att: ChatAttachment): boolean {
  if (chatAttachmentDisplayKind(att) !== 'office') return false;
  const u = att.url ?? '';
  return u.startsWith('http://') || u.startsWith('https://');
}
