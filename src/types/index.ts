export type Perfil = 'Admin' | 'PCA' | 'Planeamento' | 'Director' | 'RH' | 'Financeiro' | 'Contabilidade' | 'Secretaria' | 'Juridico' | 'Colaborador';

/** Empresa do Grupo (tenant organizacional). Cada empresa tem dados, utilizadores e acessos segregados. */
export interface Empresa {
  id: number;
  codigo: string;
  nome: string;
  nif?: string;
  morada?: string;
  activo: boolean;
  /** Módulos activos nesta empresa. Se indefinido, todos os módulos permitidos pelo perfil estão disponíveis. */
  modulosAtivos?: string[];
}

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
  /** ID da empresa à qual o utilizador pertence. null/undefined = nível Grupo (Admin/PCA), com visão consolidada ou seleção de empresa. */
  empresaId?: number | null;
  /** Linha de assinatura digital (nome que aparece nos documentos). */
  assinaturaLinha?: string;
  /** Cargo/função que aparece na assinatura digital (pode ser diferente de cargo interno). */
  assinaturaCargo?: string;
  /** URL para imagem de assinatura (PNG/SVG) a usar nos PDFs. */
  assinaturaImagemUrl?: string;
}

export type StatusColaborador = 'Activo' | 'Inactivo' | 'Suspenso' | 'Em férias';
export type TipoContrato = 'Efectivo' | 'Prazo Certo' | 'Prestação' | 'Estágio';
export type Genero = 'M' | 'F' | 'Outro';

export interface Colaborador {
  id: number;
  /** ID da empresa a que o colaborador pertence (segregação multi-tenant). */
  empresaId: number;
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
  /** Cargo na assinatura do emitente (gravado na emissão). */
  emitenteAssinaturaCargo?: string;
  /** URL da imagem de assinatura do emitente (gravada na emissão). */
  emitenteAssinaturaImagemUrl?: string;
  observacoes?: string;
}

export type StatusRequisicao = 'Pendente' | 'Em Análise' | 'Aprovado' | 'Rejeitado' | 'Pago' | 'Enviado à Contabilidade';

export interface Requisicao {
  id: number;
  empresaId: number;
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
  proformaAnexos?: string[];
  factura: boolean;
  facturaFinalAnexos?: string[];
  comprovante: boolean;
  /** URLs (ou nomes) dos anexos do comprovativo de pagamento. */
  comprovativoAnexos?: string[];
  /** Data/hora em que o comprovativo foi anexado (para controlo das 48h). */
  comprovativoAnexadoEm?: string;
  enviadoContabilidade: boolean;
  motivoRejeicao?: string;
  aprovadoPor?: string;
  dataPagamento?: string;
  observacoes?: string;
  requisitanteColaboradorId?: number;
}

