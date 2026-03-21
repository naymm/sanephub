import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { getModulosAtivosForContext, empresaTemModuloActivado } from '@/utils/empresaModulos';
import { IntranetTopbar } from './IntranetTopbar';
import { HorizontalMenu } from './HorizontalMenu';

const PATH_TO_MODULE: Record<string, string> = {
  '/portal': 'portal-colaborador',
  '/capital-humano': 'capital-humano',
  '/financas': 'financas',
  '/contabilidade': 'contabilidade',
  '/secretaria': 'secretaria',
  '/gestao-documentos': 'gestao-documentos',
  '/juridico': 'juridico',
  '/planeamento': 'planeamento',
  '/conselho-administracao': 'conselho-administracao',
  '/configuracoes': 'configuracoes',
};

export function Layout() {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const { empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const location = useLocation();
  const pathname = location.pathname;

  if (!isAuthReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">A carregar...</div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Bloqueio específico: “Empresas do Grupo” apenas para Admin (não PCA).
  if (user?.perfil !== 'Admin' && pathname.startsWith('/conselho-administracao/empresas')) {
    return <Navigate to="/dashboard" replace />;
  }

  // Catálogo de bancos: apenas Admin.
  if (user?.perfil !== 'Admin' && pathname.startsWith('/financas/bancos')) {
    return <Navigate to="/dashboard" replace />;
  }

  const pathPrefix = '/' + pathname.split('/')[1];
  let moduleForPath = PATH_TO_MODULE[pathPrefix];
  // Rota legada: mesmo módulo que /gestao-documentos (whitelist por empresa)
  if (pathname.startsWith('/secretaria/gestao-documentos')) {
    moduleForPath = 'gestao-documentos';
  }
  if (user && moduleForPath && !hasModuleAccess(user, moduleForPath)) {
    return <Navigate to="/dashboard" replace />;
  }
  const modulosAtivos = getModulosAtivosForContext(currentEmpresaId, empresas);
  if (user && moduleForPath && modulosAtivos != null && !empresaTemModuloActivado(modulosAtivos, moduleForPath)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <IntranetTopbar />
      <HorizontalMenu />
      <main className="flex-1 p-5 lg:p-8 overflow-x-hidden bg-background">
        <Outlet />
      </main>
      <footer className="border-t border-border/80 px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} GRUPO SANEP. Todos os direitos reservados.
      </footer>
    </div>
  );
}
