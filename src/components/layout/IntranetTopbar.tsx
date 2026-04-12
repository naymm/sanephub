import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { PORTAL_MENU_ITEMS, labelPortalMenuItem } from '@/navigation/portalMenu';
import { PORTAL_PATH_ICONS } from '@/navigation/portalMenuIcons';
import { useTenant } from '@/context/TenantContext';
import { useData } from '@/context/DataContext';
import { useNotifications } from '@/context/NotificationContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Cake,
  CalendarDays,
  Crown,
  DollarSign,
  FileText,
  FolderArchive,
  LayoutGrid,
  Layers,
  LogOut,
  Megaphone,
  MessageCircle,
  Palmtree,
  Scale,
  Search,
  Settings,
  Stamp,
  Target,
  User,
  UserCircle,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { formatRelative } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { NotificationAudienceOptions } from '@/context/NotificationContext';
import { getModulosAtivosForContext, empresaTemModuloActivado } from '@/utils/empresaModulos';
import { orgModuloEstaActivado, rotaBloqueadaPorRecursosDesactivados } from '@/utils/orgFeatureAccess';
import { useMemo, useState } from 'react';

const iconBtnClass =
  'flex min-h-11 min-w-11 md:min-h-9 md:min-w-9 items-center justify-center rounded-xl transition-colors shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 max-md:text-white/90 max-md:hover:bg-white/12 max-md:hover:text-white';

