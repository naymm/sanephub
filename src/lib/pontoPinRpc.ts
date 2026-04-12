import type { SupabaseClient } from '@supabase/supabase-js';

/** PIN de marcação de ponto (validação no servidor). */
export const PONTO_PIN_LENGTH = 4;

export async function rpcPerfilTemPontoPin(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc('perfil_tem_ponto_pin');
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function rpcVerificarMeuPontoPin(client: SupabaseClient, pinPlain: string): Promise<boolean> {
  const { data, error } = await client.rpc('verificar_meu_ponto_pin', { pin_plain: pinPlain });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function rpcDefinirMeuPontoPin(client: SupabaseClient, pinPlain: string): Promise<void> {
  const { error } = await client.rpc('definir_meu_ponto_pin', { pin_plain: pinPlain });
  if (error) throw new Error(error.message);
}

export async function rpcAlterarMeuPontoPin(
  client: SupabaseClient,
  pinAtual: string,
  pinNovo: string,
): Promise<void> {
  const { error } = await client.rpc('alterar_meu_ponto_pin', {
    pin_atual: pinAtual,
    pin_novo: pinNovo,
  });
  if (error) throw new Error(error.message);
}
