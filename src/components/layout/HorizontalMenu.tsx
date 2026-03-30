import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type React from 'react';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { getModulosAtivosForContext, empresaTemModuloActivado } from '@/utils/empresaModulos';
import { PORTAL_MENU_ITEMS } from '@/navigation/portalMenu';
import {
  Users,
  Palmtree,
  Bell,
  MessageCircle,
  DollarSign,
  FileText,
  Scale,
  Stamp,
  Target,
  Crown,
  Megaphone,
  CalendarDays,
  Cake,
  FolderArchive,
  Calculator,
  Fingerprint,
  MapPin,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type MenuChild = { label: string; path: string; module?: string; adminOnly?: boolean };
type MenuGroup = { label: string; module?: string; children: MenuChild[]; icon?: React.ComponentType<{ className?: string }> };

const GENERAL_ITEMS: MenuChild[] = [
  { label: 'Dashboard', path: '/dashboard', module: 'dashboard' },
  { label: 'Notificações', path: '/notificacoes', module: 'dashboard' },
];

const MODULE_GROUPS: MenuGroup[] = [
  {
    label: 'Capital Humano',
    module: 'capital-humano',
    icon: Users,
    children: [
      { label: 'Colaboradores', path: '/capital-humano/colaboradores', module: 'capital-humano' },
      { label: 'Férias', path: '/capital-humano/ferias', module: 'capital-humano' },
      { label: 'Faltas', path: '/capital-humano/faltas', module: 'capital-humano' },
      { label: 'Recibos', path: '/capital-humano/recibos', module: 'capital-humano' },
      { label: 'Processamento Salarial', path: '/capital-humano/processamento-salarial', module: 'capital-humano' },
      { label: 'Declarações', path: '/capital-humano/declaracoes', module: 'capital-humano' },
      { label: 'Marcações de ponto', path: '/capital-humano/marcacoes-ponto', module: 'capital-humano' },
      { label: 'Zonas de trabalho', path: '/capital-humano/zonas-trabalho', module: 'capital-humano' },
    ],
  },
  {
    label: 'Finanças',
    module: 'financas',
    icon: DollarSign,
    children: [
      { label: 'Requisições', path: '/financas/requisicoes', module: 'financas' },
      { label: 'Bancos', path: '/financas/bancos', module: 'financas', adminOnly: true },
      { label: 'Contas bancárias', path: '/financas/contas-bancarias', module: 'financas' },
      { label: 'Tesouraria', path: '/financas/tesouraria', module: 'financas' },
      { label: 'Centros de Custo', path: '/financas/centros-custo', module: 'financas' },
      { label: 'Projectos', path: '/financas/projectos', module: 'financas' },
      { label: 'Relatórios', path: '/financas/relatorios', module: 'financas' },
    ],
  },
  {
    label: 'Contabilidade',
    module: 'contabilidade',
    icon: FileText,
    children: [
      { label: 'Pagamentos Recebidos', path: '/contabilidade/pagamentos', module: 'contabilidade' },
      { label: 'Pendências', path: '/contabilidade/pendencias', module: 'contabilidade' },
    ],
  },
  {
    label: 'Secretaria Geral',
    module: 'secretaria',
    icon: Stamp,
    children: [
      { label: 'Reuniões', path: '/secretaria/reunioes', module: 'secretaria' },
      { label: 'Actas', path: '/secretaria/actas', module: 'secretaria' },
      { label: 'Documentos Oficiais', path: '/secretaria/documentos', module: 'secretaria' },
      { label: 'Correspondências', path: '/secretaria/correspondencias', module: 'secretaria' },
      { label: 'Arquivo', path: '/secretaria/arquivo', module: 'secretaria' },
    ],
  },
  {
    label: 'Gestão documental',
    module: 'gestao-documentos',
    icon: FolderArchive,
    children: [{ label: 'Documentos', path: '/gestao-documentos', module: 'gestao-documentos' }],
  },
  {
    label: 'Jurídico',
    module: 'juridico',
    icon: Scale,
    children: [
      { label: 'Contratos', path: '/juridico/contratos', module: 'juridico' },
      { label: 'Processos Judiciais', path: '/juridico/processos', module: 'juridico' },
      { label: 'Processos Disciplinares', path: '/juridico/processos-disciplinares', module: 'juridico' },
      { label: 'Prazos', path: '/juridico/prazos', module: 'juridico' },
      { label: 'Riscos', path: '/juridico/riscos', module: 'juridico' },
      { label: 'Rescisões', path: '/juridico/rescisoes', module: 'juridico' },
      { label: 'Arquivo Documental', path: '/juridico/arquivo', module: 'juridico' },
    ],
  },
  {
    label: 'Planeamento',
    module: 'planeamento',
    icon: Target,
    children: [
      { label: 'Relatórios', path: '/planeamento/relatorios', module: 'planeamento' },
      { label: 'Consolidação', path: '/planeamento/consolidacao', module: 'planeamento' },
      { label: 'Dashboard', path: '/planeamento/dashboard', module: 'planeamento' },
    ],
  },
  {
    label: 'Comunicação Interna',
    module: 'comunicacao-interna',
    icon: Megaphone,
    children: [
      { label: 'Notícias', path: '/comunicacao-interna/noticias', module: 'comunicacao-interna' },
      { label: 'Eventos', path: '/comunicacao-interna/eventos', module: 'comunicacao-interna' },
      { label: 'Aniversariantes', path: '/comunicacao-interna/aniversarios', module: 'comunicacao-interna' },
    ],
  },
  {
    label: 'Conselho de Administração',
    module: 'conselho-administracao',
    icon: Crown,
    children: [
      { label: 'Painel Executivo', path: '/conselho-administracao', module: 'conselho-administracao' },
      { label: 'Decisões Institucionais', path: '/conselho-administracao/decisoes', module: 'conselho-administracao' },
      { label: 'Assinatura de Actos', path: '/conselho-administracao/assinatura-actos', module: 'conselho-administracao' },
      { label: 'Saúde Financeira', path: '/conselho-administracao/saude-financeira', module: 'conselho-administracao' },
      { label: 'Actividade Organizacional', path: '/conselho-administracao/actividade', module: 'conselho-administracao' },
    ],
  },
];

const PORTAL_ITEMS: MenuChild[] = [...PORTAL_MENU_ITEMS];

export function HorizontalMenu() {
  const { user } = useAuth();
  const { empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const modulosAtivos = getModulosAtivosForContext(currentEmpresaId, empresas);

  const canShowModule = (moduleId?: string) => {
    if (!moduleId) return true;
    // Colaborador: sempre permitir acesso ao Dashboard no menu (independente de `user.modulos` conter 'dashboard').
    if (user.perfil === 'Colaborador' && moduleId === 'dashboard') return true;
    // Colaborador: mostrar Comunicação Interna (Notícias/Eventos/Aniversariantes) em modo leitura.
    // O acesso "read-only" é reforçado no backend (RLS CRUD restrito), mas o menu precisa aparecer.
    if (user.perfil === 'Colaborador' && moduleId === 'comunicacao-interna') return true;
    if (!hasModuleAccess(user, moduleId)) return false;
    // Para perfil Colaborador, a decisão de acesso vem do próprio `user.modulos`.
    // Evita que uma configuração incompleta em `modulos_ativos` (multi-tenant) esconda o menu.
    if (user.perfil === 'Colaborador') return true;
    if (modulosAtivos == null) return true;
    return empresaTemModuloActivado(modulosAtivos, moduleId);
  };

  const isColaborador = user.perfil === 'Colaborador';
  const hasPortalColaborador = isColaborador && Array.isArray(user.modulos) && user.modulos.includes('portal-colaborador');
  const hasAnyNonPortalModule =
    hasPortalColaborador && Array.isArray(user.modulos) && user.modulos.some(m => m !== 'portal-colaborador');

  const canShowChild = (child: MenuChild) => {
    if (child.adminOnly && user.perfil !== 'Admin') return false;
    if (!child.module) return true;
    return canShowModule(child.module);
  };

  const topItems = GENERAL_ITEMS.filter(i => canShowModule(i.module));
  const portalItems = PORTAL_ITEMS.filter(i => canShowModule(i.module));
  const groups = MODULE_GROUPS.filter(g => canShowModule(g.module));

  // Ícones fixos para alguns itens; para outros usamos o rótulo.
  const iconByPath: Record<string, React.ReactNode> = {
    '/dashboard': <span className="text-[11px] font-bold">D</span>,
    '/notificacoes': <Bell className="h-4 w-4" />,
    '/portal/ferias': <Palmtree className="h-4 w-4" />,
    '/portal/declaracoes': <FileText className="h-4 w-4" />,
    '/capital-humano/colaboradores': <Users className="h-4 w-4" />,
    '/capital-humano/ferias': <Palmtree className="h-4 w-4" />,
    '/capital-humano/faltas': <Target className="h-4 w-4" />,
    '/capital-humano/recibos': <FileText className="h-4 w-4" />,
    '/capital-humano/processamento-salarial': <Calculator className="h-4 w-4" />,
    '/capital-humano/declaracoes': <FileText className="h-4 w-4" />,
    '/capital-humano/marcacoes-ponto': <Fingerprint className="h-4 w-4" />,
    '/capital-humano/zonas-trabalho': <MapPin className="h-4 w-4" />,
    '/financas/requisicoes': <DollarSign className="h-4 w-4" />,
    '/financas/bancos': <DollarSign className="h-4 w-4" />,
    '/financas/contas-bancarias': <DollarSign className="h-4 w-4" />,
    '/financas/tesouraria': <DollarSign className="h-4 w-4" />,
    '/financas/centros-custo': <DollarSign className="h-4 w-4" />,
    '/financas/projectos': <DollarSign className="h-4 w-4" />,
    '/financas/relatorios': <FileText className="h-4 w-4" />,
    '/contabilidade/pagamentos': <FileText className="h-4 w-4" />,
    '/contabilidade/pendencias': <Stamp className="h-4 w-4" />,
    '/secretaria/reunioes': <Stamp className="h-4 w-4" />,
    '/secretaria/actas': <FileText className="h-4 w-4" />,
    '/secretaria/documentos': <FileText className="h-4 w-4" />,
    '/gestao-documentos': <FolderArchive className="h-4 w-4" />,
    '/secretaria/correspondencias': <MessageCircle className="h-4 w-4" />,
    '/secretaria/arquivo': <Scale className="h-4 w-4" />,
    '/juridico/contratos': <Scale className="h-4 w-4" />,
    '/juridico/processos': <Scale className="h-4 w-4" />,
    '/juridico/processos-disciplinares': <Scale className="h-4 w-4" />,
    '/juridico/prazos': <Stamp className="h-4 w-4" />,
    '/juridico/riscos': <Target className="h-4 w-4" />,
    '/juridico/rescisoes': <Scale className="h-4 w-4" />,
    '/juridico/arquivo': <Scale className="h-4 w-4" />,
    '/planeamento/relatorios': <Target className="h-4 w-4" />,
    '/planeamento/consolidacao': <Target className="h-4 w-4" />,
    '/planeamento/dashboard': <Target className="h-4 w-4" />,
    '/comunicacao-interna/noticias': <Megaphone className="h-4 w-4" />,
    '/comunicacao-interna/eventos': <CalendarDays className="h-4 w-4" />,
    '/comunicacao-interna/aniversarios': <Cake className="h-4 w-4" />,
  };

  const itemClass = (active: boolean) =>
    cn(
      'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors whitespace-nowrap',
      active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    );

  return (
    <nav className="sticky z-20 top-16 bg-background/95 backdrop-blur-sm border-b border-border/80">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 h-[52px] flex items-center gap-2 overflow-x-auto">
        {hasPortalColaborador ? (
          <>
            {/* Colaborador + Portal + outro módulo:
                - Mostrar Dashboard e TODOS os submenus acessíveis directamente no bar (sem dropdown). */}
            <NavLink
              to="/dashboard"
              className={({ isActive }) => itemClass(isActive || location.pathname === '/dashboard')}
            >
              {iconByPath['/dashboard'] ? iconByPath['/dashboard'] : <span>D</span>}
              <span className="hidden sm:inline">Dashboard</span>
            </NavLink>

            {GENERAL_ITEMS.filter(i => i.path !== '/dashboard' && canShowModule(i.module)).map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => itemClass(isActive || location.pathname === item.path)}
              >
                {iconByPath[item.path] ? iconByPath[item.path] : <span>{item.label.split(' ')[0]}</span>}
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}

            {/* Portal: no ramo «flat» (Colaborador com portal + outros módulos) estes itens não vinham de MODULE_GROUPS — era preciso listá-los aqui. */}
            {portalItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => itemClass(isActive || location.pathname === item.path)}
              >
                {iconByPath[item.path] ? iconByPath[item.path] : (
                  <span className="text-[11px] font-bold">{item.label.split(' ')[0].slice(0, 1)}</span>
                )}
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.label.split(' ')[0]}</span>
              </NavLink>
            ))}

            {MODULE_GROUPS.flatMap(g => {
              // Para Colaborador, mostramos Comunicação Interna como leitura
              // para quem tem Portal (mesmo que 'comunicacao-interna' não esteja explicitamente na lista de módulos).
              const shouldShowComunicacao =
                isColaborador && hasPortalColaborador && g.module === 'comunicacao-interna';
              const allowed = shouldShowComunicacao || canShowModule(g.module);
              return allowed ? g.children.filter(canShowChild) : [];
            }).map(child => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  className={({ isActive }) => itemClass(isActive || location.pathname === child.path)}
                >
                  {iconByPath[child.path] ? iconByPath[child.path] : <span className="text-[11px] font-bold">{child.label.split(' ')[0].slice(0, 1)}</span>}
                  <span className="hidden sm:inline">{child.label}</span>
                  <span className="sm:hidden">{child.label.split(' ')[0]}</span>
                </NavLink>
              ))}
          </>
        ) : (
          <>
            {/* Left: small general links */}
            {topItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => itemClass(isActive || location.pathname === item.path)}
              >
                {iconByPath[item.path] ? iconByPath[item.path] : <span>{item.label.split(' ')[0]}</span>}
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}

            {/* Portal group for Colaborador */}
            {isColaborador && portalItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
                    <span className="font-medium">Portal</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {portalItems.map(i => (
                    <DropdownMenuItem key={i.path} onSelect={() => navigate(i.path)}>
                  <span className="flex items-center gap-2">
                    {iconByPath[i.path] ? iconByPath[i.path] : null}
                    {i.label}
                  </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Module groups */}
            {groups.map(g => (
              <DropdownMenu key={g.label}>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
                    {g.icon ? <g.icon className="h-4 w-4" /> : null}
                    <span className="font-medium">{g.label}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  {g.children.filter(canShowChild).map(child => (
                    <DropdownMenuItem
                      key={child.path}
                      onSelect={() => navigate(child.path)}
                      className={cn(
                        location.pathname.startsWith(child.path) && 'text-primary font-medium',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {iconByPath[child.path] ? iconByPath[child.path] : null}
                        {child.label}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </>
        )}
      </div>
    </nav>
  );
}

