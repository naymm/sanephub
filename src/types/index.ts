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

/** Flags globais (tabela `organizacao_settings`): escondem módulos e rotas em toda a intranet. */
export interface OrganizacaoSettings {
  modulosDesactivados: string[];
  /** Caminhos exactos ou prefixos (ex. `/capital-humano/zonas-trabalho`) desactivados. */
  recursosDesactivados: string[];
}

export interface Departamento {
  id: number;
  nome: string;
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  /** Nome de utilizador para login (Supabase). Em modo offline pode estar ausente. */
  username?: string;
  senha: string;
  perfil: Perfil;
  cargo: string;
  departamento: string;
  avatar: string;
  /** Foto de perfil do colaborador ligado (`colaboradores.foto_perfil_url`); tem prioridade sobre `avatar` nas UI. */
  fotoPerfilUrl?: string | null;
  /** Supabase: colaborador novo deve concluir alteração de senha + PIN antes de usar a intranet. */
  primeiroAcessoPendente?: boolean;
  permissoes: string[];
  /** Módulos a que o utilizador tem acesso. Se definido, sobrepõe o acesso por perfil. Admin ignora. */
  modulos?: string[];
  /** ID do colaborador associado (portal do colaborador). Definido para perfil Colaborador. */
  colaboradorId?: number;
  /**
   * Nº mecanográfico espelhado de `colaboradores.numero_mec` (também em `profiles.numero_mec`).
   * Usado na RLS de marcação de ponto; não depende só de `colaboradorId`.
   */
  numeroMec?: string | null;
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
  /** Número mecanográfico (coluna `numero_mec` na BD). */
  numeroMec?: string | null;
  nome: string;
  dataNascimento: string;
  genero: Genero;
  estadoCivil: string;
  bi: string;
  nif: string;
  niss: string;
  nacionalidade: string;
  /**
   * Nível académico (select fixo na app).
   * Opcional no tipo para compatibilidade com dados antigos / seed sem o campo.
   */
  nivelAcademico?: string;
  /** URL pública da fotografia de perfil (storage), opcional; null remove na BD. */
  fotoPerfilUrl?: string | null;
  endereco: string;
  cargo: string;
  departamento: string;
  dataAdmissao: string;
  tipoContrato: TipoContrato;
  dataFimContrato?: string;
  salarioBase: number;
  /** Subsídios mensais (Kz) para pré-preencher o processamento salarial. */
  subsidioAlimentacao?: number;
  /** Subsídios mensais (Kz) para pré-preencher o processamento salarial. */
  subsidioTransporte?: number;
  /** Outros subsídios mensais (Kz) para pré-preencher o processamento salarial (agregado legado). */
  outrosSubsidios?: number;
  /** Subsídio de Natal (Kz). */
  subsidioNatal?: number;
  /** Abono de família (Kz). */
  abonoFamilia?: number;
  /** Subsídio de Turno (Kz). */
  subsidioTurno?: number;
  /** Subsídio de Disponibilidade (Kz). */
  subsidioDisponibilidade?: number;
  /** Subsídio de Risco (Kz). */
  subsidioRisco?: number;
  /** Subsídio de Atavio (Kz). */
  subsidioAtavio?: number;
  /** Subsídio de Representação (Kz). */
  subsidioRepresentacao?: number;
  iban: string;
  emailCorporativo: string;
  emailPessoal?: string;
  telefonePrincipal: string;
  telefoneAlternativo?: string;
  contactoEmergenciaNome?: string;
  contactoEmergenciaTelefone?: string;
  status: StatusColaborador;
  /** Hora normal de entrada (HH:mm ou HH:mm:ss); tolerância de 15 min aplicada no cálculo de atrasos. */
  horarioEntrada?: string;
  /** Fim do horário de trabalho (HH:mm ou HH:mm:ss). */
  horarioSaida?: string;
  /** Se true, atrasos não acumulam e não geram faltas automáticas por atraso. */
  isencaoHorario?: boolean;
  /** Zonas de ponto permitidas (`colaborador_geofences`); preenchido no cliente, não é coluna em `colaboradores`. */
  geofenceIds?: number[];
}

