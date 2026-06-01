import { useCallback } from 'react';
import type {
  Acta,
  Banco,
  ContaBancaria,
  CentroCusto,
  Colaborador,
  ColaboradorGeofenceLink,
  Comunicado,
  Contrato,
  Correspondencia,
  Declaracao,
  Departamento,
  DocumentoOficial,
  Empresa,
  Evento,
  Falta,
  Ferias,
  Geofence,
  MovimentoTesouraria,
  Noticia,
  Pagamento,
  PendenciaDocumental,
  PrazoLegal,
  ProcessoDisciplinar,
  ProcessoJudicial,
  Projecto,
  ReciboSalario,
  RelatorioMensalPlaneamento,
  Requisicao,
  RescisaoContrato,
  Reuniao,
  RiscoJuridico,
} from '@/types';
import { RealtimeTableBridge } from '@/components/data/RealtimeTableBridge';
import type { RealtimeSyncTable } from '@/lib/dataTableSyncPolicy';
import { REALTIME_SYNC_TABLES } from '@/lib/dataTableSyncPolicy';

type SyncFlags = Record<RealtimeSyncTable, boolean>;

type Props = {
  sync: SyncFlags;
  onLoadingChange: (table: RealtimeSyncTable, loading: boolean) => void;
  setEmpresas: (rows: Empresa[]) => void;
  setDepartamentos: (rows: Departamento[]) => void;
  setColaboradores: (rows: Colaborador[]) => void;
  setFerias: (rows: Ferias[]) => void;
  setFaltas: (rows: Falta[]) => void;
  setRecibos: (rows: ReciboSalario[]) => void;
  setDeclaracoes: (rows: Declaracao[]) => void;
  setNoticias: (rows: Noticia[]) => void;
  setEventos: (rows: Evento[]) => void;
  setComunicados: (rows: Comunicado[]) => void;
  setRequisicoes: (rows: Requisicao[]) => void;
  setCentrosCusto: (rows: CentroCusto[]) => void;
  setProjectos: (rows: Projecto[]) => void;
  setReunioes: (rows: Reuniao[]) => void;
  setActas: (rows: Acta[]) => void;
  setContratos: (rows: Contrato[]) => void;
  setProcessos: (rows: ProcessoJudicial[]) => void;
  setPrazos: (rows: PrazoLegal[]) => void;
  setCorrespondencias: (rows: Correspondencia[]) => void;
  setDocumentosOficiais: (rows: DocumentoOficial[]) => void;
  setRiscos: (rows: RiscoJuridico[]) => void;
  setPagamentos: (rows: Pagamento[]) => void;
  setPendencias: (rows: PendenciaDocumental[]) => void;
  setMovimentosTesouraria: (rows: MovimentoTesouraria[]) => void;
  setBancos: (rows: Banco[]) => void;
  setContasBancarias: (rows: ContaBancaria[]) => void;
  setRelatoriosPlaneamento: (rows: RelatorioMensalPlaneamento[]) => void;
  setProcessosDisciplinares: (rows: ProcessoDisciplinar[]) => void;
  setRescissoesContrato: (rows: RescisaoContrato[]) => void;
  setGeofences: (rows: Geofence[]) => void;
  setColaboradorGeofenceLinks: (rows: ColaboradorGeofenceLink[]) => void;
};

function useLoadingBinder(
  table: RealtimeSyncTable,
  onLoadingChange: Props['onLoadingChange'],
) {
  return useCallback((loading: boolean) => onLoadingChange(table, loading), [table, onLoadingChange]);
}

