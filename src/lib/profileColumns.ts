/**
 * Colunas de `profiles` seguras para `select` no cliente.
 * Exclui segredos (ex.: `ponto_pin_hash`).
 */
export const PROFILES_SELECT_PUBLIC =
  'id, auth_user_id, nome, email, username, perfil, cargo, departamento, avatar, permissoes, modulos, colaborador_id, empresa_id, numero_mec, assinatura_linha, assinatura_cargo, assinatura_imagem_url, created_at, updated_at';
