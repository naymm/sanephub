import { empresaTemModuloActivado } from '@/utils/empresaModulos';
import type { OrganizacaoSettings } from '@/types';

/** Nunca desactivar à escala global (acesso mínimo ao sistema e às definições). */
export const MODULOS_PROTEGIDOS_ORG = new Set(['dashboard', 'configuracoes']);

export function orgModuloEstaActivado(org: OrganizacaoSettings, moduleId: string): boolean {
  return !org.modulosDesactivados.includes(moduleId);
}

/** `pathname` corresponde a uma rota desactivada (exacto ou sub-rota). */
export function rotaBloqueadaPorRecursosDesactivados(pathname: string, recursosDesactivados: string[]): boolean {
  if (!recursosDesactivados.length) return false;
  const norm = pathname.replace(/\/$/, '') || '/';
  return recursosDesactivados.some(raw => {
    const base = (raw || '/').replace(/\/$/, '') || '/';
    return norm === base || norm.startsWith(base + '/');
  });
}

export function tenantPodeUsarModulo(
  modulosAtivosEmpresa: string[] | null,
  org: OrganizacaoSettings,
  moduleId: string,
): boolean {
  if (!orgModuloEstaActivado(org, moduleId)) return false;
  return empresaTemModuloActivado(modulosAtivosEmpresa, moduleId);
}

/** Módulos que o Admin pode desactivar globalmente em Configurações (ex.: ainda incompletos). */
export const MODULOS_DESACTIVAVEIS_PELA_ORG: { id: string; label: string }[] = [
  { id: 'capital-humano', label: 'Capital Humano' },
  { id: 'financas', label: 'Finanças' },
  { id: 'contabilidade', label: 'Contabilidade' },
  { id: 'planeamento', label: 'Planeamento' },
  { id: 'secretaria', label: 'Secretaria Geral' },
  { id: 'gestao-documentos', label: 'Gestão de Documentos' },
  { id: 'juridico', label: 'Jurídico' },
  { id: 'conselho-administracao', label: 'Conselho de Administração' },
  { id: 'portal-colaborador', label: 'Portal Colaborador' },
  { id: 'comunicacao-interna', label: 'Comunicação interna' },
];

/** Itens de menu não listados no agrupador horizontal (ex.: só na sidebar). */
export const RECURSOS_MENU_EXTRA: { path: string; label: string; moduleId: string; groupLabel: string }[] = [
  {
    path: '/conselho-administracao/empresas',
    label: 'Empresas do Grupo',
    moduleId: 'conselho-administracao',
    groupLabel: 'Conselho de Administração',
  },
];
