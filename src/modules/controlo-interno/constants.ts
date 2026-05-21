import type {
  CiAuditoriaEstado,
  CiAuditoriaTipo,
  CiChecklistResultado,
  CiInspecaoEstado,
  CiNatureza,
  CiNcEstado,
  CiNcGravidade,
  CiPlanoEstado,
  CiRiscoCategoria,
  CiRiscoEstado,
} from '@/types/controloInterno';

export const CI_MODULE_TITLE = 'Controlo Interno';
export const CI_MODULE_KICKER = 'Direcção de Auditoria e Controlo Interno';

export const CI_BASE = '/controlo-interno';

export const CI_NAV = [
  { label: 'Dashboard', path: `${CI_BASE}` },
  { label: 'Plano de Auditorias', path: `${CI_BASE}/plano-auditorias` },
  { label: 'Inspecções', path: `${CI_BASE}/inspeccoes` },
  { label: 'Execução', path: `${CI_BASE}/execucao` },
  { label: 'Não Conformidades', path: `${CI_BASE}/nao-conformidades` },
  { label: 'Plano de Acção', path: `${CI_BASE}/plano-accao` },
  { label: 'Riscos', path: `${CI_BASE}/riscos` },
  { label: 'Logs', path: `${CI_BASE}/logs` },
  { label: 'Relatórios', path: `${CI_BASE}/relatorios` },
] as const;

export const CI_NATUREZAS: CiNatureza[] = ['Orgânica', 'Direccionada'];

export const CI_ESTADOS_INSPECCAO: CiInspecaoEstado[] = [
  'Planeada',
  'Em curso',
  'Concluída',
  'Cancelada',
];

export const CI_TIPOS_AUDITORIA: CiAuditoriaTipo[] = [
  'Financeira',
  'Operacional',
  'RH',
  'Compliance',
  'TI',
  'Patrimonial',
  'Segurança',
];

export const CI_ESTADOS_AUDITORIA: CiAuditoriaEstado[] = [
  'Planeada',
  'Em Execução',
  'Concluída',
  'Cancelada',
];

export const CI_RESULTADOS_CHECKLIST: CiChecklistResultado[] = [
  'Conforme',
  'Não Conforme',
  'Parcialmente Conforme',
  'Não Aplicável',
];

export const CI_GRAVIDADES: CiNcGravidade[] = ['Baixo', 'Médio', 'Alto', 'Crítico'];
export const CI_ESTADOS_NC: CiNcEstado[] = ['Aberta', 'Em Tratamento', 'Resolvida', 'Encerrada'];
export const CI_ESTADOS_PLANO: CiPlanoEstado[] = [
  'Pendente',
  'Em Progresso',
  'Concluída',
  'Atrasada',
  'Cancelada',
];

export const CI_CATEGORIAS_RISCO: CiRiscoCategoria[] = [
  'Financeiro',
  'Operacional',
  'Tecnológico',
  'Jurídico',
  'Reputacional',
  'RH',
];

export const CI_ESTADOS_RISCO: CiRiscoEstado[] = [
  'Identificado',
  'Em monitorização',
  'Mitigado',
  'Encerrado',
];
