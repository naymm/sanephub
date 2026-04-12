import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { getModulosAtivosForContext } from '@/utils/empresaModulos';
import { rotaBloqueadaPorRecursosDesactivados, tenantPodeUsarModulo } from '@/utils/orgFeatureAccess';
import { cn } from '@/lib/utils';
import { IntranetTopbar } from './IntranetTopbar';
import { HorizontalMenu } from './HorizontalMenu';
import { FloatingCornerActions } from './FloatingCornerActions';
import { MobileBottomNav } from './MobileBottomNav';
import { ColaboradorPrimeiroAcessoWizard } from '@/components/onboarding/ColaboradorPrimeiroAcessoWizard';

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
  '/comunicacao-interna': 'comunicacao-interna',
  '/configuracoes': 'configuracoes',
};

export function Layout() {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const { empresas, organizacaoSettings } = useData();
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
  if (user && moduleForPath && !tenantPodeUsarModulo(modulosAtivos, organizacaoSettings, moduleForPath)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (
    user &&
    organizacaoSettings.recursosDesactivados.length > 0 &&
    rotaBloqueadaPorRecursosDesactivados(pathname, organizacaoSettings.recursosDesactivados)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-background flex flex-col">
      <IntranetTopbar />
      <HorizontalMenu />
      {/* Altura do header fixo + menu horizontal (desktop); mobile: só topbar (spacer no IntranetTopbar) */}
      <div
        className="hidden shrink-0 md:block md:h-[calc(env(safe-area-inset-top,0px)+4rem+1px+52px+1px)]"
        aria-hidden
      />
      <main
        className={cn(
          'flex-1 overflow-x-hidden w-full min-w-0 pt-4 pb-28 max-md:bg-muted/45 md:bg-background md:pt-5 md:pb-5 lg:pt-8 lg:pb-8',
          pathname === '/mais' || pathname === '/perfil'
            ? 'max-md:px-3 md:px-5 lg:px-8'
            : 'px-4 md:px-5 lg:px-8',
        )}
      >
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
              A carregar…
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <footer className="hidden md:block border-t border-border/80 px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} GRUPO SANEP. Todos os direitos reservados.
      </footer>
      <MobileBottomNav />
      <FloatingCornerActions />
      <ColaboradorPrimeiroAcessoWizard />
    </div>
  );
}
