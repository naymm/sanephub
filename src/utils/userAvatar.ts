import type { Usuario } from '@/types';
import { normalizePublicMediaUrl } from '@/utils/publicMediaUrl';

export function looksLikeAvatarPhoto(s?: string | null): boolean {
  const t = s?.trim();
  if (!t || t === '?') return false;
  return (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('/') ||
    t.startsWith('blob:') ||
    t.startsWith('data:')
  );
}

function initialsFromNome(nome: string | undefined): string {
  const parts = nome?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

/** URL da fotografia de perfil (normalizada para PWA), ou undefined se só iniciais/texto. */
export function userAvatarImageSrc(
  user: Pick<Usuario, 'avatar' | 'fotoPerfilUrl'> | null | undefined,
): string | undefined {
  const fotoColab = user?.fotoPerfilUrl?.trim();
  if (fotoColab && looksLikeAvatarPhoto(fotoColab)) {
    return normalizePublicMediaUrl(fotoColab) ?? fotoColab;
  }
  const raw = user?.avatar?.trim();
  if (!raw || !looksLikeAvatarPhoto(raw)) return undefined;
  return normalizePublicMediaUrl(raw) ?? raw;
}

/** Texto para AvatarFallback (iniciais do campo avatar ou derivadas do nome). */
export function userAvatarFallbackLabel(
  user: Pick<Usuario, 'avatar' | 'nome'> | null | undefined,
): string {
  if (!user) return '?';
  const raw = user.avatar?.trim();
  if (raw && !looksLikeAvatarPhoto(raw) && raw !== '?') {
    return raw.slice(0, 2).toUpperCase();
  }
  return initialsFromNome(user.nome);
}