export interface CentroCusto {
  id: number;
  empresaId: number;
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
  empresaId: number;
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

/** Jurídico: processo disciplinar interno */
export type StatusProcessoDisciplinar =
  | 'Em análise jurídica'
  | 'Suspensão preventiva'
  | 'Em audiência'
  | 'Relatório elaborado'
  | 'Em decisão PCA'
  | 'Comunicado emitido'
  | 'Concluído';

export interface MedidaDisciplinarProposta {
  tipo: 'Advertência' | 'Suspensão' | 'Demissão' | 'Outra';
  descricao?: string;
}

export interface ProcessoDisciplinar {
  id: number;
  empresaId: number;
  colaboradorId: number;
  numero: string;
  criadoEm: string;
  criadoPor: string;
  /** 2.1 Auto de ocorrência */
  autoOcorrenciaPdf?: string;
  autoOcorrenciaDescricao: string;
  /** 2.2 Despacho de delegação de poder */
  despachoDelegacaoPdf?: string;
  despachoDelegacaoData?: string;
  /** 2.3 Avaliação jurídica */
  avaliacaoGravidade?: 'Leve' | 'Média' | 'Grave' | 'Muito Grave';
  parecerJuridico?: string;
  /** 2.4 Suspensão preventiva */
  suspensaoPreventivaPdf?: string;
  suspensaoInicio?: string;
  suspensaoFim?: string;
  /** 2.5 Convocatória para audiência disciplinar */
  convocatoriaPdf?: string;
  convocatoriaData?: string;
  convocatoriaLocal?: string;
  convocatoriaMotivo?: string;
  /** 2.6 Audiência disciplinar */
  audienciaData?: string;
  audienciaActaPdf?: string;
  /** 2.7 Relatório final */
  relatorioFinalPdf?: string;
  relatorioDescricao?: string;
  relatorioConclusao?: string;
  /** 2.8 Medidas disciplinares propostas */
  medidasPropostas: MedidaDisciplinarProposta[];
  /** 2.9/2.10 Decisão do PCA */
  decisaoPca?: 'Aprova medida' | 'Altera medida' | 'Rejeita' | 'Outra';
  decisaoDescricao?: string;
  decisaoPdf?: string;
  decisaoData?: string;
  /** 2.11 Comunicado ao colaborador */
  comunicadoPdf?: string;
  comunicadoData?: string;
  /** 2.12 Encerramento */
  status: StatusProcessoDisciplinar;
  encerradoEm?: string;
  historico: { data: string; passo: string; utilizador: string }[];
}

/** Jurídico: rescisão de contrato */
export type TipoRescisao = 'Resolução' | 'Revogação' | 'Caducidade';

export interface RescisaoContrato {
  id: number;
  contratoId: number;
  empresaId: number;
  tipo: TipoRescisao;
  motivoDetalhado: string;
  dataRescisao: string;
  documentoPdf?: string;
  criadoPor: string;
  criadoEm: string;
}

/** Tipos de contrato configuráveis no módulo Jurídico */
export type TipoContratoJuridico =
  | 'Empréstimo'
  | 'Trabalho Tempo Indeterminado'
  | 'Trabalho Tempo Determinado'
  | 'Prestação de Serviços'
  | 'Fornecimento'
  | 'Compra e Venda'
  | 'Arrendamento'
  | 'Parceria'
  | 'Outro';

export type StatusContrato = 'Activo' | 'A Renovar' | 'Em Negociação' | 'Suspenso' | 'Rescindido' | 'Expirado';

export interface Contrato {
  id: number;
  /** Empresa/unidade de negócio à qual o contrato está associado */
  empresaId?: number;
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
  /** Responsável jurídico (pode igualar advogado) */
  responsavelJuridico?: string;
  /** Nome do ficheiro PDF anexado */
  ficheiroPdf?: string;
  /** Alertar vencimento N dias antes (ex.: 30) */
  alertarAntesDias?: number;
  status: StatusContrato;
  /** Histórico de alterações */
  historico?: { data: string; acao: string; utilizador: string }[];
}

export interface ProcessoJudicial {
  id: number;
  /** Empresa à qual o processo está associado (opcional para filtro tenant) */
  empresaId?: number;
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
  observacoes?: string;
}

export interface PrazoLegal {
  id: number;
  empresaId?: number;
  titulo: string;
  tipo: string;
  descricao: string;
  dataLimite: string;
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Crítica';
  responsavel: string;
  status: 'Pendente' | 'Em Tratamento' | 'Concluído' | 'Vencido';
  vinculoProcesso?: string;
  vinculoContrato?: string;
  observacoes?: string;
}

export interface Noticia {
  id: number;
  empresaId: number;
  titulo: string;
  conteudo: string;
  imagemUrl?: string | null;
  featured: boolean;
  publicado: boolean;
  publicadoEm?: string | null;
}

export interface NoticiaComentario {
  id: number;
  empresaId: number;
  noticiaId: number;
  autorTexto: string;
  autorColaboradorId?: number | null;
  /** Perfil do autor (linha em `profiles`) para permitir notificações. */
  autorPerfilId?: number | null;
  /** Perfil do autor no momento em que comentou (evita depender de SELECT em `profiles`). */
  autorPerfil?: string | null;
  conteudo: string;
  parentComentarioId?: number | null;
  createdAt: string;
  updatedAt?: string;
}

export interface NoticiaGosto {
  id: number;
  empresaId: number;
  noticiaId: number;
  /** Perfil (linha em `profiles`) que deu o gosto. */
  autorPerfilId: number;
  /** Mantido para compatibilidade (pode ser null para perfis sem colaborador). */
  colaboradorId?: number | null;
  createdAt: string;
}

export interface Evento {
  id: number;
  empresaId: number;
  titulo: string;
  descricao?: string;
  local: string;
  dataInicio: string;
  imagemUrl?: string | null;
  isInterno: boolean;
  alertaAntesHoras?: number | null;
  alertaEm?: string | null;
}

export interface Notificacao {
  id: string;
  tipo: 'info' | 'alerta' | 'urgente' | 'sucesso';
  titulo: string;
  mensagem: string;
  moduloOrigem: string;
  destinatarioPerfil: string[];
  /** Empresa alvo da notificação (multi-tenant). null => visível em qualquer empresa (grupo/consolidado/legacy). */
  empresaId?: number | null;
  /** Se definido, só este colaborador (portal) deve ver a notificação entre utilizadores com perfil Colaborador. */
  destinatarioColaboradorId?: number | null;
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

/** Pasta na árvore de gestão documental (multi-tenant). */
export interface GestaoDocumentoPasta {
  id: number;
  empresaId: number;
  parentId: number | null;
  nome: string;
  ordem: number;
  /** Vazio = sem restrição extra por módulo na pasta. */
  modulosAcesso: string[];
  /** Vazio = qualquer sector. */
  sectoresAcesso: string[];
  createdAt: string;
}

/** Ficheiro registado na gestão documental (metadados + permissões). */
export interface GestaoDocumentoArquivo {
  id: number;
  empresaId: number;
  pastaId: number;
  titulo: string;
  observacao: string;
  storagePath: string;
  nomeFicheiro: string;
  mimeType: string;
  tamanhoBytes: number;
  tipoFicheiro: string;
  modulosAcesso: string[];
  sectoresAcesso: string[];
  origemModulo?: string | null;
  uploadedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GestaoDocumentoAuditoria {
  id: number;
  arquivoId: number;
  profileId: number | null;
  accao: 'upload' | 'view' | 'download' | 'delete' | 'move';
  detalhe: Record<string, unknown>;
  createdAt: string;
}

export interface DocumentoOficial {
  id: number;
  tipo: 'Deliberação' | 'Despacho' | 'Circular' | 'Convocatória' | 'Comunicado Interno';
  numero: string;
  titulo: string;
  data: string;
  autor: string;
  status: 'Rascunho' | 'Em Revisão' | 'Aprovado' | 'Publicado' | 'Arquivado' | 'Assinado';
  /** Empresa à qual o despacho/documento diz respeito (quando aplicável). */
  empresaId?: number | null;
  /** Tipo de despacho (aplicável apenas quando tipo === 'Despacho'). */
  despachoTipo?: 'Nomeação' | 'Exoneração' | 'Outro';
  /** Colaborador alvo do despacho (nomeação/exoneração), quando aplicável. */
  colaboradorId?: number | null;
  /** Tratamento protocolar (Sr. / Sr(a).) para Nomeação. */
  tratamento?: 'Sr.' | 'Sr(a).';
  /** Função/cargo para a qual o colaborador está a ser nomeado. */
  funcao?: string;
  /** Direcção/unidade orgânica. */
  direccao?: string;
  /** Se o colaborador acumula função. */
  acumulaFuncao?: boolean;
  /** Número de espaço de exoneração (referência ao despacho de nomeação). */
  numeroEspacoExoneracao?: string;
  /** Data do despacho de nomeação de referência (para texto da exoneração: "desde o dia X"). */
  dataReferenciaNomeacao?: string | null;
  /** Assinatura digital do PCA registada para este despacho/documento. */
  pcaAssinado?: boolean;
  pcaAssinadoEm?: string;
  pcaAssinadoPor?: string;
  /** Dados adicionais da assinatura digital do PCA. */
  pcaAssinaturaCargo?: string;
  pcaAssinaturaImagemUrl?: string;
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
  empresaId?: number;
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
  dataIdentificacao?: string;
  observacoes?: string;
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

/** Tesouraria: método de pagamento */
export type MetodoPagamentoTesouraria = 'Transferência' | 'Cheque' | 'Numerário' | 'MB' | 'Outro';

/** Tesouraria: categoria de saída */
export type CategoriaSaidaTesouraria = 'fornecedor' | 'servicos' | 'despesas_operacionais' | 'impostos' | 'salarios';

/** Catálogo de bancos (registo exclusivo Admin) */
export interface Banco {
  id: number;
  nome: string;
  codigo?: string;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Conta bancária por empresa. O mesmo banco (`bancoId`) pode ter várias contas na mesma empresa
 * desde que `numeroConta` seja distinto (único em conjunto empresa + banco + número).
 */
export interface ContaBancaria {
  id: number;
  empresaId: number;
  bancoId: number;
  numeroConta: string;
  saldoActual: number;
  descricao?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Movimento de tesouraria (entrada ou saída de dinheiro) */
export interface MovimentoTesouraria {
  id: number;
  empresaId: number;
  tipo: 'entrada' | 'saida';
  referencia: string;
  valor: number;
  data: string;
  metodoPagamento: MetodoPagamentoTesouraria;
  descricao: string;
  /** Entrada: cliente ou origem do recebimento */
  origem?: string;
  /** Saída: categoria do pagamento */
  categoriaSaida?: CategoriaSaidaTesouraria;
  /** Saída: beneficiário (fornecedor, serviço, etc.) */
  beneficiario?: string;
  centroCustoId?: number;
  projectoId?: number;
  /** Conta onde o movimento incide (actualiza saldo_actual via trigger) */
  contaBancariaId?: number;
  comprovativoAnexos?: string[];
  /** Saída: URLs de proforma (PDF). Obrigatório anexar proforma ou factura final ao registar. */
  proformaAnexos?: string[];
  /** Saída: URLs de factura final (PDF). */
  facturaFinalAnexos?: string[];
  requisicaoId?: number;
  registadoPor?: string;
  registadoEm: string;
  observacoes?: string;
}

/** Planeamento Estratégico: linha com descrição, quantidade, preço unitário e total */
export interface LinhaPlaneamento {
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
}

/** Gastos com pessoal: tipo e valores */
export interface GastosPessoalItem extends LinhaPlaneamento {
  tipo: 'salarios_base' | 'subsidios' | 'inss' | 'irt';
}

/** Liquidez: saldo bancário */
export interface SaldoBancario {
  banco: string;
  numeroConta: string;
  saldoActual: number;
}

/** Liquidez: pendente a pagar ou a receber */
export interface PendenteValor {
  nome: string;
  valor: number;
}

export type CicloVidaEmpresa = 'Startup' | 'Crescimento' | 'Maturidade' | 'Declínio' | 'Encerramento';

export type StatusRelatorioPlaneamento = 'Rascunho' | 'Submetido' | 'Em análise' | 'Consolidado';

/** Relatório mensal de planeamento estratégico (uma por empresa por mês) */
export interface RelatorioMensalPlaneamento {
  id: number;
  empresaId: number;
  mesAno: string;
  status: StatusRelatorioPlaneamento;
  /** Secção 1: Análise da Empresa e do Negócio */
  actividadesComerciais: string;
  principaisConstrangimentos: string;
  estrategiasReceitas: string;
  estrategiasCustos: string;
  cicloVida: CicloVidaEmpresa;
  /** Secção 2: Necessidades de investimento */
  necessidadesInvestimento: LinhaPlaneamento[];
  /** Secção 3: Gestão de stocks */
  stockInicial: LinhaPlaneamento[];
  comprasPeriodo: LinhaPlaneamento[];
  stockFinal: LinhaPlaneamento[];
  /** Secção 4: Demonstração de resultados */
  vendasProdutos: LinhaPlaneamento[];
  vendasServicos: LinhaPlaneamento[];
  custoMercadoriasVendidas: LinhaPlaneamento[];
  fornecimentoServicosExternos: LinhaPlaneamento[];
  gastosPessoal: GastosPessoalItem[];
  /** Secção 5: Calculados (EBITDA, margens) */
  ebitda?: number;
  margemBruta?: number;
  margemEbitda?: number;
  /** Secção 6: Liquidez */
  saldosBancarios: SaldoBancario[];
  pendentesPagamento: PendenteValor[];
  pendentesRecebimento: PendenteValor[];
  submetidoEm?: string;
  submetidoPor?: string;
  analisadoPor?: string;
  analisadoEm?: string;
}
