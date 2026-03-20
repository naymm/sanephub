import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type React from 'react';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { getModulosAtivosForContext } from '@/utils/empresaModulos';
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
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type MenuChild = { label: string; path: string; module?: string };
type MenuGroup = { label: string; module?: string; children: MenuChild[]; icon?: React.ComponentType<{ className?: string }> };

const GENERAL_ITEMS: MenuChild[] = [
  { label: 'Dashboard', path: '/dashboard', module: 'dashboard' },
  { label: 'Chat', path: '/chat', module: 'dashboard' },
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
      { label: 'Declarações', path: '/capital-humano/declaracoes', module: 'capital-humano' },
    ],
  },
  {
    label: 'Finanças',
    module: 'financas',
    icon: DollarSign,
    children: [
      { label: 'Requisições', path: '/financas/requisicoes', module: 'financas' },
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
    label: 'Conselho de Administração',
    module: 'conselho-administracao',
    icon: Crown,
    children: [
      { label: 'Painel Executivo', path: '/conselho-administracao', module: 'conselho-administracao' },
      { label: 'Empresas do Grupo', path: '/conselho-administracao/empresas', module: 'conselho-administracao' },
      { label: 'Decisões Institucionais', path: '/conselho-administracao/decisoes', module: 'conselho-administracao' },
      { label: 'Assinatura de Actos', path: '/conselho-administracao/assinatura-actos', module: 'conselho-administracao' },
      { label: 'Saúde Financeira', path: '/conselho-administracao/saude-financeira', module: 'conselho-administracao' },
      { label: 'Actividade Organizacional', path: '/conselho-administracao/actividade', module: 'conselho-administracao' },
    ],
  },
];

const PORTAL_ITEMS: MenuChild[] = [
  { label: 'Os Meus Dados', path: '/portal/dados', module: 'portal-colaborador' },
  { label: 'As Minhas Férias', path: '/portal/ferias', module: 'portal-colaborador' },
  { label: 'As Minhas Faltas', path: '/portal/faltas', module: 'portal-colaborador' },
  { label: 'Os Meus Recibos', path: '/portal/recibos', module: 'portal-colaborador' },
  { label: 'As Minhas Declarações', path: '/portal/declaracoes', module: 'portal-colaborador' },
  { label: 'Requisição à Área Financeira', path: '/portal/requisicoes', module: 'portal-colaborador' },
];

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
    if (!hasModuleAccess(user, moduleId)) return false;
    if (modulosAtivos == null) return true;
    return modulosAtivos.includes(moduleId);
  };

  const isColaborador = user.perfil === 'Colaborador';

  const topItems = GENERAL_ITEMS.filter(i => canShowModule(i.module));
  const portalItems = PORTAL_ITEMS.filter(i => canShowModule(i.module));
  const groups = MODULE_GROUPS.filter(g => canShowModule(g.module));

  // Ícones fixos para alguns itens; para outros usamos o rótulo.
  const iconByPath: Record<string, React.ReactNode> = {
    '/dashboard': <span className="text-[11px] font-bold">D</span>,
    '/chat': <MessageCircle className="h-4 w-4" />,
    '/notificacoes': <Bell className="h-4 w-4" />,
    '/portal/ferias': <Palmtree className="h-4 w-4" />,
    '/portal/declaracoes': <FileText className="h-4 w-4" />,
  };

  const itemClass = (active: boolean) =>
    cn(
      'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors whitespace-nowrap',
      active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    );

  return (
    <nav className="sticky z-20 top-16 bg-background/95 backdrop-blur-sm border-b border-border/80">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 h-[52px] flex items-center gap-2 overflow-x-auto">
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
                  {i.label}
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
              {g.children.map(child => (
                <DropdownMenuItem
                  key={child.path}
                  onSelect={() => navigate(child.path)}
                  className={cn(
                    location.pathname.startsWith(child.path) && 'text-primary font-medium',
                  )}
                >
                  {child.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>
    </nav>
  );
}