export function IntranetTopbar() {
  const { user, logout } = useAuth();
  const { currentEmpresaId, setCurrentEmpresaId, isGroupLevel } = useTenant();
  const { empresas, organizacaoSettings } = useData();
  const { getForProfile, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  if (!user) return null;

  const notifAudience: NotificationAudienceOptions | undefined =
    user.perfil === 'Colaborador' ? { colaboradorId: user.colaboradorId } : undefined;
  const notifs = getForProfile(user.perfil, notifAudience);
  const unread = unreadCount(user.perfil, notifAudience);

  const hasPortalColaborador = user.perfil === 'Colaborador' && Array.isArray(user.modulos) && user.modulos.includes('portal-colaborador');
  const hasAnyNonPortalModule =
    hasPortalColaborador && Array.isArray(user.modulos) && user.modulos.some(m => m !== 'portal-colaborador');

  const [appsOpen, setAppsOpen] = useState(false);
  const [selectedPrincipalModuleId, setSelectedPrincipalModuleId] = useState<string | null>(null);

  const modulosAtivos = useMemo(() => {
    return getModulosAtivosForContext(currentEmpresaId, empresas);
  }, [currentEmpresaId, empresas]);

  const canShowModule = (moduleId?: string) => {
    if (!moduleId) return true;
    if (!orgModuloEstaActivado(organizacaoSettings, moduleId)) return false;
    if (!hasModuleAccess(user, moduleId)) return false;
    if (user.perfil === 'Colaborador') return true;
    if (modulosAtivos == null) return true;
    return empresaTemModuloActivado(modulosAtivos, moduleId);
  };

  const principalModules = useMemo(() => {
    const modules: Array<{
      moduleId: string;
      label: string;
      icon: JSX.Element;
    }> = [
      ...(canShowModule('portal-colaborador') && user.perfil !== 'Colaborador'
        ? [{ moduleId: 'portal-colaborador', label: 'Portal Colaborador', icon: <UserCircle className="h-4 w-4" /> }]
        : []),
      { moduleId: 'capital-humano', label: 'Capital Humano', icon: <Users className="h-4 w-4" /> },
      { moduleId: 'financas', label: 'Finanças', icon: <DollarSign className="h-4 w-4" /> },
      { moduleId: 'contabilidade', label: 'Contabilidade', icon: <FileText className="h-4 w-4" /> },
      { moduleId: 'secretaria', label: 'Secretaria Geral', icon: <Stamp className="h-4 w-4" /> },
      { moduleId: 'gestao-documentos', label: 'Gestão documental', icon: <FolderArchive className="h-4 w-4" /> },
      { moduleId: 'juridico', label: 'Jurídico', icon: <Scale className="h-4 w-4" /> },
      { moduleId: 'planeamento', label: 'Planeamento', icon: <Target className="h-4 w-4" /> },
    ];

    return modules.filter(m => canShowModule(m.moduleId));
  }, [canShowModule, organizacaoSettings, user.perfil]);

  const moduleItems = useMemo(() => {
    const items: Record<
      string,
      Array<{
        key: string;
        label: string;
        path: string;
      }>
    > = {
      'portal-colaborador': [
        { key: 'portal-dados', label: 'Os Meus Dados', path: '/portal/dados' },
        ...PORTAL_MENU_ITEMS.map((item) => ({
          key: `portal-${item.path.replace(/\//g, '-')}`,
          label: labelPortalMenuItem(item, user.modulos),
          path: item.path,
        })),
      ],
      'capital-humano': [
        { key: 'capital-humano-colaboradores', label: 'Colaboradores', path: '/capital-humano/colaboradores' },
        { key: 'capital-humano-faltas', label: 'Faltas', path: '/capital-humano/faltas' },
        { key: 'capital-humano-ferias', label: 'Férias', path: '/capital-humano/ferias' },
        { key: 'capital-humano-recibos', label: 'Recibos', path: '/capital-humano/recibos' },
        { key: 'capital-humano-processamento-salarial', label: 'Processamento Salarial', path: '/capital-humano/processamento-salarial' },
        { key: 'capital-humano-declaracoes', label: 'Declarações', path: '/capital-humano/declaracoes' },
        { key: 'capital-humano-marcacoes', label: 'Marcações de ponto', path: '/capital-humano/marcacoes-ponto' },
        { key: 'capital-humano-zonas', label: 'Zonas de trabalho', path: '/capital-humano/zonas-trabalho' },
      ],
      financas: [
        { key: 'financas-requisicoes', label: 'Requisições', path: '/financas/requisicoes' },
        ...(user.perfil === 'Admin' ? [{ key: 'financas-bancos', label: 'Bancos', path: '/financas/bancos' }] : []),
        { key: 'financas-contas-bancarias', label: 'Contas bancárias', path: '/financas/contas-bancarias' },
        { key: 'financas-tesouraria', label: 'Tesouraria', path: '/financas/tesouraria' },
        { key: 'financas-centros-custo', label: 'Centros de Custo', path: '/financas/centros-custo' },
        { key: 'financas-projectos', label: 'Projectos', path: '/financas/projectos' },
        { key: 'financas-relatorios', label: 'Relatórios', path: '/financas/relatorios' },
      ],
      contabilidade: [
        { key: 'contabilidade-pagamentos', label: 'Pagamentos Recebidos', path: '/contabilidade/pagamentos' },
        { key: 'contabilidade-pendencias', label: 'Pendências', path: '/contabilidade/pendencias' },
      ],
      secretaria: [
        { key: 'secretaria-reunioes', label: 'Reuniões', path: '/secretaria/reunioes' },
        { key: 'secretaria-actas', label: 'Actas', path: '/secretaria/actas' },
        { key: 'secretaria-documentos', label: 'Documentos Oficiais', path: '/secretaria/documentos' },
        { key: 'secretaria-correspondencias', label: 'Correspondências', path: '/secretaria/correspondencias' },
        { key: 'secretaria-arquivo', label: 'Arquivo', path: '/secretaria/arquivo' },
      ],
      'gestao-documentos': [
        { key: 'gestao-documentos-main', label: 'Documentos', path: '/gestao-documentos' },
      ],
      juridico: [
        { key: 'juridico-contratos', label: 'Contratos', path: '/juridico/contratos' },
        { key: 'juridico-processos', label: 'Processos Judiciais', path: '/juridico/processos' },
        { key: 'juridico-processos-disciplinares', label: 'Processos Disciplinares', path: '/juridico/processos-disciplinares' },
        { key: 'juridico-prazos', label: 'Prazos', path: '/juridico/prazos' },
        { key: 'juridico-riscos', label: 'Riscos', path: '/juridico/riscos' },
        { key: 'juridico-rescisoes', label: 'Rescisões', path: '/juridico/rescisoes' },
        { key: 'juridico-arquivo', label: 'Arquivo Documental', path: '/juridico/arquivo' },
      ],
      planeamento: [
        { key: 'planeamento-relatorios', label: 'Relatórios', path: '/planeamento/relatorios' },
        { key: 'planeamento-consolidacao', label: 'Consolidação', path: '/planeamento/consolidacao' },
        { key: 'planeamento-dashboard', label: 'Dashboard', path: '/planeamento/dashboard' },
      ],
    };

    return items;
  }, [user.perfil, user.modulos]);

  const selectedPrincipalModuleLabel = useMemo(() => {
    if (!selectedPrincipalModuleId) return '';
    return principalModules.find(m => m.moduleId === selectedPrincipalModuleId)?.label ?? '';
  }, [principalModules, selectedPrincipalModuleId]);

  return (
    <>
      <header
        className={cn(
          'z-30 w-full border-b border-border/80 bg-[#1C1C1C] backdrop-blur-sm max-md:border-border/40 max-md:bg-gradient-to-br max-md:from-[hsl(var(--navy))] max-md:to-[hsl(var(--navy-lighter))]',
          'pt-[env(safe-area-inset-top,0px)]',
          /* Fixo no viewport: mobile (notch) e desktop (scroll) */
          'fixed left-0 right-0 top-0',
        )}
      >
      <div className="mx-auto flex h-16 items-center justify-between gap-2 sm:gap-3 px-3 sm:px-6 lg:px-8 min-w-0 max-w-full">
        {/* Left: apps + logo (menu completo na barra inferior «Mais» em mobile) */}
        <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1 md:flex-initial">
          {/* Apps launcher icon */}
          <Popover
            open={appsOpen}
            onOpenChange={(open) => {
              setAppsOpen(open);
              if (!open) setSelectedPrincipalModuleId(null);
            }}
          >
            <PopoverTrigger asChild>
              <button
                className={iconBtnClass}
                aria-label="Abrir módulos"
                title="Módulos"
                onClick={() => setSelectedPrincipalModuleId(null)}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[min(100vw-1.5rem,440px)] max-w-[calc(100vw-1.5rem)] p-4 bg-[#1C1C1C] text-white border border-border/80"
            >
              {selectedPrincipalModuleId == null ? (
                <>
                  <div className="mb-3 font-semibold">Módulos</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1">
                    {principalModules.map(m => (
                      <button
                        key={m.moduleId}
                        onClick={() => setSelectedPrincipalModuleId(m.moduleId)}
                        className={cn(
                          'flex flex-col items-start gap-2 rounded-xl px-3 py-2 text-left border border-border/60 bg-background/10 hover:bg-background/20 transition-colors',
                        )}
                      >
                        <span className="text-white/90">{m.icon}</span>
                        <span className="text-xs font-medium truncate text-white/90">{m.label}</span>
                      </button>
                    ))}
                  </div>
                  {principalModules.length === 0 && (
                    <div className="mt-3 text-sm text-white/70">Sem módulos disponíveis.</div>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedPrincipalModuleId(null)}
                      className="text-sm text-white/80 hover:text-white px-2 py-1 rounded-lg hover:bg-background/10 transition-colors"
                      aria-label="Voltar"
                    >
                      Voltar
                    </button>
                    <div className="font-semibold">{selectedPrincipalModuleLabel}</div>
                  </div>
                  <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                    {(moduleItems[selectedPrincipalModuleId] ?? [])
                      .filter(
                        i =>
                          !rotaBloqueadaPorRecursosDesactivados(
                            i.path,
                            organizacaoSettings.recursosDesactivados,
                          ),
                      )
                      .map(i => (
                      <button
                        key={i.key}
                        onClick={() => {
                          navigate(i.path);
                          setAppsOpen(false);
                          setSelectedPrincipalModuleId(null);
                        }}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left border border-border/60 bg-background/10 hover:bg-background/20 transition-colors',
                        )}
                      >
                        <span className="text-sm font-medium text-white/90">{i.label}</span>
                      </button>
                    ))}
                    {(moduleItems[selectedPrincipalModuleId] ?? []).filter(
                      i =>
                        !rotaBloqueadaPorRecursosDesactivados(
                          i.path,
                          organizacaoSettings.recursosDesactivados,
                        ),
                    ).length === 0 && (
                      <div className="mt-1 text-sm text-white/70">Sem itens neste módulo.</div>
                    )}
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={() => {
              setAppsOpen(false);
              setSelectedPrincipalModuleId(null);
              navigate('/dashboard');
            }}
            className="flex h-11 min-h-11 md:h-12 w-[7.5rem] sm:w-36 items-center justify-center rounded-xl bg-transparent shrink-0 min-w-0 overflow-hidden transition-colors"
            aria-label="Ir para Dashboard"
            title="Dashboard"
          >
            <img
              src="/logo-white.png"
              alt="GRUPO SANEP"
              className="h-8 sm:h-[40px] w-full max-w-[140px] sm:max-w-[160px] object-contain object-left"
            />
          </button>
        </div>

        {/* Center: Search */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Busca" placeholder="Buscar..." className="pl-9" onKeyDown={(e) => {
              // Sem endpoint de search global: Enter não faz nada (mantém UX sem quebrar lógica).
              if (e.key === 'Enter') e.preventDefault();
            }} />
          </div>
        </div>

        {/* Right: Notifications + Settings + Avatar */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`${iconBtnClass} relative`}
                aria-label="Notificações"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {unread}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-semibold text-sm">Notificações</h3>
                {unread > 0 && (
                  <button
                    onClick={() => markAllAsRead(user.perfil, notifAudience)}
                    className="text-xs text-secondary hover:underline"
                  >
                    Limpar todas
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">Sem notificações</p>
                ) : (
                  notifs.slice(0, 10).map(n => (
                    <button
                      key={n.id}
                      onClick={() => {
                        markAsRead(n.id);
                        if (n.link) navigate(n.link);
                      }}
                      className={cn(
                        'w-full text-left p-3 border-b last:border-0 hover:bg-muted/50 transition-colors',
                        !n.lida && 'bg-muted/30',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={cn('mt-1 h-2 w-2 rounded-full shrink-0', {
                            'bg-info': n.tipo === 'info',
                            'bg-warning': n.tipo === 'alerta',
                            'bg-destructive': n.tipo === 'urgente',
                            'bg-success': n.tipo === 'sucesso',
                          })}
                        />
                        <div>
                          <p className="text-sm font-medium">{n.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {formatRelative(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Settings / Troca de empresa (Group-level) */}
          {isGroupLevel && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={iconBtnClass}
                  aria-label="Opções"
                  title="Opções"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem disabled>
                  Selecionar Empresa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setCurrentEmpresaId('consolidado')}>
                  Visão consolidada (Grupo)
                </DropdownMenuItem>
                {empresas.filter(e => e.activo).map(e => (
                  <DropdownMenuItem key={e.id} onSelect={() => setCurrentEmpresaId(e.id)}>
                    {e.codigo} — {e.nome}
                  </DropdownMenuItem>
                ))}
                {user.perfil === 'Admin' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => navigate('/conselho-administracao/empresas')}>
                      <Crown className="mr-2 h-4 w-4" />
                      Empresas do Grupo
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate('/configuracoes/utilizadores')}>
                      <Users className="mr-2 h-4 w-4" />
                      Utilizadores
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate('/configuracoes/modulos-recursos')}>
                      <Layers className="mr-2 h-4 w-4" />
                      Módulos e recursos
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => navigate('/configuracoes')}>
                      Configurações
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile: ecrã Conta; desktop: menu dropdown */}
          <Link
            to="/perfil"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl px-1.5 py-1.5 transition-colors hover:bg-white/12 md:hidden"
            aria-label="Abrir conta e perfil"
          >
            <Avatar className="h-9 w-9 ring-1 ring-white/25">
              <AvatarFallback className="bg-white/15 text-xs font-medium text-white">{user.avatar}</AvatarFallback>
            </Avatar>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hidden min-h-9 min-w-min items-center justify-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/80 md:flex">
                <Avatar className="h-9 w-9 ring-1 ring-border/50">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{user.avatar}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[13rem] w-56">
              <DropdownMenuItem onClick={() => navigate('/portal/dados')}>
                <User className="mr-2 h-4 w-4" />
                Ver Perfil
              </DropdownMenuItem>

              {canShowModule('portal-colaborador') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Portal
                  </DropdownMenuLabel>
                  {PORTAL_MENU_ITEMS.filter(
                    item =>
                      !rotaBloqueadaPorRecursosDesactivados(item.path, organizacaoSettings.recursosDesactivados),
                  ).map(item => {
                    const Icon = PORTAL_PATH_ICONS[item.path] ?? FileText;
                    return (
                      <DropdownMenuItem key={item.path} onSelect={() => navigate(item.path)}>
                        <Icon className="mr-2 h-4 w-4" />
                        {labelPortalMenuItem(item, user.modulos)}
                      </DropdownMenuItem>
                    );
                  })}
                </>
              )}

              {hasPortalColaborador && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate('/comunicacao-interna/noticias')}>
                    <Megaphone className="mr-2 h-4 w-4" />
                    Notícias
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/comunicacao-interna/eventos')}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Eventos
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/comunicacao-interna/aniversarios')}>
                    <Cake className="mr-2 h-4 w-4" />
                    Aniversariantes
                  </DropdownMenuItem>
                </>
              )}
              {user.perfil === 'Admin' && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/configuracoes/modulos-recursos')}>
                    <Layers className="mr-2 h-4 w-4" />
                    Módulos e recursos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Terminar Sessão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
      {/* Reserva altura quando o header é fixed (mobile); em md+ o header continua no fluxo */}
      <div
        className="max-md:h-[calc(4rem+env(safe-area-inset-top,0px))] max-md:shrink-0 md:hidden"
        aria-hidden
      />
    </>
  );
}

