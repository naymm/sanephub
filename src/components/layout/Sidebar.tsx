import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { getModulosAtivosForContext } from '@/utils/empresaModulos';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Bell, Users, Palmtree, CalendarX, Receipt, FileText, UserCircle,
  DollarSign, FileCheck, Building2, BarChart3, CreditCard, AlertTriangle, FileSearch,
  Calendar, BookOpen, Stamp, Mail, Archive, Scale, Gavel, Clock, ShieldAlert, FolderArchive,
  Settings, LogOut, ChevronDown, ChevronRight, Menu, X, Send, MessageCircle, Crown,   Target
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  module?: string;
  children?: { label: string; path: string; adminOnly?: boolean }[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', module: 'dashboard' },
  { label: 'Chat', icon: MessageCircle, path: '/chat', module: 'dashboard' },
  { label: 'Notificações', icon: Bell, path: '/notificacoes', module: 'dashboard' },
  {
    label: 'Capital Humano', icon: Users, module: 'capital-humano',
    children: [
      { label: 'Colaboradores', path: '/capital-humano/colaboradores' },
      { label: 'Férias', path: '/capital-humano/ferias' },
      { label: 'Faltas', path: '/capital-humano/faltas' },
      { label: 'Recibos de Salário', path: '/capital-humano/recibos' },
      { label: 'Declarações', path: '/capital-humano/declaracoes' },
    ]
  },
  {
    label: 'Finanças', icon: DollarSign, module: 'financas',
    children: [
      { label: 'Requisições', path: '/financas/requisicoes' },
      { label: 'Bancos', path: '/financas/bancos', adminOnly: true },
      { label: 'Contas bancárias', path: '/financas/contas-bancarias' },
      { label: 'Tesouraria', path: '/financas/tesouraria' },
      { label: 'Centros de Custo', path: '/financas/centros-custo' },
      { label: 'Projectos', path: '/financas/projectos' },
      { label: 'Relatórios', path: '/financas/relatorios' },
    ]
  },
  {
    label: 'Contabilidade', icon: BarChart3, module: 'contabilidade',
    children: [
      { label: 'Pagamentos Recebidos', path: '/contabilidade/pagamentos' },
      { label: 'Pendências', path: '/contabilidade/pendencias' },
    ]
  },
  {
    label: 'Secretaria Geral', icon: Stamp, module: 'secretaria',
    children: [
      { label: 'Reuniões', path: '/secretaria/reunioes' },
      { label: 'Actas', path: '/secretaria/actas' },
      { label: 'Documentos Oficiais', path: '/secretaria/documentos' },
      { label: 'Correspondências', path: '/secretaria/correspondencias' },
      { label: 'Arquivo', path: '/secretaria/arquivo' },
    ]
  },
  {
    label: 'Jurídico', icon: Scale, module: 'juridico',
    children: [
      { label: 'Contratos', path: '/juridico/contratos' },
      { label: 'Processos Judiciais', path: '/juridico/processos' },
      { label: 'Processos Disciplinares', path: '/juridico/processos-disciplinares' },
      { label: 'Prazos Legais', path: '/juridico/prazos' },
      { label: 'Riscos Jurídicos', path: '/juridico/riscos' },
      { label: 'Rescisões Contratuais', path: '/juridico/rescisoes' },
      { label: 'Arquivo Documental', path: '/juridico/arquivo' },
    ]
  },
  {
    label: 'Planeamento', icon: Target, module: 'planeamento',
    children: [
      { label: 'Relatórios Mensais', path: '/planeamento/relatorios' },
      { label: 'Consolidação', path: '/planeamento/consolidacao' },
      { label: 'Dashboard', path: '/planeamento/dashboard' },
    ]
  },
  {
    label: 'Conselho de Administração', icon: Crown, module: 'conselho-administracao',
    children: [
      { label: 'Painel Executivo', path: '/conselho-administracao' },
      { label: 'Empresas do Grupo', path: '/conselho-administracao/empresas' },
      { label: 'Decisões Institucionais', path: '/conselho-administracao/decisoes' },
      { label: 'Assinatura de Actos', path: '/conselho-administracao/assinatura-actos' },
      { label: 'Saúde Financeira', path: '/conselho-administracao/saude-financeira' },
      { label: 'Actividade Organizacional', path: '/conselho-administracao/actividade' },
    ]
  },
];

