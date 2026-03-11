import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import type { Colaborador, Empresa, Ferias, Falta, ReciboSalario, Declaracao, Requisicao, CentroCusto, Projecto, Reuniao, Acta, Contrato, ProcessoJudicial, PrazoLegal, Correspondencia, DocumentoOficial, RiscoJuridico, Pagamento, PendenciaDocumental, Departamento, MovimentoTesouraria, RelatorioMensalPlaneamento, ProcessoDisciplinar, RescisaoContrato } from '@/types';
import { EMPRESAS_SEED, COLABORADORES_SEED, FERIAS_SEED, FALTAS_SEED, RECIBOS_SEED, DECLARACOES_SEED, REQUISICOES_SEED, CENTROS_CUSTO_SEED, PROJECTOS_SEED, REUNIOES_SEED, ACTAS_SEED, CONTRATOS_SEED, PROCESSOS_SEED, PRAZOS_SEED, CORRESPONDENCIAS_SEED, DOCUMENTOS_OFICIAIS_SEED, RISCOS_SEED, PAGAMENTOS_SEED, PENDENCIAS_SEED, DEPARTAMENTOS_SEED, MOVIMENTOS_TESOURARIA_SEED, RELATORIOS_PLANEAMENTO_SEED, PROCESSOS_DISCIPLINARES_SEED, RESCISOES_CONTRATO_SEED } from '@/data/seed';
import { useTenant } from '@/context/TenantContext';

interface DataContextType {
  departamentos: Departamento[];
  setDepartamentos: React.Dispatch<React.SetStateAction<Departamento[]>>;
  empresas: Empresa[];
  setEmpresas: React.Dispatch<React.SetStateAction<Empresa[]>>;
  colaboradores: Colaborador[];
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
  relatoriosPlaneamento: RelatorioMensalPlaneamento[];
  setRelatoriosPlaneamento: React.Dispatch<React.SetStateAction<RelatorioMensalPlaneamento[]>>;
  processosDisciplinares: ProcessoDisciplinar[];
  setProcessosDisciplinares: React.Dispatch<React.SetStateAction<ProcessoDisciplinar[]>>;
  rescissoesContrato: RescisaoContrato[];
  setRescissoesContrato: React.Dispatch<React.SetStateAction<RescisaoContrato[]>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);
const STORAGE_EMPRESAS = 'sanep_empresas';

function loadEmpresas(): Empresa[] {
  try {
    const saved = localStorage.getItem(STORAGE_EMPRESAS);
    if (saved) {
      const parsed = JSON.parse(saved) as Empresa[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return EMPRESAS_SEED;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { currentEmpresaId } = useTenant();
  const [empresas, setEmpresas] = useState<Empresa[]>(loadEmpresas);
  const [departamentos, setDepartamentos] = useState<Departamento[]>(DEPARTAMENTOS_SEED);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>(COLABORADORES_SEED);
  const [ferias, setFerias] = useState<Ferias[]>(FERIAS_SEED);
  const [faltas, setFaltas] = useState<Falta[]>(FALTAS_SEED);
  const [recibos, setRecibos] = useState<ReciboSalario[]>(RECIBOS_SEED);
  const [declaracoes, setDeclaracoes] = useState<Declaracao[]>(DECLARACOES_SEED);
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>(REQUISICOES_SEED);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>(CENTROS_CUSTO_SEED);
  const [projectos, setProjectos] = useState<Projecto[]>(PROJECTOS_SEED);
  const [reunioes, setReunioes] = useState<Reuniao[]>(REUNIOES_SEED);
  const [actas, setActas] = useState<Acta[]>(ACTAS_SEED);
  const [contratos, setContratos] = useState<Contrato[]>(CONTRATOS_SEED);
  const [processos, setProcessos] = useState<ProcessoJudicial[]>(PROCESSOS_SEED);
  const [prazos, setPrazos] = useState<PrazoLegal[]>(PRAZOS_SEED);
  const [correspondencias, setCorrespondencias] = useState<Correspondencia[]>(CORRESPONDENCIAS_SEED);
  const [documentosOficiais, setDocumentosOficiais] = useState<DocumentoOficial[]>(DOCUMENTOS_OFICIAIS_SEED);
  const [riscos, setRiscos] = useState<RiscoJuridico[]>(RISCOS_SEED);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(PAGAMENTOS_SEED);
  const [pendencias, setPendencias] = useState<PendenciaDocumental[]>(PENDENCIAS_SEED);
  const [movimentosTesouraria, setMovimentosTesouraria] = useState<MovimentoTesouraria[]>(MOVIMENTOS_TESOURARIA_SEED);
  const [relatoriosPlaneamento, setRelatoriosPlaneamento] = useState<RelatorioMensalPlaneamento[]>(RELATORIOS_PLANEAMENTO_SEED);
  const [processosDisciplinares, setProcessosDisciplinares] = useState<ProcessoDisciplinar[]>(PROCESSOS_DISCIPLINARES_SEED);
  const [rescissoesContrato, setRescissoesContrato] = useState<RescisaoContrato[]>(RESCISOES_CONTRATO_SEED);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_EMPRESAS, JSON.stringify(empresas));
  }, [empresas]);

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
      relatoriosPlaneamento: isConsolidado ? relatoriosPlaneamento : relatoriosPlaneamento.filter(r => r.empresaId === currentEmpresaId),
      processosDisciplinares: isConsolidado ? processosDisciplinares : processosDisciplinares.filter(p => p.empresaId === currentEmpresaId),
      rescissoesContrato: isConsolidado ? rescissoesContrato : rescissoesContrato.filter(r => r.empresaId === currentEmpresaId),
      contratos: isConsolidado ? contratos : contratos.filter(c => c.empresaId == null || c.empresaId === currentEmpresaId),
      processos: isConsolidado ? processos : processos.filter(p => p.empresaId == null || p.empresaId === currentEmpresaId),
      prazos: isConsolidado ? prazos : prazos.filter(pr => pr.empresaId == null || pr.empresaId === currentEmpresaId),
      riscos: isConsolidado ? riscos : riscos.filter(r => r.empresaId == null || r.empresaId === currentEmpresaId),
    };
  }, [currentEmpresaId, colaboradores, requisicoes, centrosCusto, projectos, ferias, faltas, recibos, declaracoes, pagamentos, movimentosTesouraria, relatoriosPlaneamento, processosDisciplinares, rescissoesContrato, contratos, processos, prazos, riscos]);

  return (
    <DataContext.Provider value={{
      departamentos, setDepartamentos,
      empresas, setEmpresas,
      colaboradores: filtered.colaboradores,
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
      reunioes, setReunioes,
      actas, setActas,
      contratos: filtered.contratos,
      setContratos,
      processos: filtered.processos,
      setProcessos,
      prazos: filtered.prazos,
      setPrazos,
      correspondencias, setCorrespondencias,
      documentosOficiais, setDocumentosOficiais,
      riscos: filtered.riscos,
      setRiscos,
      pagamentos: filtered.pagamentos,
      setPagamentos,
      pendencias, setPendencias,
      movimentosTesouraria: filtered.movimentosTesouraria,
      setMovimentosTesouraria,
      relatoriosPlaneamento: filtered.relatoriosPlaneamento,
      setRelatoriosPlaneamento,
      processosDisciplinares: filtered.processosDisciplinares,
      setProcessosDisciplinares,
      rescissoesContrato: filtered.rescissoesContrato,
      setRescissoesContrato,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
