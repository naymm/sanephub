/** Módulos activos na empresa actual; null = sem restrição (ex. contexto consolidado). */
export function getModulosAtivosForContext(
  currentEmpresaId: 'consolidado' | number,
  empresas: { id: number; modulosAtivos?: string[] }[]
): string[] | null {
  if (currentEmpresaId === 'consolidado' || typeof currentEmpresaId !== 'number') return null;
  const emp = empresas.find(e => e.id === currentEmpresaId);
  return emp?.modulosAtivos ?? null;
}

/**
 * Verifica se o módulo está activo para a empresa.
 * `gestao-documentos` fica disponível também quando `secretaria` está na lista (retrocompatibilidade).
 */
export function empresaTemModuloActivado(modulosAtivos: string[] | null, moduleId: string): boolean {
  if (modulosAtivos == null) return true;
  if (modulosAtivos.includes(moduleId)) return true;
  if (moduleId === 'gestao-documentos' && modulosAtivos.includes('secretaria')) return true;
  return false;
}