const COLABORADOR_ITEMS: NavItem[] = [
  { label: 'Os Meus Dados', icon: UserCircle, path: '/portal/dados', module: 'portal-colaborador' },
  { label: 'As Minhas Férias', icon: Palmtree, path: '/portal/ferias', module: 'portal-colaborador' },
  { label: 'As Minhas Faltas', icon: CalendarX, path: '/portal/faltas', module: 'portal-colaborador' },
  { label: 'Os Meus Recibos', icon: Receipt, path: '/portal/recibos', module: 'portal-colaborador' },
  { label: 'As Minhas Declarações', icon: FileText, path: '/portal/declaracoes', module: 'portal-colaborador' },
  { label: 'Requisição à Área Financeira', icon: Send, path: '/portal/requisicoes', module: 'portal-colaborador' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const { empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const { getUnreadCount: getChatUnread } = useChat();
  const location = useLocation();
  const chatUnread = getChatUnread();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [collapsedByUser, setCollapsedByUser] = useState<Set<string>>(() => new Set());
  const [mobileOpen, setMobileOpen] = useState(false);

  const modulosAtivos = getModulosAtivosForContext(currentEmpresaId, empresas);

  // Ao sair da secção, limpar "colapsado pelo utilizador" para o submenu reabrir quando voltar
  useEffect(() => {
    setCollapsedByUser(prev => {
      const next = new Set(prev);
      NAV_ITEMS.forEach(item => {
        if (!item.children) return;
        const active = item.children.some(c => location.pathname.startsWith(c.path));
        if (!active) next.delete(item.label);
      });
      return next;
    });
  }, [location.pathname]);

  if (!user) return null;

  const isColaborador = user.perfil === 'Colaborador';
  const items = isColaborador ? COLABORADOR_ITEMS : NAV_ITEMS;

  const canShowModule = (moduleId: string | undefined) => {
    if (!moduleId) return true;
    if (!hasModuleAccess(user, moduleId)) return false;
    if (modulosAtivos == null) return true;
    return modulosAtivos.includes(moduleId);
  };

  /** Módulos de área (Capital Humano, Finanças, etc.) a que o colaborador tem acesso para trabalhar */
  const workModules = isColaborador
    ? NAV_ITEMS.filter(
        (item): item is NavItem & { module: string; children?: { label: string; path: string }[] } =>
          item.module != null && item.children != null && canShowModule(item.module)
      )
    : [];

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => {
      const isExpanded = prev.includes(label);
      if (isExpanded) {
        setCollapsedByUser(c => new Set(c).add(label));
        return prev.filter(i => i !== label);
      }
      setCollapsedByUser(c => { const n = new Set(c); n.delete(label); return n; });
      return [...prev, label];
    });
  };

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (item: NavItem) =>
    item.children?.some(c => location.pathname.startsWith(c.path)) ?? false;

  const renderNavItem = (item: NavItem) => {
    if (item.module && !canShowModule(item.module)) return null;

    if (item.children) {
      const groupActive = isGroupActive(item);
      const userCollapsed = collapsedByUser.has(item.label);
      const expanded = !userCollapsed && (expandedItems.includes(item.label) || groupActive);
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleExpand(item.label)}
            className={cn("sidebar-item w-full", groupActive ? "sidebar-item-active" : "sidebar-item-inactive")}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          {expanded && (
            <div className="ml-7 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
              {item.children.filter(child => !child.adminOnly || user.perfil === 'Admin').map(child => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive(child.path)
                      ? "text-sidebar-accent-foreground font-medium bg-sidebar-accent"
                      : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-white/5"
                  )}
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      );
    }

    const isChat = item.path === '/chat';
    return (
      <NavLink
        key={item.path}
        to={item.path!}
        onClick={() => setMobileOpen(false)}
        className={cn("sidebar-item", isActive(item.path!) ? "sidebar-item-active" : "sidebar-item-inactive")}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
        {isChat && chatUnread > 0 && (
          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground px-1.5">
            {chatUnread > 99 ? '99+' : chatUnread}
          </span>
        )}
      </NavLink>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo — minimalista */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground font-semibold text-xs">
          GS
        </div>
        <div>
          <h1 className="text-sm font-semibold text-sidebar-primary tracking-tight">GRUPO SANEP</h1>
          <p className="text-[10px] text-sidebar-foreground/50">Sistema de Gestão</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {isColaborador ? (
          <>
            <p className="px-3 mb-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/45">Portal</p>
            {COLABORADOR_ITEMS.map(renderNavItem)}
            <p className="px-3 mt-6 mb-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/45">Geral</p>
            <NavLink to="/dashboard" onClick={() => setMobileOpen(false)} className={cn("sidebar-item", isActive('/dashboard') ? "sidebar-item-active" : "sidebar-item-inactive")}>
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/notificacoes" onClick={() => setMobileOpen(false)} className={cn("sidebar-item", isActive('/notificacoes') ? "sidebar-item-active" : "sidebar-item-inactive")}>
              <Bell className="h-4 w-4 shrink-0" />
              <span>Notificações</span>
            </NavLink>
            <NavLink to="/chat" onClick={() => setMobileOpen(false)} className={cn("sidebar-item", isActive('/chat') ? "sidebar-item-active" : "sidebar-item-inactive")}>
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span>Chat</span>
            </NavLink>
            {workModules.length > 0 && (
              <>
                <p className="px-3 mt-6 mb-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/45">Módulo de trabalho</p>
                {workModules.map(renderNavItem)}
              </>
            )}
          </>
        ) : (
          <>
            <p className="px-3 mb-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/45">Geral</p>
            {NAV_ITEMS.slice(0, 3).map(renderNavItem)}
            <p className="px-3 mt-6 mb-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/45">Módulos</p>
            {NAV_ITEMS.slice(2).map(renderNavItem)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-2 py-3 space-y-0.5">
        {user.perfil === 'Admin' && (
          <>
            <NavLink to="/configuracoes/utilizadores" className={cn("sidebar-item", isActive('/configuracoes/utilizadores') ? "sidebar-item-active" : "sidebar-item-inactive")}>
              <Users className="h-4 w-4" />
              <span>Utilizadores</span>
            </NavLink>
            <NavLink to="/configuracoes/departamentos" className={cn("sidebar-item", isActive('/configuracoes/departamentos') ? "sidebar-item-active" : "sidebar-item-inactive")}>
              <Building2 className="h-4 w-4" />
              <span>Departamentos</span>
            </NavLink>
            <NavLink to="/configuracoes" className={cn("sidebar-item", isActive('/configuracoes') ? "sidebar-item-active" : "sidebar-item-inactive")}>
              <Settings className="h-4 w-4" />
              <span>Configurações</span>
            </NavLink>
          </>
        )}
        <button onClick={logout} className="sidebar-item sidebar-item-inactive w-full text-destructive hover:text-destructive/80">
          <LogOut className="h-4 w-4" />
          <span>Terminar Sessão</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 lg:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-[280px] shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-sidebar-foreground/60 hover:text-sidebar-foreground"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[240px] shrink-0 h-screen sticky top-0 border-r border-sidebar-border">
        {sidebarContent}
      </aside>
    </>
  );
}
