import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Cake,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  LogOut,
  Lock,
  Megaphone,
  ScrollText,
  Settings,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { PORTAL_MENU_ITEMS, labelPortalMenuItem } from '@/navigation/portalMenu';
import { PORTAL_PATH_ICONS } from '@/navigation/portalMenuIcons';
import { getModulosAtivosForContext, empresaTemFacturacaoActiva, empresaTemModuloActivado } from '@/utils/empresaModulos';
import { orgModuloEstaActivado, rotaBloqueadaPorRecursosDesactivados } from '@/utils/orgFeatureAccess';
import { cn } from '@/lib/utils';
import { useMobileSessionLock } from '@/context/MobileSessionLockContext';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="pt-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-0">
      {children}
    </p>
  );
}

function MenuRow({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-3.5 text-left shadow-sm transition-colors md:px-4',
        'active:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
      )}
    >
      <Icon className="h-5 w-5 shrink-0 text-foreground" strokeWidth={2} />
      <span className="min-w-0 flex-1 font-medium text-foreground leading-snug">{label}</span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

/**
 * Ecrã mobile (e fallback desktop): mesmas opções que o menu do avatar no topbar.
 */
export default function MobileProfileMenuPage() {
  const { user, logout } = useAuth();
  const { lockNow } = useMobileSessionLock();
  const isMobileViewport = useIsMobileViewport();
  const navigate = useNavigate();
  const { empresas, organizacaoSettings } = useData();
  const { currentEmpresaId } = useTenant();

  const modulosAtivos = useMemo(
    () => getModulosAtivosForContext(currentEmpresaId, empresas),
    [currentEmpresaId, empresas],
  );
  const facturacaoActiva = useMemo(
    () => empresaTemFacturacaoActiva(currentEmpresaId, empresas),
    [currentEmpresaId, empresas],
  );

  const canShowModule = useCallback(
    (moduleId?: string) => {
      if (!user) return false;
      if (!moduleId) return true;
      if (moduleId === 'facturacao' && !facturacaoActiva) return false;
      if (!orgModuloEstaActivado(organizacaoSettings, moduleId)) return false;
      if (!hasModuleAccess(user, moduleId)) return false;
      if (user.perfil === 'Colaborador') return true;
      if (modulosAtivos == null) return true;
      return empresaTemModuloActivado(modulosAtivos, moduleId);
    },
    [user, organizacaoSettings, modulosAtivos, facturacaoActiva],
  );

  if (!user) return null;

  const hasPortalColaborador =
    user.perfil === 'Colaborador' &&
    Array.isArray(user.modulos) &&
    user.modulos.includes('portal-colaborador');

  const portalItemsFiltered = PORTAL_MENU_ITEMS.filter(
    item =>
      !rotaBloqueadaPorRecursosDesactivados(item.path, organizacaoSettings.recursosDesactivados),
  );

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/dashboard');
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col">
      {/* <div className="md:hidden">
        <div className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-lighter))] px-3 pb-5 pt-1 text-white shadow-md rounded-b-3xl">
          <div className="relative flex min-h-12 items-center justify-center">
            <button
              type="button"
              onClick={goBack}
              className="absolute left-0 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <h1 className="text-base font-semibold tracking-tight">Conta</h1>
          </div>
        </div>
      </div> */}

      <div className="hidden md:block pb-3">
        <h1 className="page-header">Conta e perfil</h1>
        <p className="text-sm text-muted-foreground">As mesmas opções do menu do utilizador.</p>
      </div>

      <div className="flex flex-col gap-2 py-3 md:py-2">
        <MenuRow to="/portal/dados" label="Ver Perfil" icon={User} />

        {canShowModule('portal-colaborador') && portalItemsFiltered.length > 0 && (
          <>
            <SectionLabel>Portal</SectionLabel>
            <div className="flex flex-col gap-2">
              {portalItemsFiltered.map(item => {
                const Icon = PORTAL_PATH_ICONS[item.path] ?? FileText;
                return (
                  <MenuRow
                    key={item.path}
                    to={item.path}
                    label={labelPortalMenuItem(item, user.modulos)}
                    icon={Icon}
                  />
                );
              })}
            </div>
          </>
        )}

        {hasPortalColaborador && (
          <>
            <div className="my-1 border-t border-border/60 md:my-2" />
            <div className="flex flex-col gap-2">
              <MenuRow to="/comunicacao-interna/noticias" label="Notícias" icon={Megaphone} />
              <MenuRow to="/comunicacao-interna/eventos" label="Eventos" icon={CalendarDays} />
              <MenuRow to="/comunicacao-interna/comunicados" label="Comunicados" icon={ScrollText} />
              <MenuRow to="/comunicacao-interna/aniversarios" label="Aniversariantes" icon={Cake} />
            </div>
          </>
        )}

        {user.perfil === 'Admin' && (
          <>
            <div className="my-1 border-t border-border/60 md:my-2" />
            <div className="flex flex-col gap-2">
              <MenuRow to="/configuracoes/modulos-recursos" label="Módulos e recursos" icon={Layers} />
              <MenuRow to="/configuracoes" label="Configurações" icon={Settings} />
            </div>
          </>
        )}

        <div className="my-2 border-t border-border/60" />

        {isMobileViewport && (
          <button
            type="button"
            onClick={() => lockNow()}
            className={cn(
              'flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-3.5 text-left shadow-sm transition-colors md:px-4',
              'active:bg-muted/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
            )}
          >
            <Lock className="h-5 w-5 shrink-0 text-foreground" strokeWidth={2} />
            <span className="flex-1 font-medium text-foreground leading-snug">Bloquear app (PIN de ponto)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => void logout()}
          className={cn(
            'flex min-h-12 w-full items-center gap-3 rounded-2xl border border-destructive/25 bg-card px-3 py-3.5 text-left shadow-sm transition-colors md:px-4',
            'text-destructive hover:bg-destructive/5 active:bg-destructive/10',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30',
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={2} />
          <span className="flex-1 font-semibold">Terminar Sessão</span>
        </button>
      </div>
    </div>
  );
}
