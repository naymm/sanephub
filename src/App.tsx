import { lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { createAppQueryClient } from "@/lib/query-client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { AppSplashOverlay } from "@/components/AppSplashOverlay";
import { MobileSessionLockProvider } from "@/context/MobileSessionLockContext";
import { TenantProvider } from "@/context/TenantContext";
import { DataProvider } from "@/context/DataContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ChatProvider } from "@/context/ChatContext";
import { Layout } from "@/components/layout/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import MobileMoreMenuPage from "@/pages/MobileMoreMenuPage";
import MobileProfileMenuPage from "@/pages/MobileProfileMenuPage";
import NotFound from "./pages/NotFound";
import GenericModulePage from "@/modules/GenericModulePage";

const FeriasPage = lazy(() => import("@/modules/capital-humano/FeriasPage"));
const FaltasPage = lazy(() => import("@/modules/capital-humano/FaltasPage"));
const RecibosPage = lazy(() => import("@/modules/capital-humano/RecibosPage"));
const DeclaracoesPage = lazy(() => import("@/modules/capital-humano/DeclaracoesPage"));
const ProcessamentoSalarialPage = lazy(() => import("@/modules/capital-humano/ProcessamentoSalarialPage"));
const AssiduidadePage = lazy(() => import("@/modules/capital-humano/AssiduidadePage"));
const TimePunchesPage = lazy(() => import("@/modules/capital-humano/TimePunchesPage"));
const GeofencesPage = lazy(() => import("@/modules/capital-humano/GeofencesPage"));
const ColaboradoresPage = lazy(() => import("@/modules/capital-humano/ColaboradoresPage"));
const RequisicoesPage = lazy(() => import("@/modules/financas/RequisicoesPage"));
const ReembolsosPage = lazy(() => import("@/modules/financas/ReembolsosPage"));
const TesourariaPage = lazy(() => import("@/modules/financas/TesourariaPage"));
const BancosPage = lazy(() => import("@/modules/financas/BancosPage"));
const ContasBancariasPage = lazy(() => import("@/modules/financas/ContasBancariasPage"));
const CentrosCustoPage = lazy(() => import("@/modules/financas/CentrosCustoPage"));
const ProjectosPage = lazy(() => import("@/modules/financas/ProjectosPage"));
const RelatoriosPage = lazy(() => import("@/modules/financas/RelatoriosPage"));
const DespesasPage = lazy(() => import("@/modules/financas/DespesasPage"));
const PagamentosPage = lazy(() => import("@/modules/contabilidade/PagamentosPage"));
const PendenciasPage = lazy(() => import("@/modules/contabilidade/PendenciasPage"));
const ContratosPage = lazy(() => import("@/modules/juridico/ContratosPage"));
const PrazosPage = lazy(() => import("@/modules/juridico/PrazosPage"));
const ProcessosJudiciaisPage = lazy(() => import("@/modules/juridico/ProcessosJudiciaisPage"));
const ProcessosDisciplinaresPage = lazy(() => import("@/modules/juridico/ProcessosDisciplinaresPage"));
const RescisoesContratuaisPage = lazy(() => import("@/modules/juridico/RescisoesContratuaisPage"));
const RiscosJuridicosPage = lazy(() => import("@/modules/juridico/RiscosJuridicosPage"));
const ArquivoJuridicoPage = lazy(() => import("@/modules/juridico/ArquivoJuridicoPage"));
const ReunioesPage = lazy(() => import("@/modules/secretaria/ReunioesPage"));
const ActasPage = lazy(() => import("@/modules/secretaria/ActasPage"));
const DocumentosOficiaisPage = lazy(() => import("@/modules/secretaria/DocumentosOficiaisPage"));
const GestaoDocumentosPage = lazy(() => import("@/modules/secretaria/GestaoDocumentosPage"));
const CorrespondenciasPage = lazy(() => import("@/modules/secretaria/CorrespondenciasPage"));
const ArquivoPage = lazy(() => import("@/modules/secretaria/ArquivoPage"));
const UtilizadoresPage = lazy(() => import("@/modules/config/UtilizadoresPage"));
const AuditoriaPage = lazy(() => import("@/modules/config/AuditoriaPage"));
const DepartamentosPage = lazy(() => import("@/modules/config/DepartamentosPage"));
const ModulosRecursosPage = lazy(() => import("@/modules/config/ModulosRecursosPage"));
const BackupsAdminPage = lazy(() => import("@/modules/config/BackupsAdminPage"));
const PortalRecibosPage = lazy(() => import("@/modules/portal/PortalRecibosPage"));
const PortalDeclaracoesPage = lazy(() => import("@/modules/portal/PortalDeclaracoesPage"));
const PortalFeriasPage = lazy(() => import("@/modules/portal/PortalFeriasPage"));
const PortalFaltasPage = lazy(() => import("@/modules/portal/PortalFaltasPage"));
const PortalRequisicoesPage = lazy(() => import("@/modules/portal/PortalRequisicoesPage"));
const PortalReembolsosPage = lazy(() => import("@/modules/portal/PortalReembolsosPage"));
const PortalAssiduidadePage = lazy(() => import("@/modules/portal/PortalAssiduidadePage"));
const PortalDadosPage = lazy(() => import("@/modules/portal/PortalDadosPage"));
const ChatPage = lazy(() => import("@/modules/chat/ChatPage"));
const TutoriaisPage = lazy(() => import("@/modules/ajuda/TutoriaisPage"));
const ConselhoDashboardPage = lazy(() => import("@/modules/conselho-administracao/ConselhoDashboardPage"));
const DecisoesInstitucionaisPage = lazy(() => import("@/modules/conselho-administracao/DecisoesInstitucionaisPage"));
const AssinaturaActosPage = lazy(() => import("@/modules/conselho-administracao/AssinaturaActosPage"));
const SaudeFinanceiraPage = lazy(() => import("@/modules/conselho-administracao/SaudeFinanceiraPage"));
const ActividadeOrganizacionalPage = lazy(() => import("@/modules/conselho-administracao/ActividadeOrganizacionalPage"));
const EmpresasPage = lazy(() => import("@/modules/conselho-administracao/EmpresasPage"));
const PlaneamentoRelatoriosPage = lazy(() => import("@/modules/planeamento/PlaneamentoRelatoriosPage"));
const PlaneamentoRelatorioFormPage = lazy(() => import("@/modules/planeamento/PlaneamentoRelatorioFormPage"));
const PlaneamentoConsolidacaoPage = lazy(() => import("@/modules/planeamento/PlaneamentoConsolidacaoPage"));
const PlaneamentoDashboardPage = lazy(() => import("@/modules/planeamento/PlaneamentoDashboardPage"));
const NoticiasPage = lazy(() => import("@/modules/comunicacao-interna/NoticiasPage"));
const NoticiaDetalhePage = lazy(() => import("@/modules/comunicacao-interna/NoticiaDetalhePage"));
const EventosPage = lazy(() => import("@/modules/comunicacao-interna/EventosPage"));
const EventoDetalhePage = lazy(() => import("@/modules/comunicacao-interna/EventoDetalhePage"));
const AniversariosPage = lazy(() => import("@/modules/comunicacao-interna/AniversariosPage"));
const ComunicadosPage = lazy(() => import("@/modules/comunicacao-interna/ComunicadosPage"));
const ComunicadoDetalhePage = lazy(() => import("@/modules/comunicacao-interna/ComunicadoDetalhePage"));
const FacturacaoPage = lazy(() => import("@/modules/facturacao/FacturacaoPage"));
const ReceitaPage = lazy(() => import("@/modules/facturacao/ReceitaPage"));
const MinhasActividadesPage = lazy(() => import("@/modules/produtividade/MinhasActividadesPage"));
const ProdutividadeAprovacoesPage = lazy(() => import("@/modules/produtividade/ProdutividadeAprovacoesPage"));
const PatrimonioPage = lazy(() => import("@/modules/patrimonio/PatrimonioPage"));
const ControloInternoLayout = lazy(() =>
  import("@/modules/controlo-interno/ControloInternoLayout").then(m => ({ default: m.ControloInternoLayout })),
);
const ControloInternoDashboardPage = lazy(() => import("@/modules/controlo-interno/ControloInternoDashboardPage"));
const PlanoAuditoriasPage = lazy(() => import("@/modules/controlo-interno/PlanoAuditoriasPage"));
const PlaneamentoAuditoriasRedirect = lazy(() =>
  import("@/modules/controlo-interno/PlanoAuditoriasPage").then(m => ({ default: m.PlaneamentoAuditoriasRedirect })),
);
const InspeccoesPage = lazy(() => import("@/modules/controlo-interno/InspeccoesPage"));
const ExecucaoAuditoriaPage = lazy(() => import("@/modules/controlo-interno/ExecucaoAuditoriaPage"));
const NaoConformidadesPage = lazy(() => import("@/modules/controlo-interno/NaoConformidadesPage"));
const PlanoAccaoPage = lazy(() => import("@/modules/controlo-interno/PlanoAccaoPage"));
const RiscosCorporativosPage = lazy(() => import("@/modules/controlo-interno/RiscosCorporativosPage"));
const LogsRastreabilidadePage = lazy(() => import("@/modules/controlo-interno/LogsRastreabilidadePage"));
const RelatoriosControloInternoPage = lazy(() => import("@/modules/controlo-interno/RelatoriosPage"));

const queryClient = createAppQueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <div className="min-w-0">
    <AuthProvider>
      <AppSplashOverlay />
      <TenantProvider>
              <BrowserRouter>
        <DataProvider>
        <NotificationProvider>
          <ChatProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <MobileSessionLockProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/mais" element={<MobileMoreMenuPage />} />
                  <Route path="/perfil" element={<MobileProfileMenuPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/notificacoes" element={<GenericModulePage title="Centro de Notificações" module="notificacoes" />} />
                  <Route path="/ajuda/tutoriais" element={<TutoriaisPage />} />
                  {/* Conselho de Administração (PCA) */}
                  <Route path="/conselho-administracao/decisoes" element={<DecisoesInstitucionaisPage />} />
                  <Route path="/conselho-administracao/assinatura-actos" element={<AssinaturaActosPage />} />
                  <Route path="/conselho-administracao/saude-financeira" element={<SaudeFinanceiraPage />} />
                  <Route path="/conselho-administracao/actividade" element={<ActividadeOrganizacionalPage />} />
                  <Route path="/conselho-administracao/empresas" element={<EmpresasPage />} />
                  <Route path="/conselho-administracao/empresas/novo" element={<EmpresasPage />} />
                  <Route path="/conselho-administracao" element={<ConselhoDashboardPage />} />
                  {/* Planeamento */}
                  <Route path="/planeamento/relatorios" element={<PlaneamentoRelatoriosPage />} />
                  <Route path="/planeamento/relatorios/novo" element={<PlaneamentoRelatorioFormPage />} />
                  <Route path="/planeamento/relatorios/:id/editar" element={<PlaneamentoRelatorioFormPage />} />
                  <Route path="/planeamento/relatorios/:id" element={<PlaneamentoRelatorioFormPage />} />
                  <Route path="/planeamento/consolidacao" element={<PlaneamentoConsolidacaoPage />} />
                  <Route path="/planeamento/dashboard" element={<PlaneamentoDashboardPage />} />
                  {/* Capital Humano */}
                  <Route path="/capital-humano/colaboradores" element={<ColaboradoresPage />} />
                  <Route path="/capital-humano/colaboradores/novo" element={<ColaboradoresPage />} />
                  <Route path="/capital-humano/ferias" element={<FeriasPage />} />
                  <Route path="/capital-humano/ferias/novo" element={<FeriasPage />} />
                  <Route path="/capital-humano/faltas" element={<FaltasPage />} />
                  <Route path="/capital-humano/faltas/novo" element={<FaltasPage />} />
                  <Route path="/capital-humano/recibos" element={<RecibosPage />} />
                  <Route path="/capital-humano/recibos/novo" element={<RecibosPage />} />
                  <Route path="/capital-humano/declaracoes" element={<DeclaracoesPage />} />
                  <Route path="/capital-humano/declaracoes/novo" element={<DeclaracoesPage />} />
                  <Route path="/capital-humano/processamento-salarial" element={<ProcessamentoSalarialPage />} />
                  <Route path="/capital-humano/assiduidade" element={<AssiduidadePage />} />
                  <Route path="/capital-humano/marcacoes-ponto" element={<TimePunchesPage />} />
                  <Route path="/capital-humano/zonas-trabalho" element={<GeofencesPage />} />
                  <Route path="/capital-humano/zonas-trabalho/novo" element={<GeofencesPage />} />
                  {/* Finanças */}
                  <Route path="/financas/requisicoes" element={<RequisicoesPage />} />
                  <Route path="/financas/requisicoes/novo" element={<RequisicoesPage />} />
                  <Route path="/financas/reembolsos" element={<ReembolsosPage />} />
                  <Route path="/financas/despesas" element={<DespesasPage />} />
                  <Route path="/financas/bancos" element={<BancosPage />} />
                  <Route path="/financas/bancos/novo" element={<BancosPage />} />
                  <Route path="/financas/contas-bancarias" element={<ContasBancariasPage />} />
                  <Route path="/financas/contas-bancarias/novo" element={<ContasBancariasPage />} />
                  <Route path="/financas/tesouraria" element={<TesourariaPage />} />
                  <Route path="/financas/tesouraria/novo" element={<TesourariaPage />} />
                  <Route path="/financas/centros-custo" element={<CentrosCustoPage />} />
                  <Route path="/financas/centros-custo/novo" element={<CentrosCustoPage />} />
                  <Route path="/financas/projectos" element={<ProjectosPage />} />
                  <Route path="/financas/projectos/novo" element={<ProjectosPage />} />
                  <Route path="/financas/relatorios" element={<RelatoriosPage />} />

                  <Route path="/facturacao" element={<FacturacaoPage />} />
                  <Route path="/facturacao/receita" element={<ReceitaPage />} />
                  {/* Produtividade */}
                  <Route path="/produtividade/actividades" element={<MinhasActividadesPage />} />
                  <Route path="/produtividade/direccao" element={<MinhasActividadesPage scope="area" />} />
                  <Route path="/produtividade/aprovacoes" element={<ProdutividadeAprovacoesPage />} />
                  {/* Controlo Interno */}
                  <Route path="/controlo-interno" element={<ControloInternoLayout />}>
                    <Route index element={<ControloInternoDashboardPage />} />
                    <Route path="plano-auditorias" element={<PlanoAuditoriasPage />} />
                    <Route path="planeamento" element={<PlaneamentoAuditoriasRedirect />} />
                    <Route path="inspeccoes" element={<InspeccoesPage />} />
                    <Route path="execucao" element={<ExecucaoAuditoriaPage />} />
                    <Route path="nao-conformidades" element={<NaoConformidadesPage />} />
                    <Route path="plano-accao" element={<PlanoAccaoPage />} />
                    <Route path="riscos" element={<RiscosCorporativosPage />} />
                    <Route path="logs" element={<LogsRastreabilidadePage />} />
                    <Route path="relatorios" element={<RelatoriosControloInternoPage />} />
                  </Route>
                  {/* Contabilidade */}
                  <Route path="/contabilidade/pagamentos" element={<PagamentosPage />} />
                  <Route path="/contabilidade/pendencias" element={<PendenciasPage />} />
                  <Route path="/contabilidade/pendencias/novo" element={<PendenciasPage />} />
                  {/* Secretaria Geral */}
                  <Route path="/secretaria/reunioes" element={<ReunioesPage />} />
                  <Route path="/secretaria/reunioes/novo" element={<ReunioesPage />} />
                  <Route path="/secretaria/actas" element={<ActasPage />} />
                  <Route path="/secretaria/actas/novo" element={<ActasPage />} />
                  <Route path="/secretaria/documentos" element={<DocumentosOficiaisPage />} />
                  <Route path="/secretaria/documentos/novo" element={<DocumentosOficiaisPage />} />
                  <Route path="/gestao-documentos" element={<GestaoDocumentosPage />} />
                  <Route
                    path="/gestao-documentos/normativos"
                    element={<GestaoDocumentosPage scopedRootFolderName="Normativos" pageHeading="Normativos" />}
                  />
                  <Route
                    path="/gestao-documentos/minutas"
                    element={<GestaoDocumentosPage scopedRootFolderName="Minutas" pageHeading="Minutas" />}
                  />
                  <Route path="/secretaria/gestao-documentos" element={<Navigate to="/gestao-documentos" replace />} />
                  <Route path="/patrimonio" element={<PatrimonioPage />} />
                  <Route path="/secretaria/correspondencias" element={<CorrespondenciasPage />} />
                  <Route path="/secretaria/correspondencias/novo" element={<CorrespondenciasPage />} />
                  <Route path="/secretaria/arquivo" element={<ArquivoPage />} />
                  {/* Jurídico */}
                  <Route path="/juridico/contratos" element={<ContratosPage />} />
                  <Route path="/juridico/contratos/novo" element={<ContratosPage />} />
                  <Route path="/juridico/processos" element={<ProcessosJudiciaisPage />} />
                  <Route path="/juridico/processos/novo" element={<ProcessosJudiciaisPage />} />
                  <Route path="/juridico/processos-disciplinares" element={<ProcessosDisciplinaresPage />} />
                  <Route path="/juridico/processos-disciplinares/novo" element={<ProcessosDisciplinaresPage />} />
                  <Route path="/juridico/processos-disciplinares/:id" element={<ProcessosDisciplinaresPage />} />
                  <Route path="/juridico/prazos" element={<PrazosPage />} />
                  <Route path="/juridico/prazos/novo" element={<PrazosPage />} />
                  <Route path="/juridico/riscos" element={<RiscosJuridicosPage />} />
                  <Route path="/juridico/riscos/novo" element={<RiscosJuridicosPage />} />
                  <Route path="/juridico/rescisoes" element={<RescisoesContratuaisPage />} />
                  <Route path="/juridico/rescisoes/novo" element={<RescisoesContratuaisPage />} />
                  <Route path="/juridico/arquivo" element={<ArquivoJuridicoPage />} />
                  {/* Portal Colaborador */}
                  <Route path="/portal/dados" element={<PortalDadosPage />} />
                  <Route path="/portal/ferias" element={<PortalFeriasPage />} />
                  <Route path="/portal/ferias/novo" element={<PortalFeriasPage />} />
                  <Route path="/portal/faltas" element={<PortalFaltasPage />} />
                  <Route path="/portal/assiduidade" element={<PortalAssiduidadePage />} />
                  <Route path="/portal/recibos" element={<PortalRecibosPage />} />
                  <Route path="/portal/declaracoes" element={<PortalDeclaracoesPage />} />
                  <Route path="/portal/requisicoes" element={<PortalRequisicoesPage />} />
                  <Route path="/portal/requisicoes/novo" element={<PortalRequisicoesPage />} />
                  <Route path="/portal/reembolsos" element={<PortalReembolsosPage />} />
                  <Route path="/portal/reembolsos/novo" element={<PortalReembolsosPage />} />
                  {/* Comunicação Interna */}
                  <Route path="/comunicacao-interna/noticias" element={<NoticiasPage />} />
                  <Route path="/comunicacao-interna/noticias/novo" element={<NoticiasPage />} />
                  <Route path="/comunicacao-interna/noticias/:id" element={<NoticiaDetalhePage />} />
                  <Route path="/comunicacao-interna/eventos" element={<EventosPage />} />
                  <Route path="/comunicacao-interna/eventos/novo" element={<EventosPage />} />
                  <Route path="/comunicacao-interna/eventos/:id" element={<EventoDetalhePage />} />
                  <Route path="/comunicacao-interna/comunicados" element={<ComunicadosPage />} />
                  <Route path="/comunicacao-interna/comunicados/novo" element={<ComunicadosPage />} />
                  <Route path="/comunicacao-interna/comunicados/:id" element={<ComunicadoDetalhePage />} />
                  <Route path="/comunicacao-interna/aniversarios" element={<AniversariosPage />} />
                  {/* Config */}
                  <Route path="/configuracoes" element={<GenericModulePage title="Configurações" module="config" />} />
                  <Route path="/configuracoes/auditoria" element={<AuditoriaPage />} />
                  <Route path="/configuracoes/utilizadores" element={<UtilizadoresPage />} />
                  <Route path="/configuracoes/utilizadores/novo" element={<UtilizadoresPage />} />
                  <Route path="/configuracoes/departamentos" element={<DepartamentosPage />} />
                  <Route path="/configuracoes/departamentos/novo" element={<DepartamentosPage />} />
                  <Route path="/configuracoes/modulos-recursos" element={<ModulosRecursosPage />} />
                  <Route path="/configuracoes/backups" element={<BackupsAdminPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </MobileSessionLockProvider>
            </TooltipProvider>
          </ChatProvider>
        </NotificationProvider>
        </DataProvider>
              </BrowserRouter>
      </TenantProvider>
    </AuthProvider>
    </div>
  </QueryClientProvider>
);

export default App;
