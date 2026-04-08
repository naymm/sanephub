/**
 * Módulos activos por defeito para todas as empresas do grupo SANEP (mesmo pacote que Sanep SGPS na intranet).
 * Mantém paridade de acessos e funcionalidades entre unidades. Administrador pode ajustar por empresa em Empresas do Grupo.
 */
export const MODULOS_ATIVOS_PADRAO_GRUPO: readonly string[] = [
  'dashboard',
  'capital-humano',
  'financas',
  'contabilidade',
  'planeamento',
  'secretaria',
  'gestao-documentos',
  'juridico',
  'conselho-administracao',
  'portal-colaborador',
  'comunicacao-interna',
];

/** Módulos activos na empresa actual; null = sem restrição (ex. contexto consolidado). */
export function getModulosAtivosForContext(
  currentEmpresaId: 'consolidado' | number,
  empresas: { id: number; modulosAtivos?: string[] }[]
): string[] | null {
  if (currentEmpresaId === 'consolidado' || typeof currentEmpresaId !== 'number') return null;
  const emp = empresas.find(e => e.id === currentEmpresaId);
  const raw = emp?.modulosAtivos;
  if (raw == null) return null;
  // Array vazio na BD: tratar como «não configurado», não como «nenhum módulo activo» (evita menu vazio).
  if (Array.isArray(raw) && raw.length === 0) return null;
  return raw;
}

/**
 * Verifica se o módulo está activo para a empresa.
 * `gestao-documentos` fica disponível também quando `secretaria` está na lista (retrocompatibilidade).
 */
export function empresaTemModuloActivado(modulosAtivos: string[] | null, moduleId: string): boolean {
  /** Comunicação interna é transversal; o desligue global fica em `organizacaoSettings.modulosDesactivados`. */
  if (moduleId === 'comunicacao-interna') return true;
  if (modulosAtivos == null) return true;
  if (modulosAtivos.includes(moduleId)) return true;
  if (moduleId === 'gestao-documentos' && modulosAtivos.includes('secretaria')) return true;
  return false;
}
