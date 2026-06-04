import type React from 'react';
import {
  Users,
  Palmtree,
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
  Package,
  Receipt,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';
import { PORTAL_MENU_ITEMS } from '@/navigation/portalMenu';

export type MenuChild = {
  label: string;
  path: string;
  module?: string;
  adminOnly?: boolean;
  /** Se definido, só mostra para cargos específicos (match por substring, case-insensitive). */
  requiresCargoIncludes?: string[];
  /** Com `requiresCargoIncludes`, estes perfis vêem o item mesmo sem o cargo (ex.: Admin/PCA em Direcção). */
  showForPerfisWithoutCargo?: string[];
};

export type MenuGroup = {
  label: string;
  module?: string;
  children: MenuChild[];
  icon?: React.ComponentType<{ className?: string }>;
};

export const GENERAL_ITEMS: MenuChild[] = [
  { label: 'Dashboard', path: '/dashboard', module: 'dashboard' },
  { label: 'Notificações', path: '/notificacoes', module: 'dashboard' },
  { label: 'Tutoriais', path: '/ajuda/tutoriais', module: 'dashboard' },
];

export const MODULE_GROUPS: MenuGroup[] = [
  {
    label: 'Produtividade',
    module: 'produtividade',
    icon: ListChecks,
    children: [
      { label: 'Minhas Actividades', path: '/produtividade/actividades', module: 'produtividade' },
      { label: 'Aprovações', path: '/produtividade/aprovacoes', module: 'produtividade' },
      {
        label: 'Direcção',
        path: '/produtividade/direccao',
        module: 'produtividade',
        requiresCargoIncludes: ['director', 'diretor', 'coordenador'],
        showForPerfisWithoutCargo: ['Admin', 'PCA'],
      },
    ],
  },
  {
    label: 'Capital Humano',
    module: 'capital-humano',
    icon: Users,
    children: [
      { label: 'Colaboradores', path: '/capital-humano/colaboradores', module: 'capital-humano' },
      { label: 'Férias', path: '/capital-humano/ferias', module: 'capital-humano' },
      { label: 'Faltas', path: '/capital-humano/faltas', module: 'capital-humano' },
      { label: 'Assiduidade', path: '/capital-humano/assiduidade', module: 'capital-humano' },
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
      { label: 'Despesas', path: '/financas/despesas', module: 'financas' },
      { label: 'Bancos', path: '/financas/bancos', module: 'financas', adminOnly: true },
      { label: 'Contas bancárias', path: '/financas/contas-bancarias', module: 'financas' },
      { label: 'Tesouraria', path: '/financas/tesouraria', module: 'financas' },
      { label: 'Centros de Custo', path: '/financas/centros-custo', module: 'financas' },
      { label: 'Projectos', path: '/financas/projectos', module: 'financas' },
      { label: 'Relatórios', path: '/financas/relatorios', module: 'financas' },
    ],
  },
  {
    label: 'Facturação',
    module: 'facturacao',
    icon: Receipt,
    children: [{ label: 'Dashboard', path: '/facturacao', module: 'facturacao' }],
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
    children: [
      { label: 'Documentos', path: '/gestao-documentos', module: 'gestao-documentos' },
      { label: 'Normativos', path: '/gestao-documentos/normativos', module: 'gestao-documentos' },
      { label: 'Minutas', path: '/gestao-documentos/minutas', module: 'gestao-documentos' },
    ],
  },
  {
    label: 'Património',
    module: 'patrimonio',
    icon: Package,
    children: [{ label: 'Activos e verificação', path: '/patrimonio', module: 'patrimonio' }],
  },
  {
    label: 'Controlo Interno',
    module: 'controlo-interno',
    icon: ShieldCheck,
    children: [
      { label: 'Dashboard', path: '/controlo-interno', module: 'controlo-interno' },
      { label: 'Plano de Auditorias', path: '/controlo-interno/plano-auditorias', module: 'controlo-interno' },
      { label: 'Inspecções', path: '/controlo-interno/inspeccoes', module: 'controlo-interno' },
      { label: 'Execução', path: '/controlo-interno/execucao', module: 'controlo-interno' },
      { label: 'Não Conformidades', path: '/controlo-interno/nao-conformidades', module: 'controlo-interno' },
      { label: 'Plano de Acção', path: '/controlo-interno/plano-accao', module: 'controlo-interno' },
      { label: 'Riscos', path: '/controlo-interno/riscos', module: 'controlo-interno' },
      { label: 'Logs', path: '/controlo-interno/logs', module: 'controlo-interno' },
      { label: 'Relatórios', path: '/controlo-interno/relatorios', module: 'controlo-interno' },
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
    label: 'Comunicação Interna',
    module: 'comunicacao-interna',
    icon: Megaphone,
    children: [
      { label: 'Notícias', path: '/comunicacao-interna/noticias', module: 'comunicacao-interna' },
      { label: 'Eventos', path: '/comunicacao-interna/eventos', module: 'comunicacao-interna' },
      { label: 'Comunicados', path: '/comunicacao-interna/comunicados', module: 'comunicacao-interna' },
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

export const PORTAL_ITEMS: MenuChild[] = [...PORTAL_MENU_ITEMS];
