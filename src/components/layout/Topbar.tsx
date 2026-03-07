import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, ChevronRight, LogOut, User, Settings } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatRelative } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/chat': 'Chat interno',
  '/notificacoes': 'Notificações',
  '/capital-humano/colaboradores': 'Colaboradores',
  '/capital-humano/ferias': 'Gestão de Férias',
  '/capital-humano/faltas': 'Faltas & Efectividade',
  '/capital-humano/recibos': 'Recibos de Salário',
  '/capital-humano/declaracoes': 'Declarações',
  '/financas/requisicoes': 'Requisições',
  '/financas/centros-custo': 'Centros de Custo',
  '/financas/projectos': 'Projectos',
  '/financas/relatorios': 'Relatórios Financeiros',
  '/contabilidade/pagamentos': 'Pagamentos Recebidos',
  '/contabilidade/pendencias': 'Pendências Documentais',
  '/secretaria/reunioes': 'Reuniões',
  '/secretaria/actas': 'Actas',
  '/secretaria/documentos': 'Documentos Oficiais',
  '/secretaria/correspondencias': 'Correspondências',
  '/secretaria/arquivo': 'Arquivo Institucional',
  '/juridico/contratos': 'Contratos',
  '/juridico/processos': 'Processos Judiciais',
  '/juridico/prazos': 'Prazos Legais',
  '/juridico/riscos': 'Riscos Jurídicos',
  '/juridico/arquivo': 'Arquivo Documental',
  '/configuracoes': 'Configurações',
  '/configuracoes/utilizadores': 'Utilizadores',
  '/configuracoes/departamentos': 'Departamentos',
  '/portal/dados': 'Os Meus Dados',
  '/portal/ferias': 'As Minhas Férias',
  '/portal/faltas': 'As Minhas Faltas',
  '/portal/recibos': 'Os Meus Recibos',
  '/portal/declaracoes': 'As Minhas Declarações',
  '/portal/requisicoes': 'Requisição à Área Financeira',
  '/conselho-administracao': 'Painel do Conselho de Administração',
  '/conselho-administracao/decisoes': 'Decisões Institucionais',
  '/conselho-administracao/assinatura-actos': 'Assinatura Digital de Actos',
  '/conselho-administracao/saude-financeira': 'Saúde Financeira',
  '/conselho-administracao/actividade': 'Actividade Organizacional',
};

export function Topbar() {
  const { user, logout } = useAuth();
  const { getForProfile, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const title = routeTitles[location.pathname] || 'Dashboard';
  const breadcrumb = location.pathname.split('/').filter(Boolean);
  const notifs = getForProfile(user.perfil);
  const unread = unreadCount(user.perfil);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/80 bg-background/95 backdrop-blur-sm px-4 lg:px-6">
      {/* Left: Title + breadcrumb */}
      <div className="flex items-center gap-4 ml-12 lg:ml-0 min-w-0">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">{title}</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {breadcrumb.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 opacity-60" />}
                <span className="capitalize">{seg.replace(/-/g, ' ')}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Notifications + User */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground" aria-label="Notificações">
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
                <button onClick={() => markAllAsRead(user.perfil)} className="text-xs text-secondary hover:underline">
                  Marcar todas como lidas
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
                    onClick={() => { markAsRead(n.id); if (n.link) navigate(n.link); }}
                    className={cn(
                      "w-full text-left p-3 border-b last:border-0 hover:bg-muted/50 transition-colors",
                      !n.lida && "bg-muted/30"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn("mt-1 h-2 w-2 rounded-full shrink-0", {
                        "bg-info": n.tipo === 'info',
                        "bg-warning": n.tipo === 'alerta',
                        "bg-destructive": n.tipo === 'urgente',
                        "bg-success": n.tipo === 'sucesso',
                      })} />
                      <div>
                        <p className="text-sm font-medium">{n.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{formatRelative(n.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/80 transition-colors">
              <Avatar className="h-8 w-8 ring-1 ring-border/50">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {user.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left min-w-0">
                <p className="text-sm font-medium leading-none truncate">{user.nome}</p>
                <p className="text-xs text-muted-foreground truncate">{user.cargo}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate('/portal/dados')}>
              <User className="mr-2 h-4 w-4" />Ver Perfil
            </DropdownMenuItem>
            {user.perfil === 'Admin' && (
              <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                <Settings className="mr-2 h-4 w-4" />Configurações
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />Terminar Sessão
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
