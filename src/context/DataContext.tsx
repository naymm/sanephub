import React, { createContext, useContext, useState, useMemo, useEffect, useCallback, ReactNode } from 'react';
import type {
  Colaborador,
  Empresa,
  Geofence,
  ColaboradorGeofenceLink,
  Ferias,
  Falta,
  ReciboSalario,
  Declaracao,
  Requisicao,
  CentroCusto,
  Projecto,
  Reuniao,
  Acta,
  Contrato,
  ProcessoJudicial,
  PrazoLegal,
  Correspondencia,
  DocumentoOficial,
  RiscoJuridico,
  Pagamento,
  PendenciaDocumental,
  Departamento,
  MovimentoTesouraria,
  RelatorioMensalPlaneamento,
  ProcessoDisciplinar,
  RescisaoContrato,
  Noticia,
  Evento,
  Comunicado,
  Banco,
  ContaBancaria,
  IRTEscalao,
  OrganizacaoSettings,
  PatrimonioActivo,
  PatrimonioCategoriaCfg,
  PatrimonioMovimento,
  PatrimonioSubcategoriaCfg,
  PatrimonioVerificacao,
  PatrimonioVerificacaoItem,
} from '@/types';
import { useTenant } from '@/context/TenantContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  loadAllTables,
  db,
  fetchColaboradorGeofenceLinks,
  syncColaboradorGeofenceLinks as syncColaboradorGeofenceLinksApi,
  fetchOrganizacaoSettings,
  upsertOrganizacaoSettings,
} from '@/lib/supabaseData';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { nextReferenciaTesouraria } from '@/utils/tesourariaReferencia';

/** Variação do saldo da conta quando o movimento é aplicado (entrada +valor, saída −valor). */
function saldoDeltaFromMovimento(m: Pick<MovimentoTesouraria, 'tipo' | 'valor'>): number {
  return m.tipo === 'entrada' ? m.valor : -m.valor;
}

function patchContaBancariaSaldo(
  setContasBancarias: React.Dispatch<React.SetStateAction<ContaBancaria[]>>,
  contaId: number | undefined,
  delta: number,
) {
  if (contaId == null || delta === 0 || Number.isNaN(delta)) return;
  setContasBancarias(prev =>
    prev.map(c =>
      c.id === contaId ? { ...c, saldoActual: Number(c.saldoActual) + delta } : c,
    ),
  );
}

