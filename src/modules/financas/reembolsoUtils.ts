import type { Reembolso, StatusReembolso, TipoReembolso } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const REEMBOLSO_STATUS_OPTIONS: { value: StatusReembolso | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Em Análise', label: 'Em Análise' },
  { value: 'Aguarda Correcção', label: 'Aguarda Correcção' },
  { value: 'Aprovado', label: 'Aprovado' },
  { value: 'Rejeitado', label: 'Rejeitado' },
  { value: 'Pago', label: 'Pago' },
];

export type ReembolsoLinhaForm = {
  key: string;
  nomeEntidade: string;
  descricao: string;
  montante: number;
  reciboAnexos: string[];
};

export function nextReembolsoNum(reembolsos: Reembolso[]): string {
  const year = new Date().getFullYear();
  const prefix = `REB-${year}-`;
  const nums = reembolsos
    .filter(r => r.num.startsWith(prefix))
    .map(r => parseInt(r.num.split('-')[2], 10))
    .filter(n => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export function emptyLinhaForm(): ReembolsoLinhaForm {
  return {
    key: crypto.randomUUID(),
    nomeEntidade: '',
    descricao: '',
    montante: 0,
    reciboAnexos: [],
  };
}

export function sumLinhasMontante(linhas: readonly { montante: number }[]): number {
  return linhas.reduce((s, l) => s + (Number(l.montante) || 0), 0);
}

export function tipoReembolsoFromLinhas(count: number): TipoReembolso {
  return count <= 1 ? 'individual' : 'lote';
}

export function colaboradorPodeEditarReembolso(status: StatusReembolso): boolean {
  return status === 'Pendente' || status === 'Aguarda Correcção';
}

/** IBAN sem espaços, maiúsculas (valor gravado na BD). */
export function normalizarIbanReembolso(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Formato visual: AO06 0040 0000 3454 0250 1015 6 (grupos de 4). */
export function formatarIbanReembolso(iban: string): string {
  const raw = normalizarIbanReembolso(iban);
  if (!raw) return '';
  const parts: string[] = [];
  for (let i = 0; i < raw.length; i += 4) {
    parts.push(raw.slice(i, i + 4));
  }
  return parts.join(' ');
}

/** Máscara durante digitação/cola — mantém só alfanuméricos e reaplica espaços. */
export function mascaraIbanReembolsoEmEdicao(value: string, maxChars = 34): string {
  const raw = normalizarIbanReembolso(value).slice(0, maxChars);
  return formatarIbanReembolso(raw);
}

export const IBAN_REEMBOLSO_PLACEHOLDER = 'AO06 0040 0000 3454 0250 1015 6';

export function validarDadosPagamentoReembolso(nome: string, iban: string): string | null {
  if (!nome.trim()) return 'Indique o nome do titular para reembolso.';
  const ibanNorm = normalizarIbanReembolso(iban);
  if (!ibanNorm) return 'Indique o IBAN para reembolso.';
  if (ibanNorm.startsWith('AO') && ibanNorm.length !== 25) {
    return `IBAN angolano inválido. Use o formato ${IBAN_REEMBOLSO_PLACEHOLDER}.`;
  }
  if (ibanNorm.length < 15) return 'IBAN inválido (demasiado curto).';
  return null;
}

export async function uploadReciboReembolso(file: File, reembolsoId: number, linhaOrdem: number): Promise<string> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Upload requer Supabase configurado.');
  }
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
  const path = `reembolsos/recibos/reb-${reembolsoId}-linha-${linhaOrdem}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from('comprovativos').upload(path, file, { upsert: true });
  if (error || !data?.path) throw new Error(error?.message || 'Falha ao carregar o recibo.');
  const { data: pub } = supabase.storage.from('comprovativos').getPublicUrl(data.path);
  return pub.publicUrl;
}

export async function uploadComprovativoPagamentoReembolso(file: File, reembolsoId: number): Promise<string> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Upload requer Supabase configurado.');
  }
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
  const path = `reembolsos/pagamentos/reb-${reembolsoId}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from('comprovativos').upload(path, file, { upsert: true });
  if (error || !data?.path) throw new Error(error?.message || 'Falha ao carregar o comprovativo.');
  const { data: pub } = supabase.storage.from('comprovativos').getPublicUrl(data.path);
  return pub.publicUrl;
}
