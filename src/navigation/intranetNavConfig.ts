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
} from 'lucide-react';
import { PORTAL_MENU_ITEMS } from '@/navigation/portalMenu';

export type MenuChild = {
  label: string;
  path: string;
  module?: string;
  adminOnly?: boolean;
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
];

export const MODULE_GROUPS: MenuGroup[] = [
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

export const PORTAL_ITEMS: MenuChild[] = [...PORTAL_MENU_ITEMS];
