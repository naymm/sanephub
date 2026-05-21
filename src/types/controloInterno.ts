export type CiAuditoriaTipo =
  | 'Financeira'
  | 'Operacional'
  | 'RH'
  | 'Compliance'
  | 'TI'
  | 'Patrimonial'
  | 'Segurança';

/** Orgânica ou Direccionada (área indicada quando direccionada). */
export type CiNatureza = 'Orgânica' | 'Direccionada';

export type CiAuditoriaEstado = 'Planeada' | 'Em Execução' | 'Concluída' | 'Cancelada';

export type CiInspecaoEstado = 'Planeada' | 'Em curso' | 'Concluída' | 'Cancelada';

export type CiChecklistResultado = 'Conforme' | 'Não Conforme' | 'Parcialmente Conforme' | 'Não Aplicável';

export type CiNcGravidade = 'Baixo' | 'Médio' | 'Alto' | 'Crítico';

export type CiNcEstado = 'Aberta' | 'Em Tratamento' | 'Resolvida' | 'Encerrada';

export type CiPlanoEstado = 'Pendente' | 'Em Progresso' | 'Concluída' | 'Atrasada' | 'Cancelada';

export type CiRiscoCategoria =
  | 'Financeiro'
  | 'Operacional'
  | 'Tecnológico'
  | 'Jurídico'
  | 'Reputacional'
  | 'RH';

export type CiRiscoEstado = 'Identificado' | 'Em monitorização' | 'Mitigado' | 'Encerrado';

export interface CiAuditoria {
  id: number;
  empresaId: number;
  codigo: string;
  titulo: string;
  tipo: CiAuditoriaTipo | null;
  natureza: CiNatureza;
  areaDepartamento: string;
  areaDireccionada: string;
  auditorResponsavelColaboradorId: number | null;
  equipaColaboradorIds: number[];
  dataInicio: string | null;
  dataFim: string | null;
  prazo: string | null;
  estado: CiAuditoriaEstado;
  objectivo: string;
  escopo: string;
  observacoes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CiInspecao {
  id: number;
  empresaId: number;
  codigo: string;
  natureza: CiNatureza;
  areaDepartamento: string;
  areaDireccionada: string;
  dataInspecao: string | null;
  prazo: string | null;
  titulo: string;
  descricao: string;
  estado: CiInspecaoEstado;
  inspetorColaboradorId: number | null;
  observacoes: string;
  relatorioFinalStoragePath: string | null;
  relatorioFinalNomeFicheiro: string | null;
  relatorioFinalMimeType: string | null;
  relatorioFinalTamanhoBytes: number | null;
  relatorioFinalUploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CiChecklistItem {
  id: number;
  auditoriaId: number;
  ordem: number;
  pergunta: string;
  criterioAvaliacao: string;
  resultado: CiChecklistResultado | null;
  observacao: string;
  createdAt: string;
  updatedAt: string;
}

export interface CiChecklistEvidencia {
  id: number;
  checklistItemId: number;
  storagePath: string;
  nomeFicheiro: string;
  mimeType: string;
  tamanhoBytes: number | null;
  createdAt: string;
}

export interface CiNaoConformidade {
  id: number;
  empresaId: number;
  codigo: string;
  auditoriaId: number | null;
  checklistItemId: number | null;
  titulo: string;
  descricao: string;
  gravidade: CiNcGravidade;
  areaResponsavel: string;
  impacto: string;
  recomendacao: string;
  prazoResolucao: string | null;
  estado: CiNcEstado;
  createdAt: string;
  updatedAt: string;
}

export interface CiPlanoAccao {
  id: number;
  naoConformidadeId: number;
  accaoCorrectiva: string;
  responsavelColaboradorId: number | null;
  prazo: string | null;
  estado: CiPlanoEstado;
  evidenciaResolucaoPath: string | null;
  evidenciaResolucaoNome: string | null;
  comentarios: string;
  createdAt: string;
  updatedAt: string;
}

export interface CiRisco {
  id: number;
  empresaId: number;
  titulo: string;
  categoria: CiRiscoCategoria;
  probabilidade: number;
  impacto: number;
  score: number;
  mitigacao: string;
  responsavelColaboradorId: number | null;
  estado: CiRiscoEstado;
  createdAt: string;
  updatedAt: string;
}
