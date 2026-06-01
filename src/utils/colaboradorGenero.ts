import type { Genero } from '@/types';

export const GENERO_OPTIONS: Genero[] = ['M', 'F', 'Outro'];

export function labelGenero(g: Genero | '' | null | undefined): string {
  if (g === 'M') return 'Masculino';
  if (g === 'F') return 'Feminino';
  if (g === 'Outro') return 'Outro';
  return '—';
}
