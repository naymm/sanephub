import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Obtém o nome da empresa no portal GUE. O pedido HTTP directo é feito na Edge Function
 * `gue-publicacao-nome` (sem allorigins): o browser chama o Supabase com JWT.
 */
export type ResultadoNomeGue = { nome: string | null; error?: string };

export async function fetchNomeEmpresaPorNifGue(
  supabase: SupabaseClient,
  nifRaw: string,
): Promise<ResultadoNomeGue> {
  const nif = nifRaw.replace(/\D/g, '');
  if (!nif) {
    return { nome: null, error: 'Indique um NIF (apenas dígitos).' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('gue-publicacao-nome', {
      body: { nif },
    });

    if (error) {
      return {
        nome: null,
        error: error.message || 'Falha ao consultar o serviço GUE. Faça deploy da função gue-publicacao-nome?',
      };
    }

    const payload = data as { nome?: string | null; error?: string } | null;
    if (!payload) {
      return { nome: null, error: 'Resposta vazia do servidor.' };
    }
    if (payload.error) {
      return { nome: null, error: payload.error };
    }
    const nome = typeof payload.nome === 'string' ? payload.nome.trim() : '';
    if (!nome) {
      return { nome: null, error: 'Nenhum nome devolvido.' };
    }
    return { nome };
  } catch (e) {
    return {
      nome: null,
      error: e instanceof Error ? e.message : 'Erro de rede ao consultar o GUE.',
    };
  }
}
