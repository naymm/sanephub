import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GENERAL_ITEMS } from '@/navigation/intranetNavConfig';
import { intranetNavIconForPath } from '@/navigation/intranetNavIcons';
import { useIntranetNavModel } from '@/navigation/useIntranetNavModel';
import { cn } from '@/lib/utils';

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="pt-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-0">
      {children}
    </p>
  );
}

/** Mesmo padrão visual que `MobileProfileMenuPage` → `MenuRow` (ícone à esquerda, chevron). */
function MenuRowFromPath({ to, label, path }: { to: string; label: string; path: string }) {
  const glyph = intranetNavIconForPath(path);
  return (
    <NavLink
      to={to}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-3.5 text-left shadow-sm transition-colors md:px-4',
        'active:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0">
        {glyph ?? <span className="text-xs font-bold leading-none">{label.split(' ')[0].slice(0, 1)}</span>}
      </span>
      <span className="min-w-0 flex-1 font-medium text-foreground leading-snug">{label}</span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

/**
 * Ecrã «Mais» — mesmo visual que `MobileProfileMenuPage` (cabeçalho mobile, linhas, secções).
 */
export default function MobileMoreMenuPage() {
  const navigate = useNavigate();
  const nav = useIntranetNavModel();

  if (!nav) return null;

  const {
    topItems,
    portalNavItems,
    groups,
    isColaborador,
    hasPortalColaborador,
    hasAnyNonPortalModule,
    canShowChild,
    canShowModule,
    flatMixedLinks,
  } = nav;

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/dashboard');
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col">
      {/* <div className="md:hidden">
        <div className="rounded-b-3xl bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-lighter))] px-3 pb-5 pt-1 text-white shadow-md">
          <div className="relative flex min-h-12 items-center justify-center">
            <button
              type="button"
              onClick={goBack}
              className="absolute left-0 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <h1 className="text-base font-semibold tracking-tight">Mais</h1>
          </div>
        </div>
      </div> */}

      <div className="hidden md:block pb-3">
        <h1 className="page-header">Menu</h1>
        <p className="text-sm text-muted-foreground">Acesso rápido a todas as áreas.</p>
      </div>

      <div className="flex flex-col gap-2 py-3 md:py-2">
        {hasPortalColaborador && hasAnyNonPortalModule ? (
          <div className="flex flex-col gap-2">
            <MenuRowFromPath to="/dashboard" label="Dashboard" path="/dashboard" />
            {GENERAL_ITEMS.filter(i => i.path !== '/dashboard' && canShowModule(i.module)).map(item => (
              <MenuRowFromPath key={item.path} to={item.path} label={item.label} path={item.path} />
            ))}
            {portalNavItems.map(item => (
              <MenuRowFromPath key={item.path} to={item.path} label={item.label} path={item.path} />
            ))}
            {flatMixedLinks.map(child => (
              <MenuRowFromPath key={child.path} to={child.path} label={child.label} path={child.path} />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <SectionLabel>Geral</SectionLabel>
              {topItems.map(item => (
                <MenuRowFromPath key={item.path} to={item.path} label={item.label} path={item.path} />
              ))}
            </div>

            {isColaborador && portalNavItems.length > 0 && (
              <>
                <div className="my-1 border-t border-border/60 md:my-2" />
                <div className="flex flex-col gap-2">
                  <SectionLabel>Portal</SectionLabel>
                  {portalNavItems.map(item => (
                    <MenuRowFromPath key={item.path} to={item.path} label={item.label} path={item.path} />
                  ))}
                </div>
              </>
            )}

            {groups.map((g, index) => (
              <div key={g.label}>
                {(topItems.length > 0 || (isColaborador && portalNavItems.length > 0) || index > 0) && (
                  <div className="my-1 border-t border-border/60 md:my-2" />
                )}
                <div className="flex flex-col gap-2">
                  <SectionLabel>{g.label}</SectionLabel>
                  {g.children.filter(canShowChild).map(child => (
                    <MenuRowFromPath key={child.path} to={child.path} label={child.label} path={child.path} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