/** Zona de trabalho / geofence (tabela `geofences`). */
export interface Geofence {
  id: number;
  empresaId: number;
  nome: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Permissão de colaborador para marcar ponto numa zona (tabela `colaborador_geofences`). */
export interface ColaboradorGeofenceLink {
  id: number;
  colaboradorId: number;
  geofenceId: number;
  createdAt: string;
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

export type TipoFalta = 'Justificada' | 'Injustificada' | 'Atestado Médico' | 'Licença' | 'Por atrasos';

export interface Falta {
  id: number;
  colaboradorId: number;
  data: string;
  tipo: TipoFalta;
  motivo: string;
  registadoPor: string;
  /** YYYY-MM para faltas geradas pelo sistema por acumulado de atrasos. */
  referenciaMesAtrasos?: string | null;
}

/** Marcação de ponto legada (`time_punches`). */
export interface TimePunch {
  id: number;
  authUserId: string;
  colaboradorId: number | null;
  /** Preenchido pelo `select` com join a `colaboradores(nome)` quando disponível. */
  colaboradorNome?: string | null;
  empresaId: number | null;
  kind: string;
  occurredAt: string;
  verificationMethod: string | null;
  faceVerified: boolean | null;
  faceConfidence: number | null;
  pinVerified: boolean;
  selfieStoragePath: string | null;
  locationLat: number | null;
  locationLng: number | null;
  locationAccuracyM: number | null;
  geofenceId: number | null;
  isWithinGeofence: boolean | null;
  status: string;
  clientMeta: Record<string, unknown> | null;
  createdAt: string;
}

/** Linha normalizada de `biometrico_registros` para a lista / detalhe (colunas variáveis na BD). */
export interface NormalizedBiometricoRegistro {
  /** Pode ser bigserial (número) ou outro tipo de chave exposto pelo PostgREST. */
  id: number | string;
  rawCamel: Record<string, unknown>;
  numeroMec: string | null;
  occurredAtIso: string;
  /** `yyyy-MM-dd` para filtros; vazio se não dedutível. */
  dataIso: string;
  /** Data só para coluna DATA (dd/MM/yyyy). */
  dataTexto: string;
  /** Hora entrada (HH:mm:ss ou valor vindo da BD). */
  entradaTexto: string;
  /** Hora saída. */
  saidaTexto: string;
  /** Texto livre para morada/localização técnica, se existir na BD. */
  localTexto: string | null;
  /** Valor textual da coluna `empresa` no registo (ex.: nome no equipamento); usado na coluna «Local» da lista. */
  empresaColunaTexto: string | null;
  /** Coluna VIA: canal, método, dispositivo, etc. */
  viaTexto: string;
  kind: string;
  status: string;
  empresaId: number | null;
  pinVerified: boolean | null;
  faceVerified: boolean | null;
  faceConfidence: number | null;
  verificationMethod: string | null;
  locationLat: number | null;
  locationLng: number | null;
  locationAccuracyM: number | null;
  geofenceId: number | null;
  isWithinGeofence: boolean | null;
  selfieStoragePath: string | null;
  authUserId: string | null;
  clientMeta: Record<string, unknown> | null;
  /** Quando várias linhas do mesmo dia e `numero_mec` foram fundidas na lista. */
  mergedSources?: NormalizedBiometricoRegistro[];
}

export interface ReciboSalario {
  id: number;
  colaboradorId: number;
  mesAno: string;
  vencimentoBase: number;
  subsidioAlimentacao: number;
  subsidioTransporte: number;
  outrosSubsidios: number;
  /** Desconto no bruto por faltas (soma base/22 + alim./22 + transp./22) por dia, antes de impostos. */
  descontoFaltas: number;
  /** Dias de falta contados (Injustificada e Por atrasos no mês do recibo). */
  diasFaltaDesconto: number;
  inss: number;
  irt: number;
  outrasDeducoes: number;
  liquido: number;
  status: 'Emitido' | 'Pago';
}

/** IRT: escalões e taxas armazenados para cálculo dinâmico. */
export interface IRTEscalao {
  id: number;
  ordem: number;
  valorMin: number;
  valorMax: number | null;
  parcelaFixa: number;
  taxaPercent: number;
  excessoDe: number;
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
  /** Prestação de serviços: NIF quando Personalidade = Colectivo */
  contraparteNif?: string | null;
  /** Prestação de serviços: colaborador quando Personalidade = Singular */
  contraparteColaboradorId?: number | null;
  /** «Singular» | «Colectivo» para fluxo de prestação de serviços */
  personalidadeContraparte?: string | null;
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
  /** Até 6 URLs de imagens (galeria), além da capa `imagemUrl`. */
  galeriaUrls?: string[] | null;
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

/** Valores alinhados à coluna `comunicados.tipo` na base de dados. */
export type ComunicadoTipo =
  | 'feriado'
  | 'tolerancia_ponto'
  | 'situacao_interna'
  | 'nova_contratacao'
  | 'nomeacao'
  | 'exoneracao'
  | 'demissao'
  | 'outro';

export interface Comunicado {
  id: number;
  empresaId: number;
  titulo: string;
  resumo: string;
  conteudo: string;
  tipo: ComunicadoTipo;
  anexoUrl?: string | null;
  anexoNome?: string | null;
  publicadoEm: string;
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
  /** Colaborador que presidiu à sessão. */
  presididaPor?: number | null;
  /** IDs de colaboradores presentes (multi-select; pode ser sincronizado com a reunião). */
  participantesIds?: number[];
  /** Nomes dos participantes, na mesma ordem que `participantesIds` (gravado automaticamente). */
  participantesNomes?: string[];
  /** Cópia do local da reunião (editável). */
  local?: string;
  /** Cópia da hora da reunião (editável). */
  hora?: string;
  /** Duração (texto livre, ex.: 90 min ou 1h30). */
  duracao?: string;
  /** URL pública do áudio no storage (transcrição n8n). */
  audioTranscricaoPath?: string | null;
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

/** Secção 3: matéria-prima com stock inicial e stock final alinhados (preços podem diferir). Compras do período são grelha à parte. */
export interface LinhaGestaoStockMateriaPrima {
  descricao: string;
  qtdStockInicial: number;
  precoUnitInicial: number;
  qtdStockFinal: number;
  precoUnitFinal: number;
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
  /** Secção 1: Análise da Empresa e do Negócio (itens editáveis em lista) */
  actividadesComerciais: string[];
  principaisConstrangimentos: string[];
  estrategiasReceitas: string[];
  estrategiasCustos: string[];
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
  /** Referência: encargos financeiros, deprec./amort. e impostos sobre o lucro (não entram no resultado líquido desta demonstração) */
  jurosFinanceiros?: number;
  depreciacaoAmortizacoes?: number;
  impostosLucro?: number;
  /** Volume de negócio − CMV − pessoal (inclui INSS e IRT) − serviços externos; difere do EBITDA */
  resultadoLiquido?: number;
  /** Secção 6: Liquidez */
  saldosBancarios: SaldoBancario[];
  pendentesPagamento: PendenteValor[];
  pendentesRecebimento: PendenteValor[];
  submetidoEm?: string;
  submetidoPor?: string;
  analisadoPor?: string;
  analisadoEm?: string;
}

/** Valores guardados em `computador_sistema_operacional`. */
export type PatrimonioComputadorSO = 'windows_10' | 'windows_11' | 'mac_os' | 'linux';

/** Categoria de activo configurável por empresa (Património). */
export interface PatrimonioCategoriaCfg {
  id: number;
  empresaId: number;
  nome: string;
  slug: string;
  ordem: number;
  comportamentoViatura: boolean;
  /** Activa campos de ficha técnica de computador no registo do activo. */
  comportamentoComputador: boolean;
  createdAt: string;
}

/** Subcategoria opcional ligada a uma categoria de património. */
export interface PatrimonioSubcategoriaCfg {
  id: number;
  categoriaId: number;
  nome: string;
  ordem: number;
  createdAt: string;
}

export type PatrimonioEstado = 'disponivel' | 'em_uso' | 'inactivo';

export type PatrimonioMovimentoTipo =
  | 'criacao'
  | 'atribuir_colaborador'
  | 'remover_colaborador'
  | 'transferir_empresa'
  | 'trocar_responsavel'
  | 'alterar_estado'
  | 'edicao_geral';

export interface PatrimonioActivo {
  id: number;
  empresaId: number;
  codigo: string;
  nome: string;
  /** Unidades representadas por esta linha (>= 1). */
  quantidade: number;
  categoriaId: number;
  subcategoriaId?: number | null;
  viaturaMarca?: string | null;
  viaturaModelo?: string | null;
  viaturaCor?: string | null;
  viaturaMatricula?: string | null;
  computadorMarca?: string | null;
  computadorModelo?: string | null;
  computadorSistemaOperacional?: PatrimonioComputadorSO | null;
  computadorProcessador?: string | null;
  computadorArmazenamentoGb?: number | null;
  computadorRamGb?: number | null;
  responsavelColaboradorId?: number | null;
  estado: PatrimonioEstado;
  createdAt: string;
  updatedAt: string;
}

export interface PatrimonioMovimento {
  id: number;
  activoId: number;
  empresaId: number;
  tipo: PatrimonioMovimentoTipo;
  resumo: string;
  detalhe?: Record<string, unknown> | null;
  actorPerfilId?: number | null;
  actorNome?: string | null;
  createdAt: string;
}

export interface PatrimonioVerificacao {
  id: number;
  empresaId: number;
  anoMes: string;
  titulo: string;
  fechada: boolean;
  createdBy?: number | null;
  createdAt: string;
}

export interface PatrimonioVerificacaoItem {
  id: number;
  verificacaoId: number;
  activoId: number;
  existe?: boolean | null;
  localCorrecto?: boolean | null;
  responsavelCorrecto?: boolean | null;
  observacoes: string;
  updatedAt: string;
}
