import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { getModulosAtivosForContext } from '@/utils/empresaModulos';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const PATH_TO_MODULE: Record<string, string> = {
  '/portal': 'portal-colaborador',
  '/capital-humano': 'capital-humano',
  '/financas': 'financas',
  '/contabilidade': 'contabilidade',
  '/secretaria': 'secretaria',
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

  const pathPrefix = '/' + pathname.split('/')[1];
  const moduleForPath = PATH_TO_MODULE[pathPrefix];
  if (user && moduleForPath && !hasModuleAccess(user, moduleForPath)) {
    return <Navigate to="/dashboard" replace />;
  }
  const modulosAtivos = getModulosAtivosForContext(currentEmpresaId, empresas);
  if (user && moduleForPath && modulosAtivos != null && !modulosAtivos.includes(moduleForPath)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-5 lg:p-8 overflow-x-hidden bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
