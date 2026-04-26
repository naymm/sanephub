/** Itens do Portal Colaborador — barra horizontal, launcher e menu do avatar. */
export type PortalMenuItem = {
  label: string;
  path: string;
  module: string;
};

export const PORTAL_MENU_ITEMS: readonly PortalMenuItem[] = [
  { label: 'As Minhas Férias', path: '/portal/ferias', module: 'portal-colaborador' },
  { label: 'As Minhas Faltas', path: '/portal/faltas', module: 'portal-colaborador' },
  { label: 'Assiduidade (atrasos)', path: '/portal/assiduidade', module: 'portal-colaborador' },
  { label: 'Os Meus Recibos', path: '/portal/recibos', module: 'portal-colaborador' },
  { label: 'As Minhas Declarações', path: '/portal/declaracoes', module: 'portal-colaborador' },
  { label: 'Requisição à Área Financeira', path: '/portal/requisicoes', module: 'portal-colaborador' },
];

export function labelPortalMenuItem(
  item: Pick<PortalMenuItem, 'path' | 'label'>,
  modulos: string[] | undefined,
): string {
  if (item.path === '/portal/requisicoes' && modulos?.includes('financas')) return 'Requisição Finanças';
  return item.label;
}
