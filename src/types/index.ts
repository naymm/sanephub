export type Perfil = 'Admin' | 'PCA' | 'RH' | 'Financeiro' | 'Contabilidade' | 'Secretaria' | 'Juridico' | 'Colaborador';

export interface Departamento {
  id: number;
  nome: string;
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  senha: string;
  perfil: Perfil;
  cargo: string;
  departamento: string;
  avatar: string;
  permissoes: string[];
  /** Módulos a que o utilizador tem acesso. Se definido, sobrepõe o acesso por perfil. Admin ignora. */
  modulos?: string[];
  /** ID do colaborador associado (portal do colaborador). Definido para perfil Colaborador. */
  colaboradorId?: number;
}

export type StatusColaborador = 'Activo' | 'Inactivo' | 'Suspenso' | 'Em férias';
export type TipoContrato = 'Efectivo' | 'Prazo Certo' | 'Prestação' | 'Estágio';
export type Genero = 'M' | 'F' | 'Outro';

export interface Colaborador {
  id: number;
  nome: string;
  dataNascimento: string;
  genero: Genero;
  estadoCivil: string;
  bi: string;
  nif: string;
  niss: string;
  nacionalidade: string;
  endereco: string;
  cargo: string;
  departamento: string;
  dataAdmissao: string;
  tipoContrato: TipoContrato;
  dataFimContrato?: string;
  salarioBase: number;
  iban: string;
  emailCorporativo: string;
  emailPessoal?: string;
  telefonePrincipal: string;
  telefoneAlternativo?: string;
  contactoEmergenciaNome?: string;
  contactoEmergenciaTelefone?: string;
  status: StatusColaborador;
}

export type StatusFerias = 'Pendente' | 'Aprovado' | 'Rejeitado' | 'Cancelado';

export interface Ferias {
  id: number;
  colaboradorId: number;
  dataInicio: string;
  dataFim: string;
  dias: number;
  status: StatusFerias;
  motivo?: string;
  solicitadoEm: string;
}

export type TipoFalta = 'Justificada' | 'Injustificada' | 'Atestado Médico' | 'Licença';

export interface Falta {
  id: number;
  colaboradorId: number;
  data: string;
  tipo: TipoFalta;
  motivo: string;
  registadoPor: string;
}

export interface ReciboSalario {
  id: number;
  colaboradorId: number;
  mesAno: string;
  vencimentoBase: number;
  subsidioAlimentacao: number;
  subsidioTransporte: number;
  outrosSubsidios: number;
  inss: number;
  irt: number;
  outrasDeducoes: number;
  liquido: number;
  status: 'Emitido' | 'Pago';
}

/** Declarações (para banco, rendimentos, antiguidade, etc.) */
export type TipoDeclaracao = 'Para Banco' | 'Embaixada' | 'Rendimentos' | 'Outro';
export type StatusDeclaracao = 'Pendente' | 'Emitida' | 'Entregue';

export interface Declaracao {
  id: number;
  colaboradorId: number;
  tipo: TipoDeclaracao;
  descricao?: string;
  /** Banco selecionado quando tipo é "Para Banco". */
  banco?: string;
  /** País da embaixada quando tipo é "Embaixada". */
  paisEmbaixada?: string;
  dataPedido: string;
  dataEmissao?: string;
  dataEntrega?: string;
  status: StatusDeclaracao;
  emitidoPor?: string;
  observacoes?: string;
}

export type StatusRequisicao = 'Pendente' | 'Em Análise' | 'Aprovado' | 'Rejeitado' | 'Pago' | 'Enviado à Contabilidade';

export interface Requisicao {
  id: number;
  num: string;
  fornecedor: string;
  nifFornecedor?: string;
  descricao: string;
  quantidade?: number;
  valorUnitario?: number;
  valor: number;
  departamento: string;
  centroCusto: string;
  projecto?: string;
  data: string;
  status: StatusRequisicao;
  proforma: boolean;
  /** Nomes/referências dos ficheiros de facturas proforma anexadas */
  proformaAnexos?: string[];
  factura: boolean;
  /** Nomes/referências dos ficheiros da factura final anexada (obrigatório para marcar como pago e enviar à contabilidade) */
  facturaFinalAnexos?: string[];
  comprovante: boolean;
  enviadoContabilidade: boolean;
  motivoRejeicao?: string;
  aprovadoPor?: string;
  dataPagamento?: string;
  observacoes?: string;
  /** Colaborador que solicitou (requisições submetidas pelo portal do colaborador) */
  requisitanteColaboradorId?: number;
}

export interface CentroCusto {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  responsavel: string;
  orcamentoMensal: number;
  orcamentoAnual: number;
  gastoActual: number;
  status: 'Activo' | 'Inactivo';
}

