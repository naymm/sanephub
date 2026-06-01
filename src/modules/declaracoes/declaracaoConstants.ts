import type { StatusDeclaracao, TipoDeclaracao } from '@/types';

export const DECLARACAO_TIPO_OPTIONS: TipoDeclaracao[] = ['Para Banco', 'Embaixada', 'Rendimentos', 'Outro'];

export const DECLARACAO_STATUS_OPTIONS: StatusDeclaracao[] = ['Pendente', 'Emitida', 'Entregue'];

export const DECLARACAO_BANCOS = [
  'BAI',
  'BANC',
  'BIC',
  'BCA',
  'BCI',
  'BDA',
  'BE',
  'BFA',
  'BIR',
  'BPA',
  'BPC',
  'BNI',
  'KEVE',
  'BPR',
  'BSOL',
  'BCGA',
  'BMA',
  'VTB',
  'ACCESS',
  'BMF',
  'BKI',
  'BCH',
  'SBA',
  'BPPH',
  'BVB',
];

export const DECLARACAO_PAISES_EMBAIXADA = ['ESPANHA', 'PORTUGAL', 'CHINA', 'EUA', 'BRASIL'];
