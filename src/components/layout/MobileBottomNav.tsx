import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  DollarSign,
  FolderArchive,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Scale,
  Stamp,
  Target,
  UserCircle,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useIntranetNavModel } from '@/navigation/useIntranetNavModel';
import { cn } from '@/lib/utils';

type TabVariant = 'default' | 'more';

function TabButton({
  to,
  label,
  icon: Icon,
  end,
  modulePath,
  variant = 'default',
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Se definido, activo para todo o módulo (ex. /comunicacao-interna). */
  modulePath?: string;
  /** «Mais»: activo também em /perfil (ecrã Conta aberto a partir do avatar). */
  variant?: TabVariant;
}) {
  const { pathname } = useLocation();

  const isActive =
    variant === 'more'
      ? pathname === '/mais' || pathname === '/perfil'
      : modulePath != null
        ? pathname === modulePath || pathname.startsWith(`${modulePath}/`)
        : end
          ? pathname === to || pathname === `${to}/`
          : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <NavLink
      to={to}
      end={variant === 'more' ? false : Boolean(end)}
      className={cn(
        'flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        isActive ? 'text-primary' : 'text-muted-foreground',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
          isActive && 'bg-primary/15',
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 2} />
      </span>
      <span className="max-w-full truncate text-center text-[10px] font-semibold leading-tight">{label}</span>
    </NavLink>
  );
}

export function MobileBottomNav() {
  const { user } = useAuth();
  const nav = useIntranetNavModel();

  const shortcut = useMemo(() => {
    if (!nav || !user) {
      return {
        to: '/comunicacao-interna/eventos',
        label: 'Eventos',
        icon: CalendarDays,
        modulePath: '/comunicacao-interna',
      };
    }
    const { canShowModule } = nav;
    const candidates: Array<{ test: boolean; to: string; label: string; icon: LucideIcon; modulePath?: string }> = [
      {
        test: canShowModule('comunicacao-interna'),
        to: '/comunicacao-interna/noticias',
        label: 'Notícias',
        icon: Megaphone,
        modulePath: '/comunicacao-interna',
      },
      {
        test: canShowModule('financas'),
        to: '/financas/requisicoes',
        label: 'Finanças',
        icon: DollarSign,
        modulePath: '/financas',
      },
      {
        test: canShowModule('capital-humano'),
        to: '/capital-humano/colaboradores',
        label: 'Equipa',
        icon: Users,
        modulePath: '/capital-humano',
      },
      {
        test: canShowModule('gestao-documentos'),
        to: '/gestao-documentos',
        label: 'Docs',
        icon: FolderArchive,
        modulePath: '/gestao-documentos',
      },
      {
        test: canShowModule('secretaria'),
        to: '/secretaria/reunioes',
        label: 'Secret.',
        icon: Stamp,
        modulePath: '/secretaria',
      },
      {
        test: canShowModule('planeamento'),
        to: '/planeamento/relatorios',
        label: 'Plan.',
        icon: Target,
        modulePath: '/planeamento',
      },
      { test: canShowModule('juridico'), to: '/juridico/contratos', label: 'Juríd.', icon: Scale, modulePath: '/juridico' },
      {
        test: hasModuleAccess(user, 'portal-colaborador'),
        to: '/portal/dados',
        label: 'Portal',
        icon: UserCircle,
        modulePath: '/portal',
      },
    ];
    const found = candidates.find(c => c.test);
    return (
      found ?? {
        to: '/comunicacao-interna/eventos',
        label: 'Eventos',
        icon: CalendarDays,
        modulePath: '/comunicacao-interna',
      }
    );
  }, [nav, user]);

  if (!user || !nav) return null;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 md:hidden"
      aria-label="Navegação inferior"
    >
      <div className="pointer-events-auto mx-auto flex max-w-lg items-stretch gap-0.5 rounded-[1.35rem] border border-border/60 bg-card/95 px-1 py-1.5 shadow-lg shadow-black/10 backdrop-blur-md supports-[backdrop-filter]:bg-card/90">
        <TabButton to="/dashboard" label="Início" icon={LayoutDashboard} end />
        <TabButton to="/notificacoes" label="Avisos" icon={Bell} end />
        <TabButton to="/chat" label="Chat" icon={MessageCircle} end />
        <TabButton
          to={shortcut.to}
          label={shortcut.label}
          icon={shortcut.icon}
          modulePath={shortcut.modulePath}
        />
        <TabButton to="/mais" label="Mais" icon={MoreHorizontal} variant="more" />
      </div>
    </nav>
  );
}
