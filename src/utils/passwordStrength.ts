/** Comprimento mínimo aceite para nova senha (alinhado com política da app). */
export const SENHA_MIN_CARACTERES = 8;

export type NivelForcaSenha = 'fraca' | 'media' | 'forte';

export type ResultadoForcaSenha = {
  nivel: NivelForcaSenha;
  /** 0–6: comprimento, maiúsculas, minúsculas, dígitos, símbolos, comprimento extra. */
  pontos: number;
};

/**
 * Avalia força da senha para feedback ao utilizador (não substitui validação no servidor).
 * Fraca: &lt; 8 caracteres ou pouca variedade; média: 8+ com alguma variedade; forte: 8+ com boa variedade.
 */
export function avaliarForcaSenha(senha: string): ResultadoForcaSenha {
  const s = senha;
  let pontos = 0;
  if (s.length >= SENHA_MIN_CARACTERES) pontos += 1;
  if (s.length >= 12) pontos += 1;
  if (/[a-z]/.test(s)) pontos += 1;
  if (/[A-Z]/.test(s)) pontos += 1;
  if (/[0-9]/.test(s)) pontos += 1;
  if (/[^a-zA-Z0-9]/.test(s)) pontos += 1;

  let nivel: NivelForcaSenha;
  if (s.length < SENHA_MIN_CARACTERES || pontos <= 2) {
    nivel = 'fraca';
  } else if (pontos <= 4) {
    nivel = 'media';
  } else {
    nivel = 'forte';
  }

  return { nivel, pontos };
}

export function labelForcaSenha(nivel: NivelForcaSenha): string {
  switch (nivel) {
    case 'fraca':
      return 'Fraca';
    case 'media':
      return 'Média';
    case 'forte':
      return 'Forte';
    default:
      return '';
  }
}
