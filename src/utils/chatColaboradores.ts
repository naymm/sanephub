import type { Usuario } from '@/types';

/**
 * Chat interno: qualquer utilizador autenticado pode participar, sem filtro por empresa ou perfil.
 * (Nome `conversaSoEntreColaboradores` mantido por compatibilidade com imports existentes.)
 */

/** Qualquer utilizador com sessão pode usar o Chat. */
export function podeAcederAoChat(user: Usuario | null | undefined): boolean {
  return user != null && user.id != null;
}

/** Par válido: outro utilizador diferente do actual (qualquer empresa, qualquer perfil). */
export function eParColaboradorNoChat(current: Usuario | null | undefined, other: Usuario): boolean {
  if (!current || other.id === current.id) return false;
  return true;
}

/** Lista para «Nova conversa»: todos os utilizadores excepto o actual. */
export function usuariosColaboradoresParaChat(current: Usuario | null | undefined, todos: Usuario[]): Usuario[] {
  if (!podeAcederAoChat(current)) return [];
  return todos.filter(u => u.id !== current?.id && eParColaboradorNoChat(current, u));
}

/** Conversa válida na UI: todos os IDs de participantes existem na lista de utilizadores carregada. */
export function conversaSoEntreColaboradores(participantIds: number[], usuarios: Usuario[]): boolean {
  if (participantIds.length === 0) return false;
  for (const id of participantIds) {
    if (!usuarios.some(x => x.id === id)) return false;
  }
  return true;
}
