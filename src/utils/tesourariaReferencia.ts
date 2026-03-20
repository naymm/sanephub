import type { MovimentoTesouraria } from '@/types';

/** Gera a próxima referência TES-AAAA-E-NNNN ou TES-AAAA-S-NNNN por empresa. */
export function nextReferenciaTesouraria(
  prev: MovimentoTesouraria[],
  empresaId: number,
  tipo: 'entrada' | 'saida',
): string {
  const year = new Date().getFullYear();
  const prefix = `TES-${year}-${tipo === 'entrada' ? 'E' : 'S'}-`;
  const same = prev.filter(m => m.empresaId === empresaId && m.tipo === tipo && m.referencia.startsWith(`TES-${year}`));
  const nums = same.map(m => {
    const parts = m.referencia.split('-');
    return parseInt(parts[parts.length - 1], 10) || 0;
  });
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}
