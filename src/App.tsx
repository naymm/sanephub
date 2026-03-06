import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
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
import CentrosCustoPage from "@/modules/financas/CentrosCustoPage";
import ProjectosPage from "@/modules/financas/ProjectosPage";
import RelatoriosPage from "@/modules/financas/RelatoriosPage";
import PagamentosPage from "@/modules/contabilidade/PagamentosPage";
import PendenciasPage from "@/modules/contabilidade/PendenciasPage";
import ContratosPage from "@/modules/juridico/ContratosPage";
import PrazosPage from "@/modules/juridico/PrazosPage";
import ReunioesPage from "@/modules/secretaria/ReunioesPage";
import ActasPage from "@/modules/secretaria/ActasPage";
import DocumentosOficiaisPage from "@/modules/secretaria/DocumentosOficiaisPage";
import CorrespondenciasPage from "@/modules/secretaria/CorrespondenciasPage";
import ArquivoPage from "@/modules/secretaria/ArquivoPage";
import UtilizadoresPage from "@/modules/config/UtilizadoresPage";
import DepartamentosPage from "@/modules/config/DepartamentosPage";
import GenericModulePage from "@/modules/GenericModulePage";
import PortalRecibosPage from "@/modules/portal/PortalRecibosPage";
import PortalDeclaracoesPage from "@/modules/portal/PortalDeclaracoesPage";
import PortalFeriasPage from "@/modules/portal/PortalFeriasPage";
import PortalRequisicoesPage from "@/modules/portal/PortalRequisicoesPage";
import ChatPage from "@/modules/chat/ChatPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
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
                  {/* Capital Humano */}
                  <Route path="/capital-humano/colaboradores" element={<ColaboradoresPage />} />
                  <Route path="/capital-humano/ferias" element={<FeriasPage />} />
                  <Route path="/capital-humano/faltas" element={<FaltasPage />} />
                  <Route path="/capital-humano/recibos" element={<RecibosPage />} />
                  <Route path="/capital-humano/declaracoes" element={<DeclaracoesPage />} />
                  {/* Finanças */}
                  <Route path="/financas/requisicoes" element={<RequisicoesPage />} />
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
                  <Route path="/secretaria/correspondencias" element={<CorrespondenciasPage />} />
                  <Route path="/secretaria/arquivo" element={<ArquivoPage />} />
                  {/* Jurídico */}
                  <Route path="/juridico/contratos" element={<ContratosPage />} />
                  <Route path="/juridico/processos" element={<GenericModulePage title="Processos Judiciais" module="processos" />} />
                  <Route path="/juridico/prazos" element={<PrazosPage />} />
                  <Route path="/juridico/riscos" element={<GenericModulePage title="Riscos Jurídicos" module="riscos" />} />
                  <Route path="/juridico/arquivo" element={<GenericModulePage title="Arquivo Documental" module="arquivo-juridico" />} />
                  {/* Portal Colaborador */}
                  <Route path="/portal/dados" element={<GenericModulePage title="Os Meus Dados" module="portal" />} />
                  <Route path="/portal/ferias" element={<PortalFeriasPage />} />
                  <Route path="/portal/faltas" element={<GenericModulePage title="As Minhas Faltas" module="portal" />} />
                  <Route path="/portal/recibos" element={<PortalRecibosPage />} />
                  <Route path="/portal/declaracoes" element={<PortalDeclaracoesPage />} />
                  <Route path="/portal/requisicoes" element={<PortalRequisicoesPage />} />
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
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
