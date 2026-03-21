import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { TenantProvider } from "@/context/TenantContext";
import { DataProvider } from "@/context/DataContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ChatProvider } from "@/context/ChatContext";
import { Layout } from "@/components/layout/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import NotFound from "./pages/NotFound";
import ColaboradoresPage from "@/modules/capital-humano/ColaboradoresPage";
import FeriasPage from "@/modules/capital-humano/FeriasPage";
import FaltasPage from "@/modules/capital-humano/FaltasPage";
import RecibosPage from "@/modules/capital-humano/RecibosPage";
import DeclaracoesPage from "@/modules/capital-humano/DeclaracoesPage";
import RequisicoesPage from "@/modules/financas/RequisicoesPage";
import TesourariaPage from "@/modules/financas/TesourariaPage";
import BancosPage from "@/modules/financas/BancosPage";
import ContasBancariasPage from "@/modules/financas/ContasBancariasPage";
import CentrosCustoPage from "@/modules/financas/CentrosCustoPage";
import ProjectosPage from "@/modules/financas/ProjectosPage";
import RelatoriosPage from "@/modules/financas/RelatoriosPage";
import PagamentosPage from "@/modules/contabilidade/PagamentosPage";
import PendenciasPage from "@/modules/contabilidade/PendenciasPage";
import ContratosPage from "@/modules/juridico/ContratosPage";
import PrazosPage from "@/modules/juridico/PrazosPage";
import ProcessosJudiciaisPage from "@/modules/juridico/ProcessosJudiciaisPage";
import ProcessosDisciplinaresPage from "@/modules/juridico/ProcessosDisciplinaresPage";
import RescisoesContratuaisPage from "@/modules/juridico/RescisoesContratuaisPage";
import RiscosJuridicosPage from "@/modules/juridico/RiscosJuridicosPage";
import ArquivoJuridicoPage from "@/modules/juridico/ArquivoJuridicoPage";
import ReunioesPage from "@/modules/secretaria/ReunioesPage";
import ActasPage from "@/modules/secretaria/ActasPage";
import DocumentosOficiaisPage from "@/modules/secretaria/DocumentosOficiaisPage";
import GestaoDocumentosPage from "@/modules/secretaria/GestaoDocumentosPage";
import CorrespondenciasPage from "@/modules/secretaria/CorrespondenciasPage";
import ArquivoPage from "@/modules/secretaria/ArquivoPage";
import UtilizadoresPage from "@/modules/config/UtilizadoresPage";
import DepartamentosPage from "@/modules/config/DepartamentosPage";
import GenericModulePage from "@/modules/GenericModulePage";
import PortalRecibosPage from "@/modules/portal/PortalRecibosPage";
import PortalDeclaracoesPage from "@/modules/portal/PortalDeclaracoesPage";
import PortalFeriasPage from "@/modules/portal/PortalFeriasPage";
import PortalRequisicoesPage from "@/modules/portal/PortalRequisicoesPage";
import PortalDadosPage from "@/modules/portal/PortalDadosPage";
import ChatPage from "@/modules/chat/ChatPage";
import ConselhoDashboardPage from "@/modules/conselho-administracao/ConselhoDashboardPage";
import DecisoesInstitucionaisPage from "@/modules/conselho-administracao/DecisoesInstitucionaisPage";
import AssinaturaActosPage from "@/modules/conselho-administracao/AssinaturaActosPage";
import SaudeFinanceiraPage from "@/modules/conselho-administracao/SaudeFinanceiraPage";
import ActividadeOrganizacionalPage from "@/modules/conselho-administracao/ActividadeOrganizacionalPage";
import EmpresasPage from "@/modules/conselho-administracao/EmpresasPage";
import PlaneamentoRelatoriosPage from "@/modules/planeamento/PlaneamentoRelatoriosPage";
import PlaneamentoRelatorioFormPage from "@/modules/planeamento/PlaneamentoRelatorioFormPage";
import PlaneamentoConsolidacaoPage from "@/modules/planeamento/PlaneamentoConsolidacaoPage";
import PlaneamentoDashboardPage from "@/modules/planeamento/PlaneamentoDashboardPage";
import NoticiasPage from "@/modules/comunicacao-interna/NoticiasPage";
import NoticiaDetalhePage from "@/modules/comunicacao-interna/NoticiaDetalhePage";
import EventosPage from "@/modules/comunicacao-interna/EventosPage";
import EventoDetalhePage from "@/modules/comunicacao-interna/EventoDetalhePage";
import AniversariosPage from "@/modules/comunicacao-interna/AniversariosPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <DataProvider>
        <NotificationProvider>
          <ChatProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/notificacoes" element={<GenericModulePage title="Centro de Notificações" module="notificacoes" />} />
                  {/* Conselho de Administração (PCA) */}
                  <Route path="/conselho-administracao/decisoes" element={<DecisoesInstitucionaisPage />} />
                  <Route path="/conselho-administracao/assinatura-actos" element={<AssinaturaActosPage />} />
                  <Route path="/conselho-administracao/saude-financeira" element={<SaudeFinanceiraPage />} />
                  <Route path="/conselho-administracao/actividade" element={<ActividadeOrganizacionalPage />} />
                  <Route path="/conselho-administracao/empresas" element={<EmpresasPage />} />
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
                  <Route path="/capital-humano/ferias" element={<FeriasPage />} />
                  <Route path="/capital-humano/faltas" element={<FaltasPage />} />
                  <Route path="/capital-humano/recibos" element={<RecibosPage />} />
                  <Route path="/capital-humano/declaracoes" element={<DeclaracoesPage />} />
                  {/* Finanças */}
                  <Route path="/financas/requisicoes" element={<RequisicoesPage />} />
                  <Route path="/financas/bancos" element={<BancosPage />} />
                  <Route path="/financas/contas-bancarias" element={<ContasBancariasPage />} />
                  <Route path="/financas/tesouraria" element={<TesourariaPage />} />
                  <Route path="/financas/centros-custo" element={<CentrosCustoPage />} />
                  <Route path="/financas/projectos" element={<ProjectosPage />} />
                  <Route path="/financas/relatorios" element={<RelatoriosPage />} />
                  {/* Contabilidade */}
                  <Route path="/contabilidade/pagamentos" element={<PagamentosPage />} />
                  <Route path="/contabilidade/pendencias" element={<PendenciasPage />} />
                  {/* Secretaria Geral */}
                  <Route path="/secretaria/reunioes" element={<ReunioesPage />} />
                  <Route path="/secretaria/actas" element={<ActasPage />} />
                  <Route path="/secretaria/documentos" element={<DocumentosOficiaisPage />} />
                  <Route path="/gestao-documentos" element={<GestaoDocumentosPage />} />
                  <Route path="/secretaria/gestao-documentos" element={<Navigate to="/gestao-documentos" replace />} />
                  <Route path="/secretaria/correspondencias" element={<CorrespondenciasPage />} />
                  <Route path="/secretaria/arquivo" element={<ArquivoPage />} />
                  {/* Jurídico */}
                  <Route path="/juridico/contratos" element={<ContratosPage />} />
                  <Route path="/juridico/processos" element={<ProcessosJudiciaisPage />} />
                  <Route path="/juridico/processos-disciplinares" element={<ProcessosDisciplinaresPage />} />
                  <Route path="/juridico/processos-disciplinares/:id" element={<ProcessosDisciplinaresPage />} />
                  <Route path="/juridico/prazos" element={<PrazosPage />} />
                  <Route path="/juridico/riscos" element={<RiscosJuridicosPage />} />
                  <Route path="/juridico/rescisoes" element={<RescisoesContratuaisPage />} />
                  <Route path="/juridico/arquivo" element={<ArquivoJuridicoPage />} />
                  {/* Portal Colaborador */}
                  <Route path="/portal/dados" element={<PortalDadosPage />} />
                  <Route path="/portal/ferias" element={<PortalFeriasPage />} />
                  <Route path="/portal/faltas" element={<GenericModulePage title="As Minhas Faltas" module="portal" />} />
                  <Route path="/portal/recibos" element={<PortalRecibosPage />} />
                  <Route path="/portal/declaracoes" element={<PortalDeclaracoesPage />} />
                  <Route path="/portal/requisicoes" element={<PortalRequisicoesPage />} />
                  {/* Comunicação Interna */}
                  <Route path="/comunicacao-interna/noticias" element={<NoticiasPage />} />
                  <Route path="/comunicacao-interna/noticias/:id" element={<NoticiaDetalhePage />} />
                  <Route path="/comunicacao-interna/eventos" element={<EventosPage />} />
                  <Route path="/comunicacao-interna/eventos/:id" element={<EventoDetalhePage />} />
                  <Route path="/comunicacao-interna/aniversarios" element={<AniversariosPage />} />
                  {/* Config */}
                  <Route path="/configuracoes" element={<GenericModulePage title="Configurações" module="config" />} />
                  <Route path="/configuracoes/utilizadores" element={<UtilizadoresPage />} />
                  <Route path="/configuracoes/departamentos" element={<DepartamentosPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ChatProvider>
        </NotificationProvider>
        </DataProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
