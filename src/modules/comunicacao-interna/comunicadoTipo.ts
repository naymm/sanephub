import type { ComunicadoTipo } from '@/types';

export const COMUNICADO_TIPO_OPTIONS: { value: ComunicadoTipo; label: string }[] = [
  { value: 'feriado', label: 'Feriado' },
  { value: 'tolerancia_ponto', label: 'Tolerância de ponto' },
  { value: 'situacao_interna', label: 'Situação interna' },
  { value: 'nova_contratacao', label: 'Nova contratação' },
  { value: 'nomeacao', label: 'Nomeação' },
  { value: 'exoneracao', label: 'Exoneração' },
  { value: 'demissao', label: 'Demissão' },
  { value: 'outro', label: 'Outro' },
];

export function labelComunicadoTipo(tipo: string): string {
  return COMUNICADO_TIPO_OPTIONS.find(o => o.value === tipo)?.label ?? tipo;
}