export interface Projecto {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  responsavel: string;
  orcamentoTotal: number;
  gasto: number;
  dataInicio: string;
  dataFim: string;
  status: 'Activo' | 'Concluído' | 'Suspenso' | 'Cancelado';
}

export interface Reuniao {
  id: number;
  titulo: string;
  data: string;
  hora: string;
  local: string;
  tipo: 'Ordinária' | 'Extraordinária' | 'Informal' | 'Comissão';
  pauta: string;
  participantes: number[];
  status: 'Agendada' | 'Realizada' | 'Cancelada' | 'Adiada';
}

export interface Contrato {
  id: number;
  numero: string;
  tipo: string;
  parteA: string;
  parteB: string;
  objecto: string;
  valor: number;
  moeda: string;
  dataAssinatura: string;
  dataInicio: string;
  dataFim: string;
  advogado: string;
  status: 'Activo' | 'A Renovar' | 'Em Negociação' | 'Suspenso' | 'Rescindido' | 'Expirado';
}

export interface ProcessoJudicial {
  id: number;
  numero: string;
  tribunal: string;
  tipoAccao: string;
  autor: string;
  reu: string;
  valorEmCausa: number;
  dataEntrada: string;
  proximaAudiencia?: string;
  status: 'Em curso' | 'Suspenso' | 'Encerrado' | 'Ganho' | 'Perdido' | 'Acordo';
  advogado: string;
  descricao: string;
}

export interface PrazoLegal {
  id: number;
  titulo: string;
  tipo: string;
  descricao: string;
  dataLimite: string;
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Crítica';
  responsavel: string;
  status: 'Pendente' | 'Em Tratamento' | 'Concluído' | 'Vencido';
  vinculoProcesso?: string;
  vinculoContrato?: string;
}

export interface Notificacao {
  id: string;
  tipo: 'info' | 'alerta' | 'urgente' | 'sucesso';
  titulo: string;
  mensagem: string;
  moduloOrigem: string;
  destinatarioPerfil: string[];
  lida: boolean;
  createdAt: string;
  link?: string;
}

export interface Correspondencia {
  id: number;
  tipo: 'Entrada' | 'Saída';
  remetente: string;
  destinatario: string;
  assunto: string;
  referencia: string;
  data: string;
  prioridade: 'Normal' | 'Urgente' | 'Confidencial';
  estadoResposta: 'Pendente' | 'Respondida' | 'Não requer' | 'Arquivada';
}

export interface DocumentoOficial {
  id: number;
  tipo: 'Deliberação' | 'Despacho' | 'Circular' | 'Convocatória' | 'Comunicado Interno';
  numero: string;
  titulo: string;
  data: string;
  autor: string;
  status: 'Rascunho' | 'Em Revisão' | 'Aprovado' | 'Publicado' | 'Arquivado';
}

/** Acta de reunião (minuta) — ligada a uma Reunião */
export interface Acta {
  id: number;
  reuniaoId: number;
  numero: string;
  data: string;
  titulo: string;
  conteudo: string;
  aprovadaPor?: string;
  status: 'Rascunho' | 'Em Revisão' | 'Aprovada' | 'Publicada' | 'Arquivada';
}

export interface RiscoJuridico {
  id: number;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  probabilidade: 'Baixa' | 'Média' | 'Alta';
  impacto: 'Baixo' | 'Médio' | 'Alto';
  nivelRisco: 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
  planoAccao: string;
  responsavel: string;
  status: 'Identificado' | 'Em monitorização' | 'Mitigado' | 'Materializado' | 'Encerrado';
}

/** Contabilidade: pagamentos recebidos / registados */
export type StatusPagamento = 'Recebido' | 'Em conciliação' | 'Conciliado' | 'Devolvido';

export interface Pagamento {
  id: number;
  requisicaoId: number;
  referencia: string;
  beneficiario: string;
  valor: number;
  dataPagamento: string;
  metodoPagamento: 'Transferência' | 'Cheque' | 'Numerário' | 'Outro';
  contaBancaria?: string;
  comprovante?: string;
  status: StatusPagamento;
  registadoPor: string;
  registadoEm: string;
  observacoes?: string;
}

/** Contabilidade: pendências documentais (documentos em falta, para regularizar) */
export type TipoPendencia = 'Factura em falta' | 'Comprovante em falta' | 'Proforma em falta' | 'Documento fiscal' | 'Assinatura' | 'Outro';
export type PrioridadePendencia = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

export interface PendenciaDocumental {
  id: number;
  titulo: string;
  tipo: TipoPendencia;
  descricao: string;
  entidadeRef: string;
  entidadeTipo: 'Requisicao' | 'Contrato' | 'Processo' | 'Outro';
  entidadeId: number;
  dataLimite?: string;
  prioridade: PrioridadePendencia;
  responsavel: string;
  status: 'Pendente' | 'Em tratamento' | 'Regularizado' | 'Vencido';
  resolvidoEm?: string;
  observacoes?: string;
}