interface DataContextType {
  dataLoading: boolean;
  dataError: string | null;
  refetch: () => Promise<void>;
  departamentos: Departamento[];
  setDepartamentos: React.Dispatch<React.SetStateAction<Departamento[]>>;
  empresas: Empresa[];
  setEmpresas: React.Dispatch<React.SetStateAction<Empresa[]>>;
  colaboradores: Colaborador[];
  /** Lista completa (sem filtro por empresa). Use no Portal para encontrar o colaborador do utilizador logado. */
  colaboradoresTodos: Colaborador[];
  setColaboradores: React.Dispatch<React.SetStateAction<Colaborador[]>>;
  ferias: Ferias[];
  setFerias: React.Dispatch<React.SetStateAction<Ferias[]>>;
  faltas: Falta[];
  setFaltas: React.Dispatch<React.SetStateAction<Falta[]>>;
  recibos: ReciboSalario[];
  setRecibos: React.Dispatch<React.SetStateAction<ReciboSalario[]>>;
  declaracoes: Declaracao[];
  setDeclaracoes: React.Dispatch<React.SetStateAction<Declaracao[]>>;
  requisicoes: Requisicao[];
  setRequisicoes: React.Dispatch<React.SetStateAction<Requisicao[]>>;
  centrosCusto: CentroCusto[];
  setCentrosCusto: React.Dispatch<React.SetStateAction<CentroCusto[]>>;
  projectos: Projecto[];
  setProjectos: React.Dispatch<React.SetStateAction<Projecto[]>>;
  reunioes: Reuniao[];
  setReunioes: React.Dispatch<React.SetStateAction<Reuniao[]>>;
  actas: Acta[];
  setActas: React.Dispatch<React.SetStateAction<Acta[]>>;
  irtEscalaes: IRTEscalao[];
  setIrtEscalaes: React.Dispatch<React.SetStateAction<IRTEscalao[]>>;
  contratos: Contrato[];
  setContratos: React.Dispatch<React.SetStateAction<Contrato[]>>;
  processos: ProcessoJudicial[];
  setProcessos: React.Dispatch<React.SetStateAction<ProcessoJudicial[]>>;
  prazos: PrazoLegal[];
  setPrazos: React.Dispatch<React.SetStateAction<PrazoLegal[]>>;
  correspondencias: Correspondencia[];
  setCorrespondencias: React.Dispatch<React.SetStateAction<Correspondencia[]>>;
  documentosOficiais: DocumentoOficial[];
  setDocumentosOficiais: React.Dispatch<React.SetStateAction<DocumentoOficial[]>>;
  riscos: RiscoJuridico[];
  setRiscos: React.Dispatch<React.SetStateAction<RiscoJuridico[]>>;
  pagamentos: Pagamento[];
  setPagamentos: React.Dispatch<React.SetStateAction<Pagamento[]>>;
  pendencias: PendenciaDocumental[];
  setPendencias: React.Dispatch<React.SetStateAction<PendenciaDocumental[]>>;
  movimentosTesouraria: MovimentoTesouraria[];
  setMovimentosTesouraria: React.Dispatch<React.SetStateAction<MovimentoTesouraria[]>>;
  /** Catálogo global de bancos */
  bancos: Banco[];
  setBancos: React.Dispatch<React.SetStateAction<Banco[]>>;
  /** Contas filtradas pelo tenant actual */
  contasBancarias: ContaBancaria[];
  setContasBancarias: React.Dispatch<React.SetStateAction<ContaBancaria[]>>;
  relatoriosPlaneamento: RelatorioMensalPlaneamento[];
  setRelatoriosPlaneamento: React.Dispatch<React.SetStateAction<RelatorioMensalPlaneamento[]>>;
  noticias: Noticia[];
  setNoticias: React.Dispatch<React.SetStateAction<Noticia[]>>;
  eventos: Evento[];
  setEventos: React.Dispatch<React.SetStateAction<Evento[]>>;
  comunicados: Comunicado[];
  setComunicados: React.Dispatch<React.SetStateAction<Comunicado[]>>;
  processosDisciplinares: ProcessoDisciplinar[];
  setProcessosDisciplinares: React.Dispatch<React.SetStateAction<ProcessoDisciplinar[]>>;
  rescissoesContrato: RescisaoContrato[];
  setRescissoesContrato: React.Dispatch<React.SetStateAction<RescisaoContrato[]>>;
  geofences: Geofence[];
  setGeofences: React.Dispatch<React.SetStateAction<Geofence[]>>;
  colaboradorGeofenceLinks: ColaboradorGeofenceLink[];
  setColaboradorGeofenceLinks: React.Dispatch<React.SetStateAction<ColaboradorGeofenceLink[]>>;
  addGeofence: (p: Partial<Geofence>) => Promise<Geofence>;
  updateGeofence: (id: number, p: Partial<Geofence>) => Promise<Geofence>;
  deleteGeofence: (id: number) => Promise<void>;
  /** Grava `colaborador_geofences` para um colaborador (substitui lista). */
  syncColaboradorGeofenceLinksForColaborador: (
    colaboradorId: number,
    geofenceIds: number[],
    colaboradorEmpresaId: number,
  ) => Promise<void>;
  addContrato: (p: Partial<Contrato>) => Promise<Contrato>;
  updateContrato: (id: number, p: Partial<Contrato>) => Promise<Contrato>;
  deleteContrato: (id: number) => Promise<void>;
  addProcesso: (p: Partial<ProcessoJudicial>) => Promise<ProcessoJudicial>;
  updateProcesso: (id: number, p: Partial<ProcessoJudicial>) => Promise<ProcessoJudicial>;
  deleteProcesso: (id: number) => Promise<void>;
  addPrazo: (p: Partial<PrazoLegal>) => Promise<PrazoLegal>;
  updatePrazo: (id: number, p: Partial<PrazoLegal>) => Promise<PrazoLegal>;
  deletePrazo: (id: number) => Promise<void>;
  addRisco: (p: Partial<RiscoJuridico>) => Promise<RiscoJuridico>;
  updateRisco: (id: number, p: Partial<RiscoJuridico>) => Promise<RiscoJuridico>;
  deleteRisco: (id: number) => Promise<void>;
  addRescisaoContrato: (p: Partial<RescisaoContrato>) => Promise<RescisaoContrato>;
  addProcessoDisciplinar: (p: Partial<ProcessoDisciplinar>) => Promise<ProcessoDisciplinar>;
  addEmpresa: (p: Partial<Empresa>) => Promise<Empresa>;
  updateEmpresa: (id: number, p: Partial<Empresa>) => Promise<Empresa>;
  deleteEmpresa: (id: number) => Promise<void>;
  addDepartamento: (p: Partial<Departamento>) => Promise<Departamento>;
  updateDepartamento: (id: number, p: Partial<Departamento>) => Promise<Departamento>;
  deleteDepartamento: (id: number) => Promise<void>;
  addColaborador: (p: Partial<Colaborador>) => Promise<Colaborador>;
  updateColaborador: (id: number, p: Partial<Colaborador>) => Promise<Colaborador>;
  deleteColaborador: (id: number) => Promise<void>;
  addFerias: (p: Partial<Ferias>) => Promise<Ferias>;
  updateFerias: (id: number, p: Partial<Ferias>) => Promise<Ferias>;
  deleteFerias: (id: number) => Promise<void>;
  addFalta: (p: Partial<Falta>) => Promise<Falta>;
  updateFalta: (id: number, p: Partial<Falta>) => Promise<Falta>;
  deleteFalta: (id: number) => Promise<void>;
  addRecibo: (p: Partial<ReciboSalario>) => Promise<ReciboSalario>;
  updateRecibo: (id: number, p: Partial<ReciboSalario>) => Promise<ReciboSalario>;
  deleteRecibo: (id: number) => Promise<void>;
  addDeclaracao: (p: Partial<Declaracao>) => Promise<Declaracao>;
  updateDeclaracao: (id: number, p: Partial<Declaracao>) => Promise<Declaracao>;
  deleteDeclaracao: (id: number) => Promise<void>;
  addRequisicao: (p: Partial<Requisicao>) => Promise<Requisicao>;
  updateRequisicao: (id: number, p: Partial<Requisicao>) => Promise<Requisicao>;
  deleteRequisicao: (id: number) => Promise<void>;
  addCentroCusto: (p: Partial<CentroCusto>) => Promise<CentroCusto>;
  updateCentroCusto: (id: number, p: Partial<CentroCusto>) => Promise<CentroCusto>;
  deleteCentroCusto: (id: number) => Promise<void>;
  addProjecto: (p: Partial<Projecto>) => Promise<Projecto>;
  updateProjecto: (id: number, p: Partial<Projecto>) => Promise<Projecto>;
  deleteProjecto: (id: number) => Promise<void>;
  addReuniao: (p: Partial<Reuniao>) => Promise<Reuniao>;
  updateReuniao: (id: number, p: Partial<Reuniao>) => Promise<Reuniao>;
  deleteReuniao: (id: number) => Promise<void>;
  addActa: (p: Partial<Acta>) => Promise<Acta>;
  updateActa: (id: number, p: Partial<Acta>) => Promise<Acta>;
  deleteActa: (id: number) => Promise<void>;
  addPagamento: (p: Partial<Pagamento>) => Promise<Pagamento>;
  addMovimentoTesouraria: (p: Partial<MovimentoTesouraria>) => Promise<MovimentoTesouraria>;
  updateMovimentoTesouraria: (id: number, p: Partial<MovimentoTesouraria>) => Promise<MovimentoTesouraria>;
  deleteMovimentoTesouraria: (id: number) => Promise<void>;
  addBanco: (p: Partial<Banco>) => Promise<Banco>;
  updateBanco: (id: number, p: Partial<Banco>) => Promise<Banco>;
  deleteBanco: (id: number) => Promise<void>;
  addContaBancaria: (p: Partial<ContaBancaria>) => Promise<ContaBancaria>;
  updateContaBancaria: (id: number, p: Partial<ContaBancaria>) => Promise<ContaBancaria>;
  deleteContaBancaria: (id: number) => Promise<void>;
  addCorrespondencia: (p: Partial<Correspondencia>) => Promise<Correspondencia>;
  updateCorrespondencia: (id: number, p: Partial<Correspondencia>) => Promise<Correspondencia>;
  deleteCorrespondencia: (id: number) => Promise<void>;
  addDocumentoOficial: (p: Partial<DocumentoOficial>) => Promise<DocumentoOficial>;
  updateDocumentoOficial: (id: number, p: Partial<DocumentoOficial>) => Promise<DocumentoOficial>;
  deleteDocumentoOficial: (id: number) => Promise<void>;
  addPendencia: (p: Partial<PendenciaDocumental>) => Promise<PendenciaDocumental>;
  updatePendencia: (id: number, p: Partial<PendenciaDocumental>) => Promise<PendenciaDocumental>;
  deletePendencia: (id: number) => Promise<void>;
  addRelatorioPlaneamento: (p: Partial<RelatorioMensalPlaneamento>) => Promise<RelatorioMensalPlaneamento>;
  updateRelatorioPlaneamento: (id: number, p: Partial<RelatorioMensalPlaneamento>) => Promise<RelatorioMensalPlaneamento>;
  deleteRelatorioPlaneamento: (id: number) => Promise<void>;
  addNoticia: (p: Partial<Noticia>) => Promise<Noticia>;
  updateNoticia: (id: number, p: Partial<Noticia>) => Promise<Noticia>;
  deleteNoticia: (id: number) => Promise<void>;
  addEvento: (p: Partial<Evento>) => Promise<Evento>;
  updateEvento: (id: number, p: Partial<Evento>) => Promise<Evento>;
  deleteEvento: (id: number) => Promise<void>;
  addComunicado: (p: Partial<Comunicado>) => Promise<Comunicado>;
  updateComunicado: (id: number, p: Partial<Comunicado>) => Promise<Comunicado>;
  deleteComunicado: (id: number) => Promise<void>;
  /** Módulos e rotas desactivados globalmente (Admin em Configurações). */
  organizacaoSettings: OrganizacaoSettings;
  updateOrganizacaoSettings: (next: OrganizacaoSettings) => Promise<OrganizacaoSettings>;
  patrimonioActivos: PatrimonioActivo[];
  setPatrimonioActivos: React.Dispatch<React.SetStateAction<PatrimonioActivo[]>>;
  patrimonioMovimentos: PatrimonioMovimento[];
  setPatrimonioMovimentos: React.Dispatch<React.SetStateAction<PatrimonioMovimento[]>>;
  patrimonioVerificacoes: PatrimonioVerificacao[];
  setPatrimonioVerificacoes: React.Dispatch<React.SetStateAction<PatrimonioVerificacao[]>>;
  patrimonioVerificacaoItens: PatrimonioVerificacaoItem[];
  setPatrimonioVerificacaoItens: React.Dispatch<React.SetStateAction<PatrimonioVerificacaoItem[]>>;
  patrimonioCategorias: PatrimonioCategoriaCfg[];
  setPatrimonioCategorias: React.Dispatch<React.SetStateAction<PatrimonioCategoriaCfg[]>>;
  patrimonioSubcategorias: PatrimonioSubcategoriaCfg[];
  setPatrimonioSubcategorias: React.Dispatch<React.SetStateAction<PatrimonioSubcategoriaCfg[]>>;
  addPatrimonioCategoria: (p: Partial<PatrimonioCategoriaCfg>) => Promise<PatrimonioCategoriaCfg>;
  updatePatrimonioCategoria: (id: number, p: Partial<PatrimonioCategoriaCfg>) => Promise<PatrimonioCategoriaCfg>;
  deletePatrimonioCategoria: (id: number) => Promise<void>;
  addPatrimonioSubcategoria: (p: Partial<PatrimonioSubcategoriaCfg>) => Promise<PatrimonioSubcategoriaCfg>;
  updatePatrimonioSubcategoria: (id: number, p: Partial<PatrimonioSubcategoriaCfg>) => Promise<PatrimonioSubcategoriaCfg>;
  deletePatrimonioSubcategoria: (id: number) => Promise<void>;
  addPatrimonioActivo: (p: Partial<PatrimonioActivo>) => Promise<PatrimonioActivo>;
  updatePatrimonioActivo: (id: number, p: Partial<PatrimonioActivo>) => Promise<PatrimonioActivo>;
  deletePatrimonioActivo: (id: number) => Promise<void>;
  addPatrimonioMovimento: (p: Partial<PatrimonioMovimento>) => Promise<PatrimonioMovimento>;
  addPatrimonioVerificacao: (p: Partial<PatrimonioVerificacao>) => Promise<PatrimonioVerificacao>;
  updatePatrimonioVerificacao: (id: number, p: Partial<PatrimonioVerificacao>) => Promise<PatrimonioVerificacao>;
  deletePatrimonioVerificacao: (id: number) => Promise<void>;
  addPatrimonioVerificacaoItem: (p: Partial<PatrimonioVerificacaoItem>) => Promise<PatrimonioVerificacaoItem>;
  updatePatrimonioVerificacaoItem: (id: number, p: Partial<PatrimonioVerificacaoItem>) => Promise<PatrimonioVerificacaoItem>;
  deletePatrimonioVerificacaoItem: (id: number) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const emptyArrays = {
  empresas: [] as Empresa[],
  departamentos: [] as Departamento[],
  colaboradores: [] as Colaborador[],
  ferias: [] as Ferias[],
  faltas: [] as Falta[],
  recibos: [] as ReciboSalario[],
  declaracoes: [] as Declaracao[],
  requisicoes: [] as Requisicao[],
  centrosCusto: [] as CentroCusto[],
  projectos: [] as Projecto[],
  reunioes: [] as Reuniao[],
  actas: [] as Acta[],
  irtEscalaes: [] as IRTEscalao[],
  contratos: [] as Contrato[],
  processos: [] as ProcessoJudicial[],
  prazos: [] as PrazoLegal[],
  correspondencias: [] as Correspondencia[],
  documentosOficiais: [] as DocumentoOficial[],
  riscos: [] as RiscoJuridico[],
  pagamentos: [] as Pagamento[],
  pendencias: [] as PendenciaDocumental[],
  movimentosTesouraria: [] as MovimentoTesouraria[],
  bancos: [] as Banco[],
  contasBancarias: [] as ContaBancaria[],
  relatoriosPlaneamento: [] as RelatorioMensalPlaneamento[],
  noticias: [] as Noticia[],
  eventos: [] as Evento[],
  comunicados: [] as Comunicado[],
  processosDisciplinares: [] as ProcessoDisciplinar[],
  rescissoesContrato: [] as RescisaoContrato[],
  geofences: [] as Geofence[],
  colaboradorGeofenceLinks: [] as ColaboradorGeofenceLink[],
  patrimonioActivos: [] as PatrimonioActivo[],
  patrimonioMovimentos: [] as PatrimonioMovimento[],
  patrimonioVerificacoes: [] as PatrimonioVerificacao[],
  patrimonioVerificacaoItens: [] as PatrimonioVerificacaoItem[],
  patrimonioCategorias: [] as PatrimonioCategoriaCfg[],
  patrimonioSubcategorias: [] as PatrimonioSubcategoriaCfg[],
};

export function DataProvider({ children }: { children: ReactNode }) {
  const { currentEmpresaId } = useTenant();
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>(emptyArrays.empresas);
  const [departamentos, setDepartamentos] = useState<Departamento[]>(emptyArrays.departamentos);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>(emptyArrays.colaboradores);
  const [ferias, setFerias] = useState<Ferias[]>(emptyArrays.ferias);
  const [faltas, setFaltas] = useState<Falta[]>(emptyArrays.faltas);
  const [recibos, setRecibos] = useState<ReciboSalario[]>(emptyArrays.recibos);
  const [declaracoes, setDeclaracoes] = useState<Declaracao[]>(emptyArrays.declaracoes);
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>(emptyArrays.requisicoes);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>(emptyArrays.centrosCusto);
  const [projectos, setProjectos] = useState<Projecto[]>(emptyArrays.projectos);
  const [reunioes, setReunioes] = useState<Reuniao[]>(emptyArrays.reunioes);
  const [actas, setActas] = useState<Acta[]>(emptyArrays.actas);
  const [irtEscalaes, setIrtEscalaes] = useState<IRTEscalao[]>(emptyArrays.irtEscalaes);
  const [contratos, setContratos] = useState<Contrato[]>(emptyArrays.contratos);
  const [processos, setProcessos] = useState<ProcessoJudicial[]>(emptyArrays.processos);
  const [prazos, setPrazos] = useState<PrazoLegal[]>(emptyArrays.prazos);
  const [correspondencias, setCorrespondencias] = useState<Correspondencia[]>(emptyArrays.correspondencias);
  const [documentosOficiais, setDocumentosOficiais] = useState<DocumentoOficial[]>(emptyArrays.documentosOficiais);
  const [riscos, setRiscos] = useState<RiscoJuridico[]>(emptyArrays.riscos);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(emptyArrays.pagamentos);
  const [pendencias, setPendencias] = useState<PendenciaDocumental[]>(emptyArrays.pendencias);
  const [movimentosTesouraria, setMovimentosTesouraria] = useState<MovimentoTesouraria[]>(emptyArrays.movimentosTesouraria);
  const [bancos, setBancos] = useState<Banco[]>(emptyArrays.bancos);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>(emptyArrays.contasBancarias);
  const [relatoriosPlaneamento, setRelatoriosPlaneamento] = useState<RelatorioMensalPlaneamento[]>(emptyArrays.relatoriosPlaneamento);
  const [noticias, setNoticias] = useState<Noticia[]>(emptyArrays.noticias);
  const [eventos, setEventos] = useState<Evento[]>(emptyArrays.eventos);
  const [comunicados, setComunicados] = useState<Comunicado[]>(emptyArrays.comunicados);
  const [processosDisciplinares, setProcessosDisciplinares] = useState<ProcessoDisciplinar[]>(emptyArrays.processosDisciplinares);
  const [rescissoesContrato, setRescissoesContrato] = useState<RescisaoContrato[]>(emptyArrays.rescissoesContrato);
  const [geofences, setGeofences] = useState<Geofence[]>(emptyArrays.geofences);
  const [colaboradorGeofenceLinks, setColaboradorGeofenceLinks] = useState<ColaboradorGeofenceLink[]>(
    emptyArrays.colaboradorGeofenceLinks,
  );
  const [patrimonioActivos, setPatrimonioActivos] = useState<PatrimonioActivo[]>(emptyArrays.patrimonioActivos);
  const [patrimonioMovimentos, setPatrimonioMovimentos] = useState<PatrimonioMovimento[]>(emptyArrays.patrimonioMovimentos);
  const [patrimonioVerificacoes, setPatrimonioVerificacoes] = useState<PatrimonioVerificacao[]>(
    emptyArrays.patrimonioVerificacoes,
  );
  const [patrimonioVerificacaoItens, setPatrimonioVerificacaoItens] = useState<PatrimonioVerificacaoItem[]>(
    emptyArrays.patrimonioVerificacaoItens,
  );
  const [patrimonioCategorias, setPatrimonioCategorias] = useState<PatrimonioCategoriaCfg[]>(emptyArrays.patrimonioCategorias);
  const [patrimonioSubcategorias, setPatrimonioSubcategorias] = useState<PatrimonioSubcategoriaCfg[]>(
    emptyArrays.patrimonioSubcategorias,
  );
  const [organizacaoSettings, setOrganizacaoSettings] = useState<OrganizacaoSettings>({
    modulosDesactivados: [],
    recursosDesactivados: [],
  });

  // Realtime: mantém os arrays do DataContext sincronizados sem refresh/polling.
  const empresasRT = useRealtimeTable<Empresa>('empresas', 'id');
  const departamentosRT = useRealtimeTable<Departamento>('departamentos', 'id');
  const colaboradoresRT = useRealtimeTable<Colaborador>('colaboradores', 'id');
  const feriasRT = useRealtimeTable<Ferias>('ferias', 'id');
  const faltasRT = useRealtimeTable<Falta>('faltas', 'id');
  const recibosRT = useRealtimeTable<ReciboSalario>('recibos_salario', 'id');
  const declaracoesRT = useRealtimeTable<Declaracao>('declaracoes', 'id');
  const noticiasRT = useRealtimeTable<Noticia>('noticias', 'id');
  const eventosRT = useRealtimeTable<Evento>('eventos', 'id');
  const comunicadosRT = useRealtimeTable<Comunicado>('comunicados', 'id');
  const requisicoesRT = useRealtimeTable<Requisicao>('requisicoes', 'id');
  const centrosCustoRT = useRealtimeTable<CentroCusto>('centros_custo', 'id');
  const projectosRT = useRealtimeTable<Projecto>('projectos', 'id');
  const reunioesRT = useRealtimeTable<Reuniao>('reunioes', 'id');
  const actasRT = useRealtimeTable<Acta>('actas', 'id');
  const contratosRT = useRealtimeTable<Contrato>('contratos', 'id');
  const processosRT = useRealtimeTable<ProcessoJudicial>('processos_judiciais', 'id');
  const prazosRT = useRealtimeTable<PrazoLegal>('prazos_legais', 'id');
  const correspondenciasRT = useRealtimeTable<Correspondencia>('correspondencias', 'id');
  const documentosOficiaisRT = useRealtimeTable<DocumentoOficial>('documentos_oficiais', 'id');
  const riscosRT = useRealtimeTable<RiscoJuridico>('riscos_juridicos', 'id');
  const pagamentosRT = useRealtimeTable<Pagamento>('pagamentos', 'id');
  const pendenciasRT = useRealtimeTable<PendenciaDocumental>('pendencias_documentais', 'id');
  const movimentosTesourariaRT = useRealtimeTable<MovimentoTesouraria>('movimentos_tesouraria', 'id');
  const bancosRT = useRealtimeTable<Banco>('bancos', 'id');
  const contasBancariasRT = useRealtimeTable<ContaBancaria>('contas_bancarias', 'id');
  const relatoriosPlaneamentoRT = useRealtimeTable<RelatorioMensalPlaneamento>('relatorios_planeamento', 'id');
  const processosDisciplinaresRT = useRealtimeTable<ProcessoDisciplinar>('processos_disciplinares', 'id');
  const rescissoesContratoRT = useRealtimeTable<RescisaoContrato>('rescisoes_contrato', 'id');
  const geofencesRT = useRealtimeTable<Geofence>('geofences', 'id');
  const colaboradorGeofencesRT = useRealtimeTable<ColaboradorGeofenceLink>('colaborador_geofences', 'id');

  const realtimeLoading =
    empresasRT.isLoading ||
    departamentosRT.isLoading ||
    colaboradoresRT.isLoading ||
    feriasRT.isLoading ||
    faltasRT.isLoading ||
    recibosRT.isLoading ||
    declaracoesRT.isLoading ||
    noticiasRT.isLoading ||
    eventosRT.isLoading ||
    comunicadosRT.isLoading ||
    requisicoesRT.isLoading ||
    centrosCustoRT.isLoading ||
    projectosRT.isLoading ||
    reunioesRT.isLoading ||
    actasRT.isLoading ||
    contratosRT.isLoading ||
    processosRT.isLoading ||
    prazosRT.isLoading ||
    correspondenciasRT.isLoading ||
    documentosOficiaisRT.isLoading ||
    riscosRT.isLoading ||
    pagamentosRT.isLoading ||
    pendenciasRT.isLoading ||
    movimentosTesourariaRT.isLoading ||
    bancosRT.isLoading ||
    contasBancariasRT.isLoading ||
    relatoriosPlaneamentoRT.isLoading ||
    processosDisciplinaresRT.isLoading ||
    rescissoesContratoRT.isLoading ||
    geofencesRT.isLoading ||
    colaboradorGeofencesRT.isLoading;

  useEffect(() => {
    setDataLoading(realtimeLoading);
    if (!realtimeLoading) setDataError(null);
  }, [realtimeLoading]);

  useEffect(() => setEmpresas(empresasRT.rows), [empresasRT.rows]);
  useEffect(() => setDepartamentos(departamentosRT.rows), [departamentosRT.rows]);
  useEffect(() => setColaboradores(colaboradoresRT.rows), [colaboradoresRT.rows]);
  useEffect(() => setFerias(feriasRT.rows), [feriasRT.rows]);
  useEffect(() => setFaltas(faltasRT.rows), [faltasRT.rows]);
  useEffect(() => setRecibos(recibosRT.rows), [recibosRT.rows]);
  useEffect(() => setDeclaracoes(declaracoesRT.rows), [declaracoesRT.rows]);
  useEffect(() => setNoticias(noticiasRT.rows), [noticiasRT.rows]);
  useEffect(() => setEventos(eventosRT.rows), [eventosRT.rows]);
  useEffect(() => setComunicados(comunicadosRT.rows), [comunicadosRT.rows]);
  useEffect(() => setRequisicoes(requisicoesRT.rows), [requisicoesRT.rows]);
  useEffect(() => setCentrosCusto(centrosCustoRT.rows), [centrosCustoRT.rows]);
  useEffect(() => setProjectos(projectosRT.rows), [projectosRT.rows]);
  useEffect(() => setReunioes(reunioesRT.rows), [reunioesRT.rows]);
  useEffect(() => setActas(actasRT.rows), [actasRT.rows]);
  useEffect(() => setContratos(contratosRT.rows), [contratosRT.rows]);
  useEffect(() => setProcessos(processosRT.rows), [processosRT.rows]);
  useEffect(() => setPrazos(prazosRT.rows), [prazosRT.rows]);
  useEffect(() => setCorrespondencias(correspondenciasRT.rows), [correspondenciasRT.rows]);
  useEffect(() => setDocumentosOficiais(documentosOficiaisRT.rows), [documentosOficiaisRT.rows]);
  useEffect(() => setRiscos(riscosRT.rows), [riscosRT.rows]);
  useEffect(() => setPagamentos(pagamentosRT.rows), [pagamentosRT.rows]);
  useEffect(() => setPendencias(pendenciasRT.rows), [pendenciasRT.rows]);
  useEffect(() => setMovimentosTesouraria(movimentosTesourariaRT.rows), [movimentosTesourariaRT.rows]);
  useEffect(() => setBancos(bancosRT.rows), [bancosRT.rows]);
  useEffect(() => setContasBancarias(contasBancariasRT.rows), [contasBancariasRT.rows]);
  useEffect(() => setRelatoriosPlaneamento(relatoriosPlaneamentoRT.rows), [relatoriosPlaneamentoRT.rows]);
  useEffect(() => setProcessosDisciplinares(processosDisciplinaresRT.rows), [processosDisciplinaresRT.rows]);
  useEffect(() => setRescissoesContrato(rescissoesContratoRT.rows), [rescissoesContratoRT.rows]);
  useEffect(() => setGeofences(geofencesRT.rows), [geofencesRT.rows]);
  useEffect(() => setColaboradorGeofenceLinks(colaboradorGeofencesRT.rows), [colaboradorGeofencesRT.rows]);

  const reloadOrganizacaoSettings = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured()) {
      setOrganizacaoSettings({ modulosDesactivados: [], recursosDesactivados: [] });
      return;
    }
    try {
      const s = await fetchOrganizacaoSettings(supabase);
      setOrganizacaoSettings(s);
    } catch {
      setOrganizacaoSettings({ modulosDesactivados: [], recursosDesactivados: [] });
    }
  }, []);

  const updateOrganizacaoSettings = useCallback(
    async (next: OrganizacaoSettings) => {
      if (!supabase || !isSupabaseConfigured()) throw new Error('Supabase não configurado');
      const saved = await upsertOrganizacaoSettings(supabase, next);
      setOrganizacaoSettings(saved);
      return saved;
    },
    [],
  );

  const refetch = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured()) {
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    setDataError(null);
    try {
      await reloadOrganizacaoSettings();
      const data = await loadAllTables(supabase);
      setEmpresas(data.empresas);
      setDepartamentos(data.departamentos);
      setColaboradores(data.colaboradores);
      setFerias(data.ferias);
      setFaltas(data.faltas);
      setRecibos(data.recibos);
      setDeclaracoes(data.declaracoes);
      setRequisicoes(data.requisicoes);
      setCentrosCusto(data.centrosCusto);
      setProjectos(data.projectos);
      setReunioes(data.reunioes);
      setActas(data.actas);
      setIrtEscalaes(data.irtEscalaes);
      setContratos(data.contratos);
      setProcessos(data.processos);
      setPrazos(data.prazos);
      setCorrespondencias(data.correspondencias);
      setDocumentosOficiais(data.documentosOficiais);
      setRiscos(data.riscos);
      setPagamentos(data.pagamentos);
      setPendencias(data.pendencias);
      setMovimentosTesouraria(data.movimentosTesouraria);
      setBancos(data.bancos);
      setContasBancarias(data.contasBancarias);
      setRelatoriosPlaneamento(data.relatoriosPlaneamento);
      setNoticias(data.noticias);
      setEventos(data.eventos);
      setComunicados(data.comunicados);
      setProcessosDisciplinares(data.processosDisciplinares);
      setRescissoesContrato(data.rescissoesContrato);
      setGeofences(data.geofences);
      setColaboradorGeofenceLinks(data.colaboradorGeofenceLinks);
      setPatrimonioActivos(data.patrimonioActivos);
      setPatrimonioMovimentos(data.patrimonioMovimentos);
      setPatrimonioVerificacoes(data.patrimonioVerificacoes);
      setPatrimonioVerificacaoItens(data.patrimonioVerificacaoItens);
      setPatrimonioCategorias(data.patrimonioCategorias);
      setPatrimonioSubcategorias(data.patrimonioSubcategorias);
    } catch (e) {
      setDataError(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setDataLoading(false);
    }
  }, [reloadOrganizacaoSettings]);

  useEffect(() => {
    reloadOrganizacaoSettings();
  }, [reloadOrganizacaoSettings]);

  const filtered = useMemo(() => {
    const isConsolidado = currentEmpresaId === 'consolidado';
    const colabs = isConsolidado ? colaboradores : colaboradores.filter(c => c.empresaId === currentEmpresaId);
    const colabIds = new Set(colabs.map(c => c.id));
    const reqs = isConsolidado ? requisicoes : requisicoes.filter(r => r.empresaId === currentEmpresaId);
    const reqIds = new Set(reqs.map(r => r.id));
    return {
      colaboradores: colabs,
      requisicoes: reqs,
      centrosCusto: isConsolidado ? centrosCusto : centrosCusto.filter(cc => cc.empresaId === currentEmpresaId),
      projectos: isConsolidado ? projectos : projectos.filter(p => p.empresaId === currentEmpresaId),
      ferias: isConsolidado ? ferias : ferias.filter(f => colabIds.has(f.colaboradorId)),
      faltas: isConsolidado ? faltas : faltas.filter(f => colabIds.has(f.colaboradorId)),
      recibos: isConsolidado ? recibos : recibos.filter(r => colabIds.has(r.colaboradorId)),
      declaracoes: isConsolidado ? declaracoes : declaracoes.filter(d => colabIds.has(d.colaboradorId)),
      pagamentos: isConsolidado ? pagamentos : pagamentos.filter(p => reqIds.has(p.requisicaoId)),
      movimentosTesouraria: isConsolidado ? movimentosTesouraria : movimentosTesouraria.filter(m => m.empresaId === currentEmpresaId),
      contasBancarias: isConsolidado ? contasBancarias : contasBancarias.filter(c => c.empresaId === currentEmpresaId),
      relatoriosPlaneamento: isConsolidado ? relatoriosPlaneamento : relatoriosPlaneamento.filter(r => r.empresaId === currentEmpresaId),
      noticias: isConsolidado ? noticias : noticias.filter(n => n.empresaId === currentEmpresaId),
      eventos: isConsolidado ? eventos : eventos.filter(e => e.empresaId === currentEmpresaId),
      comunicados: isConsolidado ? comunicados : comunicados.filter(c => c.empresaId === currentEmpresaId),
      processosDisciplinares: isConsolidado ? processosDisciplinares : processosDisciplinares.filter(p => p.empresaId === currentEmpresaId),
      rescissoesContrato: isConsolidado ? rescissoesContrato : rescissoesContrato.filter(r => r.empresaId === currentEmpresaId),
      contratos: isConsolidado ? contratos : contratos.filter(c => c.empresaId == null || c.empresaId === currentEmpresaId),
      processos: isConsolidado ? processos : processos.filter(p => p.empresaId == null || p.empresaId === currentEmpresaId),
      prazos: isConsolidado ? prazos : prazos.filter(pr => pr.empresaId == null || pr.empresaId === currentEmpresaId),
      riscos: isConsolidado ? riscos : riscos.filter(r => r.empresaId == null || r.empresaId === currentEmpresaId),
      patrimonioActivos: isConsolidado ? patrimonioActivos : patrimonioActivos.filter(a => a.empresaId === currentEmpresaId),
      patrimonioMovimentos: isConsolidado
        ? patrimonioMovimentos
        : patrimonioMovimentos.filter(m => m.empresaId === currentEmpresaId),
      patrimonioVerificacoes: isConsolidado
        ? patrimonioVerificacoes
        : patrimonioVerificacoes.filter(v => v.empresaId === currentEmpresaId),
      patrimonioVerificacaoItens: (() => {
        if (isConsolidado) return patrimonioVerificacaoItens;
        const verIds = new Set(
          patrimonioVerificacoes.filter(v => v.empresaId === currentEmpresaId).map(v => v.id),
        );
        return patrimonioVerificacaoItens.filter(i => verIds.has(i.verificacaoId));
      })(),
    };
  }, [
    currentEmpresaId,
    colaboradores,
    requisicoes,
    centrosCusto,
    projectos,
    ferias,
    faltas,
    recibos,
    declaracoes,
    pagamentos,
    movimentosTesouraria,
    contasBancarias,
    relatoriosPlaneamento,
    noticias,
    eventos,
    comunicados,
    processosDisciplinares,
    rescissoesContrato,
    contratos,
    processos,
    prazos,
    riscos,
    patrimonioActivos,
    patrimonioMovimentos,
    patrimonioVerificacoes,
    patrimonioVerificacaoItens,
  ]);

  function runMutation<T>(fn: () => Promise<T>, then?: (result: T) => void): Promise<T> {
    if (!supabase || !isSupabaseConfigured()) return Promise.reject(new Error('Supabase não configurado'));
    return fn().then(result => {
      then?.(result);
      return result;
    });
  }

  const addContrato = useCallback(
    (p: Partial<Contrato>) =>
      runMutation(() => db.contratos.insert(supabase!, p), row => setContratos(prev => [...prev, row])),
    [runMutation]
  );
  const updateContrato = useCallback(
    (id: number, p: Partial<Contrato>) =>
      runMutation(() => db.contratos.update(supabase!, id, p), row => setContratos(prev => prev.map(c => (c.id === id ? row : c)))),
    [runMutation]
  );
  const deleteContrato = useCallback(
    (id: number) =>
      runMutation(() => (db.contratos.delete(supabase!, id) as Promise<void>), () => setContratos(prev => prev.filter(c => c.id !== id))),
    [runMutation]
  );

  const addProcesso = useCallback(
    (p: Partial<ProcessoJudicial>) =>
      runMutation(() => db.processos_judiciais.insert(supabase!, p), row => setProcessos(prev => [...prev, row])),
    [runMutation]
  );
  const updateProcesso = useCallback(
    (id: number, p: Partial<ProcessoJudicial>) =>
      runMutation(() => db.processos_judiciais.update(supabase!, id, p), row => setProcessos(prev => prev.map(x => (x.id === id ? row : x)))),
    [runMutation]
  );
  const deleteProcesso = useCallback(
    (id: number) =>
      runMutation(() => (db.processos_judiciais.delete(supabase!, id) as Promise<void>), () => setProcessos(prev => prev.filter(x => x.id !== id))),
    [runMutation]
  );

  const addPrazo = useCallback(
    (p: Partial<PrazoLegal>) =>
      runMutation(() => db.prazos_legais.insert(supabase!, p), row => setPrazos(prev => [...prev, row])),
    [runMutation]
  );
  const updatePrazo = useCallback(
    (id: number, p: Partial<PrazoLegal>) =>
      runMutation(() => db.prazos_legais.update(supabase!, id, p), row => setPrazos(prev => prev.map(x => (x.id === id ? row : x)))),
    [runMutation]
  );
  const deletePrazo = useCallback(
    (id: number) =>
      runMutation(() => (db.prazos_legais.delete(supabase!, id) as Promise<void>), () => setPrazos(prev => prev.filter(x => x.id !== id))),
    [runMutation]
  );

  const addRisco = useCallback(
    (p: Partial<RiscoJuridico>) =>
      runMutation(() => db.riscos_juridicos.insert(supabase!, p), row => setRiscos(prev => [...prev, row])),
    [runMutation]
  );
  const updateRisco = useCallback(
    (id: number, p: Partial<RiscoJuridico>) =>
      runMutation(() => db.riscos_juridicos.update(supabase!, id, p), row => setRiscos(prev => prev.map(x => (x.id === id ? row : x)))),
    [runMutation]
  );
  const deleteRisco = useCallback(
    (id: number) =>
      runMutation(() => (db.riscos_juridicos.delete(supabase!, id) as Promise<void>), () => setRiscos(prev => prev.filter(x => x.id !== id))),
    [runMutation]
  );

  const addRescisaoContrato = useCallback(
    (p: Partial<RescisaoContrato>) =>
      runMutation(() => db.rescisoes_contrato.insert(supabase!, p), row => setRescissoesContrato(prev => [...prev, row])),
    [runMutation]
  );

  const addProcessoDisciplinar = useCallback(
    (p: Partial<ProcessoDisciplinar>) =>
      runMutation(() => db.processos_disciplinares.insert(supabase!, p), row => setProcessosDisciplinares(prev => [...prev, row])),
    [runMutation]
  );

  const addEmpresa = useCallback(
    (p: Partial<Empresa>) =>
      runMutation(() => db.empresas.insert(supabase!, p), row => setEmpresas(prev => [...prev, row])),
    [runMutation]
  );
  const updateEmpresa = useCallback(
    (id: number, p: Partial<Empresa>) =>
      runMutation(() => db.empresas.update(supabase!, id, p), row => setEmpresas(prev => prev.map(e => (e.id === id ? row : e)))),
    [runMutation]
  );
  const deleteEmpresa = useCallback(
    (id: number) =>
      runMutation(() => (db.empresas.delete(supabase!, id) as Promise<void>), () => setEmpresas(prev => prev.filter(e => e.id !== id))),
    [runMutation]
  );

  const addDepartamento = useCallback(
    (p: Partial<Departamento>) =>
      runMutation(() => db.departamentos.insert(supabase!, p), row => setDepartamentos(prev => [...prev, row])),
    [runMutation]
  );
  const updateDepartamento = useCallback(
    (id: number, p: Partial<Departamento>) =>
      runMutation(() => db.departamentos.update(supabase!, id, p), row => setDepartamentos(prev => prev.map(d => (d.id === id ? row : d)))),
    [runMutation]
  );
  const deleteDepartamento = useCallback(
    (id: number) =>
      runMutation(() => (db.departamentos.delete(supabase!, id) as Promise<void>), () => setDepartamentos(prev => prev.filter(d => d.id !== id))),
    [runMutation]
  );

  const addColaborador = useCallback(
    (p: Partial<Colaborador>) =>
      runMutation(() => db.colaboradores.insert(supabase!, p), row => setColaboradores(prev => [...prev, row])),
    [runMutation]
  );
  const updateColaborador = useCallback(
    (id: number, p: Partial<Colaborador>) =>
      runMutation(() => db.colaboradores.update(supabase!, id, p), row => setColaboradores(prev => prev.map(c => (c.id === id ? row : c)))),
    [runMutation]
  );
  const deleteColaborador = useCallback(
    (id: number) =>
      runMutation(() => (db.colaboradores.delete(supabase!, id) as Promise<void>), () => setColaboradores(prev => prev.filter(c => c.id !== id))),
    [runMutation]
  );

  const addGeofence = useCallback(
    (p: Partial<Geofence>) =>
      runMutation(() => db.geofences.insert(supabase!, p), row => setGeofences(prev => [...prev, row])),
    [runMutation]
  );
  const updateGeofence = useCallback(
    (id: number, p: Partial<Geofence>) =>
      runMutation(() => db.geofences.update(supabase!, id, p), row => setGeofences(prev => prev.map(g => (g.id === id ? row : g)))),
    [runMutation]
  );
  const deleteGeofence = useCallback(
    (id: number) =>
      runMutation(
        () => db.geofences.delete(supabase!, id) as Promise<void>,
        () => {
          setGeofences(prev => prev.filter(g => g.id !== id));
          setColaboradorGeofenceLinks(prev => prev.filter(l => l.geofenceId !== id));
        },
      ),
    [runMutation]
  );

  const syncColaboradorGeofenceLinksForColaborador = useCallback(
    async (colaboradorId: number, geofenceIds: number[], colaboradorEmpresaId: number) => {
      if (!supabase || !isSupabaseConfigured()) throw new Error('Supabase não configurado');
      await syncColaboradorGeofenceLinksApi(supabase, colaboradorId, geofenceIds, colaboradorEmpresaId);
      const links = await fetchColaboradorGeofenceLinks(supabase);
      setColaboradorGeofenceLinks(links);
    },
    [],
  );

  const addFerias = useCallback(
    (p: Partial<Ferias>) =>
      runMutation(() => db.ferias.insert(supabase!, p), row => setFerias(prev => [...prev, row])),
    [runMutation]
  );
  const updateFerias = useCallback(
    (id: number, p: Partial<Ferias>) =>
      runMutation(() => db.ferias.update(supabase!, id, p), row => setFerias(prev => prev.map(f => (f.id === id ? row : f)))),
    [runMutation]
  );
  const deleteFerias = useCallback(
    (id: number) =>
      runMutation(() => (db.ferias.delete(supabase!, id) as Promise<void>), () => setFerias(prev => prev.filter(f => f.id !== id))),
    [runMutation]
  );

  const addFalta = useCallback(
    (p: Partial<Falta>) =>
      runMutation(() => db.faltas.insert(supabase!, p), row => setFaltas(prev => [...prev, row])),
    [runMutation]
  );
  const updateFalta = useCallback(
    (id: number, p: Partial<Falta>) =>
      runMutation(() => db.faltas.update(supabase!, id, p), row => setFaltas(prev => prev.map(f => (f.id === id ? row : f)))),
    [runMutation]
  );
  const deleteFalta = useCallback(
    (id: number) =>
      runMutation(() => (db.faltas.delete(supabase!, id) as Promise<void>), () => setFaltas(prev => prev.filter(f => f.id !== id))),
    [runMutation]
  );

  const addRecibo = useCallback(
    (p: Partial<ReciboSalario>) =>
      runMutation(() => db.recibos_salario.insert(supabase!, p), row => setRecibos(prev => [...prev, row])),
    [runMutation]
  );
  const updateRecibo = useCallback(
    (id: number, p: Partial<ReciboSalario>) =>
      runMutation(() => db.recibos_salario.update(supabase!, id, p), row => setRecibos(prev => prev.map(r => (r.id === id ? row : r)))),
    [runMutation]
  );
  const deleteRecibo = useCallback(
    (id: number) =>
      runMutation(() => (db.recibos_salario.delete(supabase!, id) as Promise<void>), () => setRecibos(prev => prev.filter(r => r.id !== id))),
    [runMutation]
  );

  const addDeclaracao = useCallback(
    (p: Partial<Declaracao>) =>
      runMutation(() => db.declaracoes.insert(supabase!, p), row => setDeclaracoes(prev => [...prev, row])),
    [runMutation]
  );
  const updateDeclaracao = useCallback(
    (id: number, p: Partial<Declaracao>) =>
      runMutation(() => db.declaracoes.update(supabase!, id, p), row => setDeclaracoes(prev => prev.map(d => (d.id === id ? row : d)))),
    [runMutation]
  );
  const deleteDeclaracao = useCallback(
    (id: number) =>
      runMutation(() => (db.declaracoes.delete(supabase!, id) as Promise<void>), () => setDeclaracoes(prev => prev.filter(d => d.id !== id))),
    [runMutation]
  );

  const addRequisicao = useCallback(
    (p: Partial<Requisicao>) =>
      runMutation(() => db.requisicoes.insert(supabase!, p), row => setRequisicoes(prev => [...prev, row])),
    [runMutation]
  );
  const updateRequisicao = useCallback(
    (id: number, p: Partial<Requisicao>) =>
      runMutation(() => db.requisicoes.update(supabase!, id, p), row => setRequisicoes(prev => prev.map(r => (r.id === id ? row : r)))),
    [runMutation]
  );
  const deleteRequisicao = useCallback(
    (id: number) =>
      runMutation(() => (db.requisicoes.delete(supabase!, id) as Promise<void>), () => setRequisicoes(prev => prev.filter(r => r.id !== id))),
    [runMutation]
  );

  const addCentroCusto = useCallback(
    (p: Partial<CentroCusto>) =>
      runMutation(() => db.centros_custo.insert(supabase!, p), row => setCentrosCusto(prev => [...prev, row])),
    [runMutation]
  );
  const updateCentroCusto = useCallback(
    (id: number, p: Partial<CentroCusto>) =>
      runMutation(() => db.centros_custo.update(supabase!, id, p), row => setCentrosCusto(prev => prev.map(c => (c.id === id ? row : c)))),
    [runMutation]
  );
  const deleteCentroCusto = useCallback(
    (id: number) =>
      runMutation(() => (db.centros_custo.delete(supabase!, id) as Promise<void>), () => setCentrosCusto(prev => prev.filter(c => c.id !== id))),
    [runMutation]
  );

  const addProjecto = useCallback(
    (p: Partial<Projecto>) =>
      runMutation(() => db.projectos.insert(supabase!, p), row => setProjectos(prev => [...prev, row])),
    [runMutation]
  );
  const updateProjecto = useCallback(
    (id: number, p: Partial<Projecto>) =>
      runMutation(() => db.projectos.update(supabase!, id, p), row => setProjectos(prev => prev.map(p => (p.id === id ? row : p)))),
    [runMutation]
  );
  const deleteProjecto = useCallback(
    (id: number) =>
      runMutation(() => (db.projectos.delete(supabase!, id) as Promise<void>), () => setProjectos(prev => prev.filter(p => p.id !== id))),
    [runMutation]
  );

  const addReuniao = useCallback(
    (p: Partial<Reuniao>) =>
      runMutation(() => db.reunioes.insert(supabase!, p), row => setReunioes(prev => [...prev, row])),
    [runMutation]
  );
  const updateReuniao = useCallback(
    (id: number, p: Partial<Reuniao>) =>
      runMutation(() => db.reunioes.update(supabase!, id, p), row => setReunioes(prev => prev.map(r => (r.id === id ? row : r)))),
    [runMutation]
  );
  const deleteReuniao = useCallback(
    (id: number) =>
      runMutation(() => (db.reunioes.delete(supabase!, id) as Promise<void>), () => setReunioes(prev => prev.filter(r => r.id !== id))),
    [runMutation]
  );

  const addActa = useCallback(
    (p: Partial<Acta>) =>
      runMutation(() => db.actas.insert(supabase!, p), row => setActas(prev => [...prev, row])),
    [runMutation]
  );
  const updateActa = useCallback(
    (id: number, p: Partial<Acta>) =>
      runMutation(() => db.actas.update(supabase!, id, p), row => setActas(prev => prev.map(a => (a.id === id ? row : a)))),
    [runMutation]
  );
  const deleteActa = useCallback(
    (id: number) =>
      runMutation(() => (db.actas.delete(supabase!, id) as Promise<void>), () => setActas(prev => prev.filter(a => a.id !== id))),
    [runMutation]
  );

  const addPagamento = useCallback(
    (p: Partial<Pagamento>) =>
      runMutation(() => db.pagamentos.insert(supabase!, p), row => setPagamentos(prev => [...prev, row])),
    [runMutation]
  );

  const addMovimentoTesouraria = useCallback(
    (p: Partial<MovimentoTesouraria>) =>
      runMutation(() => db.movimentos_tesouraria.insert(supabase!, p), row => {
        setMovimentosTesouraria(prev => [...prev, row]);
        if (row.contaBancariaId) {
          patchContaBancariaSaldo(setContasBancarias, row.contaBancariaId, saldoDeltaFromMovimento(row));
        }
      }),
    [runMutation]
  );
  const updateMovimentoTesouraria = useCallback(
    (id: number, p: Partial<MovimentoTesouraria>) => {
      const oldMov = movimentosTesouraria.find(m => m.id === id);
      return runMutation(() => db.movimentos_tesouraria.update(supabase!, id, p), row => {
        setMovimentosTesouraria(prev => prev.map(m => (m.id === id ? row : m)));
        if (oldMov?.contaBancariaId) {
          patchContaBancariaSaldo(setContasBancarias, oldMov.contaBancariaId, -saldoDeltaFromMovimento(oldMov));
        }
        if (row.contaBancariaId) {
          patchContaBancariaSaldo(setContasBancarias, row.contaBancariaId, saldoDeltaFromMovimento(row));
        }
      });
    },
    [runMutation, movimentosTesouraria]
  );
  const deleteMovimentoTesouraria = useCallback(
    (id: number) => {
      const oldMov = movimentosTesouraria.find(m => m.id === id);
      return runMutation(
        () => db.movimentos_tesouraria.delete(supabase!, id) as Promise<void>,
        () => {
          setMovimentosTesouraria(prev => prev.filter(m => m.id !== id));
          if (oldMov?.contaBancariaId) {
            patchContaBancariaSaldo(setContasBancarias, oldMov.contaBancariaId, -saldoDeltaFromMovimento(oldMov));
          }
        },
      );
    },
    [runMutation, movimentosTesouraria]
  );

  const addBanco = useCallback(
    (p: Partial<Banco>) => runMutation(() => db.bancos.insert(supabase!, p), row => setBancos(prev => [...prev, row])),
    [runMutation]
  );
  const updateBanco = useCallback(
    (id: number, p: Partial<Banco>) =>
      runMutation(() => db.bancos.update(supabase!, id, p), row => setBancos(prev => prev.map(b => (b.id === id ? row : b)))),
    [runMutation]
  );
  const deleteBanco = useCallback(
    (id: number) => runMutation(() => (db.bancos.delete(supabase!, id) as Promise<void>), () => setBancos(prev => prev.filter(b => b.id !== id))),
    [runMutation]
  );

  const addContaBancaria = useCallback(
    (p: Partial<ContaBancaria>) =>
      runMutation(async () => {
        const opening = Math.max(0, Number(p.saldoActual) || 0);
        const row = await db.contas_bancarias.insert(supabase!, { ...p, saldoActual: 0 });
        if (opening > 0) {
          const referencia = nextReferenciaTesouraria(movimentosTesouraria, row.empresaId, 'entrada');
          const registadoEm = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const hoje = new Date().toISOString().slice(0, 10);
          const mov = await db.movimentos_tesouraria.insert(supabase!, {
            empresaId: row.empresaId,
            tipo: 'entrada',
            referencia,
            valor: opening,
            data: hoje,
            metodoPagamento: 'Transferência',
            descricao: `Saldo inicial — conta bancária n.º ${row.numeroConta}`,
            origem: 'Abertura de conta',
            contaBancariaId: row.id,
            registadoEm,
          });
          setMovimentosTesouraria(prev => [...prev, mov]);
        }
        return opening > 0 ? { ...row, saldoActual: opening } : row;
      }, row => setContasBancarias(prev => [...prev, row])),
    [runMutation, movimentosTesouraria],
  );
  const updateContaBancaria = useCallback(
    (id: number, p: Partial<ContaBancaria>) =>
      runMutation(() => db.contas_bancarias.update(supabase!, id, p), row => setContasBancarias(prev => prev.map(c => (c.id === id ? row : c)))),
    [runMutation]
  );
  const deleteContaBancaria = useCallback(
    (id: number) =>
      runMutation(() => (db.contas_bancarias.delete(supabase!, id) as Promise<void>), () => setContasBancarias(prev => prev.filter(c => c.id !== id))),
    [runMutation]
  );

  const addCorrespondencia = useCallback(
    (p: Partial<Correspondencia>) =>
      runMutation(() => db.correspondencias.insert(supabase!, p), row => setCorrespondencias(prev => [...prev, row])),
    [runMutation]
  );
  const updateCorrespondencia = useCallback(
    (id: number, p: Partial<Correspondencia>) =>
      runMutation(() => db.correspondencias.update(supabase!, id, p), row => setCorrespondencias(prev => prev.map(c => (c.id === id ? row : c)))),
    [runMutation]
  );
  const deleteCorrespondencia = useCallback(
    (id: number) =>
      runMutation(() => (db.correspondencias.delete(supabase!, id) as Promise<void>), () => setCorrespondencias(prev => prev.filter(c => c.id !== id))),
    [runMutation]
  );

  const addDocumentoOficial = useCallback(
    (p: Partial<DocumentoOficial>) =>
      runMutation(() => db.documentos_oficiais.insert(supabase!, p), row => setDocumentosOficiais(prev => [...prev, row])),
    [runMutation]
  );
  const updateDocumentoOficial = useCallback(
    (id: number, p: Partial<DocumentoOficial>) =>
      runMutation(() => db.documentos_oficiais.update(supabase!, id, p), row => setDocumentosOficiais(prev => prev.map(d => (d.id === id ? row : d)))),
    [runMutation]
  );
  const deleteDocumentoOficial = useCallback(
    (id: number) =>
      runMutation(() => (db.documentos_oficiais.delete(supabase!, id) as Promise<void>), () => setDocumentosOficiais(prev => prev.filter(d => d.id !== id))),
    [runMutation]
  );

  const addPendencia = useCallback(
    (p: Partial<PendenciaDocumental>) =>
      runMutation(() => db.pendencias_documentais.insert(supabase!, p), row => setPendencias(prev => [...prev, row])),
    [runMutation]
  );
  const updatePendencia = useCallback(
    (id: number, p: Partial<PendenciaDocumental>) =>
      runMutation(() => db.pendencias_documentais.update(supabase!, id, p), row => setPendencias(prev => prev.map(p => (p.id === id ? row : p)))),
    [runMutation]
  );
  const deletePendencia = useCallback(
    (id: number) =>
      runMutation(() => (db.pendencias_documentais.delete(supabase!, id) as Promise<void>), () => setPendencias(prev => prev.filter(p => p.id !== id))),
    [runMutation]
  );

  const addRelatorioPlaneamento = useCallback(
    (p: Partial<RelatorioMensalPlaneamento>) =>
      runMutation(() => db.relatorios_planeamento.insert(supabase!, p), row => setRelatoriosPlaneamento(prev => [...prev, row])),
    [runMutation]
  );
  const updateRelatorioPlaneamento = useCallback(
    (id: number, p: Partial<RelatorioMensalPlaneamento>) =>
      runMutation(() => db.relatorios_planeamento.update(supabase!, id, p), row => setRelatoriosPlaneamento(prev => prev.map(r => (r.id === id ? row : r)))),
    [runMutation]
  );
  const deleteRelatorioPlaneamento = useCallback(
    (id: number) =>
      runMutation(() => (db.relatorios_planeamento.delete(supabase!, id) as Promise<void>), () => setRelatoriosPlaneamento(prev => prev.filter(r => r.id !== id))),
    [runMutation]
  );

  const addNoticia = useCallback(
    (p: Partial<Noticia>) =>
      runMutation(() => db.noticias.insert(supabase!, p), row => setNoticias(prev => [...prev, row])),
    [runMutation]
  );

  const updateNoticia = useCallback(
    (id: number, p: Partial<Noticia>) =>
      runMutation(() => db.noticias.update(supabase!, id, p), row => setNoticias(prev => prev.map(n => (n.id === id ? row : n)))),
    [runMutation]
  );

  const deleteNoticia = useCallback(
    (id: number) =>
      runMutation(() => (db.noticias.delete(supabase!, id) as Promise<void>), () => setNoticias(prev => prev.filter(n => n.id !== id))),
    [runMutation]
  );

  const addEvento = useCallback(
    (p: Partial<Evento>) =>
      runMutation(() => db.eventos.insert(supabase!, p), row => setEventos(prev => [...prev, row])),
    [runMutation]
  );

  const updateEvento = useCallback(
    (id: number, p: Partial<Evento>) =>
      runMutation(() => db.eventos.update(supabase!, id, p), row => setEventos(prev => prev.map(e => (e.id === id ? row : e)))),
    [runMutation]
  );

  const deleteEvento = useCallback(
    (id: number) =>
      runMutation(() => (db.eventos.delete(supabase!, id) as Promise<void>), () => setEventos(prev => prev.filter(e => e.id !== id))),
    [runMutation]
  );

  const addComunicado = useCallback(
    (p: Partial<Comunicado>) =>
      runMutation(() => db.comunicados.insert(supabase!, p), row => setComunicados(prev => [...prev, row])),
    [runMutation]
  );

  const updateComunicado = useCallback(
    (id: number, p: Partial<Comunicado>) =>
      runMutation(() => db.comunicados.update(supabase!, id, p), row => setComunicados(prev => prev.map(c => (c.id === id ? row : c)))),
    [runMutation]
  );

  const deleteComunicado = useCallback(
    (id: number) =>
      runMutation(() => (db.comunicados.delete(supabase!, id) as Promise<void>), () => setComunicados(prev => prev.filter(c => c.id !== id))),
    [runMutation]
  );

  const addPatrimonioCategoria = useCallback(
    (p: Partial<PatrimonioCategoriaCfg>) =>
      runMutation(() => db.patrimonio_categorias.insert(supabase!, p), row => setPatrimonioCategorias(prev => [...prev, row])),
    [runMutation],
  );
  const updatePatrimonioCategoria = useCallback(
    (id: number, p: Partial<PatrimonioCategoriaCfg>) =>
      runMutation(() => db.patrimonio_categorias.update(supabase!, id, p), row =>
        setPatrimonioCategorias(prev => prev.map(x => (x.id === id ? row : x))),
      ),
    [runMutation],
  );
  const deletePatrimonioCategoria = useCallback(
    (id: number) =>
      runMutation(() => (db.patrimonio_categorias.delete(supabase!, id) as Promise<void>), () => {
        setPatrimonioCategorias(prev => prev.filter(x => x.id !== id));
        setPatrimonioSubcategorias(prev => prev.filter(s => s.categoriaId !== id));
      }),
    [runMutation],
  );
  const addPatrimonioSubcategoria = useCallback(
    (p: Partial<PatrimonioSubcategoriaCfg>) =>
      runMutation(() => db.patrimonio_subcategorias.insert(supabase!, p), row =>
        setPatrimonioSubcategorias(prev => [...prev, row]),
      ),
    [runMutation],
  );
  const updatePatrimonioSubcategoria = useCallback(
    (id: number, p: Partial<PatrimonioSubcategoriaCfg>) =>
      runMutation(() => db.patrimonio_subcategorias.update(supabase!, id, p), row =>
        setPatrimonioSubcategorias(prev => prev.map(x => (x.id === id ? row : x))),
      ),
    [runMutation],
  );
  const deletePatrimonioSubcategoria = useCallback(
    (id: number) =>
      runMutation(() => (db.patrimonio_subcategorias.delete(supabase!, id) as Promise<void>), () => {
        setPatrimonioSubcategorias(prev => prev.filter(x => x.id !== id));
        setPatrimonioActivos(prev => prev.map(a => (a.subcategoriaId === id ? { ...a, subcategoriaId: null } : a)));
      }),
    [runMutation],
  );

  const addPatrimonioActivo = useCallback(
    (p: Partial<PatrimonioActivo>) =>
      runMutation(() => db.patrimonio_activos.insert(supabase!, p), row => setPatrimonioActivos(prev => [...prev, row])),
    [runMutation],
  );
  const updatePatrimonioActivo = useCallback(
    (id: number, p: Partial<PatrimonioActivo>) =>
      runMutation(() => db.patrimonio_activos.update(supabase!, id, p), row =>
        setPatrimonioActivos(prev => prev.map(x => (x.id === id ? row : x))),
      ),
    [runMutation],
  );
  const deletePatrimonioActivo = useCallback(
    (id: number) =>
      runMutation(() => (db.patrimonio_activos.delete(supabase!, id) as Promise<void>), () =>
        setPatrimonioActivos(prev => prev.filter(x => x.id !== id)),
      ),
    [runMutation],
  );
  const addPatrimonioMovimento = useCallback(
    (p: Partial<PatrimonioMovimento>) =>
      runMutation(() => db.patrimonio_movimentos.insert(supabase!, p), row => setPatrimonioMovimentos(prev => [...prev, row])),
    [runMutation],
  );
  const addPatrimonioVerificacao = useCallback(
    (p: Partial<PatrimonioVerificacao>) =>
      runMutation(() => db.patrimonio_verificacoes.insert(supabase!, p), row =>
        setPatrimonioVerificacoes(prev => [...prev, row]),
      ),
    [runMutation],
  );
  const updatePatrimonioVerificacao = useCallback(
    (id: number, p: Partial<PatrimonioVerificacao>) =>
      runMutation(() => db.patrimonio_verificacoes.update(supabase!, id, p), row =>
        setPatrimonioVerificacoes(prev => prev.map(x => (x.id === id ? row : x))),
      ),
    [runMutation],
  );
  const deletePatrimonioVerificacao = useCallback(
    (id: number) =>
      runMutation(() => (db.patrimonio_verificacoes.delete(supabase!, id) as Promise<void>), () => {
        setPatrimonioVerificacoes(prev => prev.filter(x => x.id !== id));
        setPatrimonioVerificacaoItens(prev => prev.filter(i => i.verificacaoId !== id));
      }),
    [runMutation],
  );
  const addPatrimonioVerificacaoItem = useCallback(
    (p: Partial<PatrimonioVerificacaoItem>) =>
      runMutation(() => db.patrimonio_verificacao_itens.insert(supabase!, p), row =>
        setPatrimonioVerificacaoItens(prev => [...prev, row]),
      ),
    [runMutation],
  );
  const updatePatrimonioVerificacaoItem = useCallback(
    (id: number, p: Partial<PatrimonioVerificacaoItem>) =>
      runMutation(() => db.patrimonio_verificacao_itens.update(supabase!, id, p), row =>
        setPatrimonioVerificacaoItens(prev => prev.map(x => (x.id === id ? row : x))),
      ),
    [runMutation],
  );
  const deletePatrimonioVerificacaoItem = useCallback(
    (id: number) =>
      runMutation(() => (db.patrimonio_verificacao_itens.delete(supabase!, id) as Promise<void>), () =>
        setPatrimonioVerificacaoItens(prev => prev.filter(x => x.id !== id)),
      ),
    [runMutation],
  );

  const value = useMemo<DataContextType>(
    () => ({
      dataLoading,
      dataError,
      refetch,
      departamentos,
      setDepartamentos,
      empresas,
      setEmpresas,
      colaboradores: filtered.colaboradores,
      colaboradoresTodos: colaboradores,
      setColaboradores,
      ferias: filtered.ferias,
      setFerias,
      faltas: filtered.faltas,
      setFaltas,
      recibos: filtered.recibos,
      setRecibos,
      declaracoes: filtered.declaracoes,
      setDeclaracoes,
      requisicoes: filtered.requisicoes,
      setRequisicoes,
      centrosCusto: filtered.centrosCusto,
      setCentrosCusto,
      projectos: filtered.projectos,
      setProjectos,
      reunioes,
      setReunioes,
      actas,
      setActas,
      irtEscalaes,
      setIrtEscalaes,
      contratos: filtered.contratos,
      setContratos,
      processos: filtered.processos,
      setProcessos,
      prazos: filtered.prazos,
      setPrazos,
      correspondencias,
      setCorrespondencias,
      documentosOficiais,
      setDocumentosOficiais,
      riscos: filtered.riscos,
      setRiscos,
      pagamentos: filtered.pagamentos,
      setPagamentos,
      pendencias,
      setPendencias,
      movimentosTesouraria: filtered.movimentosTesouraria,
      setMovimentosTesouraria,
      bancos,
      setBancos,
      contasBancarias: filtered.contasBancarias,
      setContasBancarias,
      relatoriosPlaneamento: filtered.relatoriosPlaneamento,
      setRelatoriosPlaneamento,
      noticias: filtered.noticias,
      setNoticias,
      eventos: filtered.eventos,
      setEventos,
      comunicados: filtered.comunicados,
      setComunicados,
      processosDisciplinares: filtered.processosDisciplinares,
      setProcessosDisciplinares,
      rescissoesContrato: filtered.rescissoesContrato,
      setRescissoesContrato,
      geofences: currentEmpresaId === 'consolidado' ? geofences : geofences.filter(g => g.empresaId === currentEmpresaId),
      setGeofences,
      colaboradorGeofenceLinks,
      setColaboradorGeofenceLinks,
      addGeofence,
      updateGeofence,
      deleteGeofence,
      syncColaboradorGeofenceLinksForColaborador,
      addContrato,
      updateContrato,
      deleteContrato,
      addProcesso,
      updateProcesso,
      deleteProcesso,
      addPrazo,
      updatePrazo,
      deletePrazo,
      addRisco,
      updateRisco,
      deleteRisco,
      addRescisaoContrato,
      addProcessoDisciplinar,
      addEmpresa,
      updateEmpresa,
      deleteEmpresa,
      addDepartamento,
      updateDepartamento,
      deleteDepartamento,
      addColaborador,
      updateColaborador,
      deleteColaborador,
      addFerias,
      updateFerias,
      deleteFerias,
      addFalta,
      updateFalta,
      deleteFalta,
      addRecibo,
      updateRecibo,
      deleteRecibo,
      addDeclaracao,
      updateDeclaracao,
      deleteDeclaracao,
      addRequisicao,
      updateRequisicao,
      deleteRequisicao,
      addCentroCusto,
      updateCentroCusto,
      deleteCentroCusto,
      addProjecto,
      updateProjecto,
      deleteProjecto,
      addReuniao,
      updateReuniao,
      deleteReuniao,
      addActa,
      updateActa,
      deleteActa,
      addPagamento,
      addMovimentoTesouraria,
      updateMovimentoTesouraria,
      deleteMovimentoTesouraria,
      addBanco,
      updateBanco,
      deleteBanco,
      addContaBancaria,
      updateContaBancaria,
      deleteContaBancaria,
      addCorrespondencia,
      updateCorrespondencia,
      deleteCorrespondencia,
      addDocumentoOficial,
      updateDocumentoOficial,
      deleteDocumentoOficial,
      addPendencia,
      updatePendencia,
      deletePendencia,
      addRelatorioPlaneamento,
      updateRelatorioPlaneamento,
      deleteRelatorioPlaneamento,
      addNoticia,
      updateNoticia,
      deleteNoticia,
      addEvento,
      updateEvento,
      deleteEvento,
      addComunicado,
      updateComunicado,
      deleteComunicado,
      organizacaoSettings,
      updateOrganizacaoSettings,
      patrimonioActivos: filtered.patrimonioActivos,
      setPatrimonioActivos,
      patrimonioMovimentos: filtered.patrimonioMovimentos,
      setPatrimonioMovimentos,
      patrimonioVerificacoes: filtered.patrimonioVerificacoes,
      setPatrimonioVerificacoes,
      patrimonioVerificacaoItens: filtered.patrimonioVerificacaoItens,
      setPatrimonioVerificacaoItens,
      patrimonioCategorias,
      setPatrimonioCategorias,
      patrimonioSubcategorias,
      setPatrimonioSubcategorias,
      addPatrimonioCategoria,
      updatePatrimonioCategoria,
      deletePatrimonioCategoria,
      addPatrimonioSubcategoria,
      updatePatrimonioSubcategoria,
      deletePatrimonioSubcategoria,
      addPatrimonioActivo,
      updatePatrimonioActivo,
      deletePatrimonioActivo,
      addPatrimonioMovimento,
      addPatrimonioVerificacao,
      updatePatrimonioVerificacao,
      deletePatrimonioVerificacao,
      addPatrimonioVerificacaoItem,
      updatePatrimonioVerificacaoItem,
      deletePatrimonioVerificacaoItem,
    }),
    [
      dataLoading,
      dataError,
      refetch,
      organizacaoSettings,
      updateOrganizacaoSettings,
      departamentos,
      empresas,
      bancos,
      filtered,
      currentEmpresaId,
      geofences,
      colaboradorGeofenceLinks,
      addGeofence,
      updateGeofence,
      deleteGeofence,
      syncColaboradorGeofenceLinksForColaborador,
      colaboradores,
      reunioes,
      actas,
      correspondencias,
      documentosOficiais,
      pendencias,
      addContrato,
      updateContrato,
      deleteContrato,
      addProcesso,
      updateProcesso,
      deleteProcesso,
      addPrazo,
      updatePrazo,
      deletePrazo,
      addRisco,
      updateRisco,
      deleteRisco,
      addRescisaoContrato,
      addProcessoDisciplinar,
      addEmpresa,
      updateEmpresa,
      deleteEmpresa,
      addDepartamento,
      updateDepartamento,
      deleteDepartamento,
      addColaborador,
      updateColaborador,
      deleteColaborador,
      addFerias,
      updateFerias,
      deleteFerias,
      addFalta,
      updateFalta,
      deleteFalta,
      addRecibo,
      updateRecibo,
      deleteRecibo,
      addDeclaracao,
      updateDeclaracao,
      deleteDeclaracao,
      addRequisicao,
      updateRequisicao,
      deleteRequisicao,
      addCentroCusto,
      updateCentroCusto,
      deleteCentroCusto,
      addProjecto,
      updateProjecto,
      deleteProjecto,
      addReuniao,
      updateReuniao,
      deleteReuniao,
      addActa,
      updateActa,
      deleteActa,
      addPagamento,
      addMovimentoTesouraria,
      updateMovimentoTesouraria,
      deleteMovimentoTesouraria,
      addBanco,
      updateBanco,
      deleteBanco,
      addContaBancaria,
      updateContaBancaria,
      deleteContaBancaria,
      addCorrespondencia,
      updateCorrespondencia,
      deleteCorrespondencia,
      addDocumentoOficial,
      updateDocumentoOficial,
      deleteDocumentoOficial,
      addPendencia,
      updatePendencia,
      deletePendencia,
      addRelatorioPlaneamento,
      updateRelatorioPlaneamento,
      deleteRelatorioPlaneamento,
      addNoticia,
      updateNoticia,
      deleteNoticia,
      addEvento,
      updateEvento,
      deleteEvento,
      addComunicado,
      updateComunicado,
      deleteComunicado,
      patrimonioActivos,
      patrimonioMovimentos,
      patrimonioVerificacoes,
      patrimonioVerificacaoItens,
      patrimonioCategorias,
      patrimonioSubcategorias,
      addPatrimonioCategoria,
      updatePatrimonioCategoria,
      deletePatrimonioCategoria,
      addPatrimonioSubcategoria,
      updatePatrimonioSubcategoria,
      deletePatrimonioSubcategoria,
      addPatrimonioActivo,
      updatePatrimonioActivo,
      deletePatrimonioActivo,
      addPatrimonioMovimento,
      addPatrimonioVerificacao,
      updatePatrimonioVerificacao,
      deletePatrimonioVerificacao,
      addPatrimonioVerificacaoItem,
      updatePatrimonioVerificacaoItem,
      deletePatrimonioVerificacaoItem,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