/** Subscrições realtime montadas só para tabelas activas na rota actual. */
export function DataRealtimeSyncLayer(props: Props) {
  const { sync, onLoadingChange } = props;

  const mk = (table: RealtimeSyncTable) => useLoadingBinder(table, onLoadingChange);

  const loadingEmpresas = mk('empresas');
  const loadingDepartamentos = mk('departamentos');
  const loadingColaboradores = mk('colaboradores');
  const loadingFerias = mk('ferias');
  const loadingFaltas = mk('faltas');
  const loadingRecibos = mk('recibos_salario');
  const loadingDeclaracoes = mk('declaracoes');
  const loadingNoticias = mk('noticias');
  const loadingEventos = mk('eventos');
  const loadingComunicados = mk('comunicados');
  const loadingRequisicoes = mk('requisicoes');
  const loadingCentrosCusto = mk('centros_custo');
  const loadingProjectos = mk('projectos');
  const loadingReunioes = mk('reunioes');
  const loadingActas = mk('actas');
  const loadingContratos = mk('contratos');
  const loadingProcessos = mk('processos_judiciais');
  const loadingPrazos = mk('prazos_legais');
  const loadingCorrespondencias = mk('correspondencias');
  const loadingDocumentos = mk('documentos_oficiais');
  const loadingRiscos = mk('riscos_juridicos');
  const loadingPagamentos = mk('pagamentos');
  const loadingPendencias = mk('pendencias_documentais');
  const loadingMovimentos = mk('movimentos_tesouraria');
  const loadingBancos = mk('bancos');
  const loadingContas = mk('contas_bancarias');
  const loadingRelatorios = mk('relatorios_planeamento');
  const loadingDisciplinares = mk('processos_disciplinares');
  const loadingRescisoes = mk('rescisoes_contrato');
  const loadingGeofences = mk('geofences');
  const loadingColabGeofences = mk('colaborador_geofences');

  return (
    <>
      {sync.empresas ? (
        <RealtimeTableBridge<Empresa>
          enabled
          table="empresas"
          primaryKeyColumn="id"
          onRows={props.setEmpresas}
          onLoading={loadingEmpresas}
        />
      ) : null}
      {sync.departamentos ? (
        <RealtimeTableBridge<Departamento>
          enabled
          table="departamentos"
          primaryKeyColumn="id"
          onRows={props.setDepartamentos}
          onLoading={loadingDepartamentos}
        />
      ) : null}
      {sync.colaboradores ? (
        <RealtimeTableBridge<Colaborador>
          enabled
          table="colaboradores"
          primaryKeyColumn="id"
          onRows={props.setColaboradores}
          onLoading={loadingColaboradores}
        />
      ) : null}
      {sync.ferias ? (
        <RealtimeTableBridge<Ferias>
          enabled
          table="ferias"
          primaryKeyColumn="id"
          onRows={props.setFerias}
          onLoading={loadingFerias}
        />
      ) : null}
      {sync.faltas ? (
        <RealtimeTableBridge<Falta>
          enabled
          table="faltas"
          primaryKeyColumn="id"
          onRows={props.setFaltas}
          onLoading={loadingFaltas}
        />
      ) : null}
      {sync.recibos_salario ? (
        <RealtimeTableBridge<ReciboSalario>
          enabled
          table="recibos_salario"
          primaryKeyColumn="id"
          onRows={props.setRecibos}
          onLoading={loadingRecibos}
        />
      ) : null}
      {sync.declaracoes ? (
        <RealtimeTableBridge<Declaracao>
          enabled
          table="declaracoes"
          primaryKeyColumn="id"
          onRows={props.setDeclaracoes}
          onLoading={loadingDeclaracoes}
        />
      ) : null}
      {sync.noticias ? (
        <RealtimeTableBridge<Noticia>
          enabled
          table="noticias"
          primaryKeyColumn="id"
          onRows={props.setNoticias}
          onLoading={loadingNoticias}
        />
      ) : null}
      {sync.eventos ? (
        <RealtimeTableBridge<Evento>
          enabled
          table="eventos"
          primaryKeyColumn="id"
          onRows={props.setEventos}
          onLoading={loadingEventos}
        />
      ) : null}
      {sync.comunicados ? (
        <RealtimeTableBridge<Comunicado>
          enabled
          table="comunicados"
          primaryKeyColumn="id"
          onRows={props.setComunicados}
          onLoading={loadingComunicados}
        />
      ) : null}
      {sync.requisicoes ? (
        <RealtimeTableBridge<Requisicao>
          enabled
          table="requisicoes"
          primaryKeyColumn="id"
          onRows={props.setRequisicoes}
          onLoading={loadingRequisicoes}
        />
      ) : null}
      {sync.centros_custo ? (
        <RealtimeTableBridge<CentroCusto>
          enabled
          table="centros_custo"
          primaryKeyColumn="id"
          onRows={props.setCentrosCusto}
          onLoading={loadingCentrosCusto}
        />
      ) : null}
      {sync.projectos ? (
        <RealtimeTableBridge<Projecto>
          enabled
          table="projectos"
          primaryKeyColumn="id"
          onRows={props.setProjectos}
          onLoading={loadingProjectos}
        />
      ) : null}
      {sync.reunioes ? (
        <RealtimeTableBridge<Reuniao>
          enabled
          table="reunioes"
          primaryKeyColumn="id"
          onRows={props.setReunioes}
          onLoading={loadingReunioes}
        />
      ) : null}
      {sync.actas ? (
        <RealtimeTableBridge<Acta>
          enabled
          table="actas"
          primaryKeyColumn="id"
          onRows={props.setActas}
          onLoading={loadingActas}
        />
      ) : null}
      {sync.contratos ? (
        <RealtimeTableBridge<Contrato>
          enabled
          table="contratos"
          primaryKeyColumn="id"
          onRows={props.setContratos}
          onLoading={loadingContratos}
        />
      ) : null}
      {sync.processos_judiciais ? (
        <RealtimeTableBridge<ProcessoJudicial>
          enabled
          table="processos_judiciais"
          primaryKeyColumn="id"
          onRows={props.setProcessos}
          onLoading={loadingProcessos}
        />
      ) : null}
      {sync.prazos_legais ? (
        <RealtimeTableBridge<PrazoLegal>
          enabled
          table="prazos_legais"
          primaryKeyColumn="id"
          onRows={props.setPrazos}
          onLoading={loadingPrazos}
        />
      ) : null}
      {sync.correspondencias ? (
        <RealtimeTableBridge<Correspondencia>
          enabled
          table="correspondencias"
          primaryKeyColumn="id"
          onRows={props.setCorrespondencias}
          onLoading={loadingCorrespondencias}
        />
      ) : null}
      {sync.documentos_oficiais ? (
        <RealtimeTableBridge<DocumentoOficial>
          enabled
          table="documentos_oficiais"
          primaryKeyColumn="id"
          onRows={props.setDocumentosOficiais}
          onLoading={loadingDocumentos}
        />
      ) : null}
      {sync.riscos_juridicos ? (
        <RealtimeTableBridge<RiscoJuridico>
          enabled
          table="riscos_juridicos"
          primaryKeyColumn="id"
          onRows={props.setRiscos}
          onLoading={loadingRiscos}
        />
      ) : null}
      {sync.pagamentos ? (
        <RealtimeTableBridge<Pagamento>
          enabled
          table="pagamentos"
          primaryKeyColumn="id"
          onRows={props.setPagamentos}
          onLoading={loadingPagamentos}
        />
      ) : null}
      {sync.pendencias_documentais ? (
        <RealtimeTableBridge<PendenciaDocumental>
          enabled
          table="pendencias_documentais"
          primaryKeyColumn="id"
          onRows={props.setPendencias}
          onLoading={loadingPendencias}
        />
      ) : null}
      {sync.movimentos_tesouraria ? (
        <RealtimeTableBridge<MovimentoTesouraria>
          enabled
          table="movimentos_tesouraria"
          primaryKeyColumn="id"
          onRows={props.setMovimentosTesouraria}
          onLoading={loadingMovimentos}
        />
      ) : null}
      {sync.bancos ? (
        <RealtimeTableBridge<Banco>
          enabled
          table="bancos"
          primaryKeyColumn="id"
          onRows={props.setBancos}
          onLoading={loadingBancos}
        />
      ) : null}
      {sync.contas_bancarias ? (
        <RealtimeTableBridge<ContaBancaria>
          enabled
          table="contas_bancarias"
          primaryKeyColumn="id"
          onRows={props.setContasBancarias}
          onLoading={loadingContas}
        />
      ) : null}
      {sync.relatorios_planeamento ? (
        <RealtimeTableBridge<RelatorioMensalPlaneamento>
          enabled
          table="relatorios_planeamento"
          primaryKeyColumn="id"
          onRows={props.setRelatoriosPlaneamento}
          onLoading={loadingRelatorios}
        />
      ) : null}
      {sync.processos_disciplinares ? (
        <RealtimeTableBridge<ProcessoDisciplinar>
          enabled
          table="processos_disciplinares"
          primaryKeyColumn="id"
          onRows={props.setProcessosDisciplinares}
          onLoading={loadingDisciplinares}
        />
      ) : null}
      {sync.rescisoes_contrato ? (
        <RealtimeTableBridge<RescisaoContrato>
          enabled
          table="rescisoes_contrato"
          primaryKeyColumn="id"
          onRows={props.setRescissoesContrato}
          onLoading={loadingRescisoes}
        />
      ) : null}
      {sync.geofences ? (
        <RealtimeTableBridge<Geofence>
          enabled
          table="geofences"
          primaryKeyColumn="id"
          onRows={props.setGeofences}
          onLoading={loadingGeofences}
        />
      ) : null}
      {sync.colaborador_geofences ? (
        <RealtimeTableBridge<ColaboradorGeofenceLink>
          enabled
          table="colaborador_geofences"
          primaryKeyColumn="id"
          onRows={props.setColaboradorGeofenceLinks}
          onLoading={loadingColabGeofences}
        />
      ) : null}
    </>
  );
}

export function createInitialRealtimeLoading(): Record<RealtimeSyncTable, boolean> {
  return Object.fromEntries(REALTIME_SYNC_TABLES.map(t => [t, false])) as Record<RealtimeSyncTable, boolean>;
}
