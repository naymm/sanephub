/** Módulos activos na empresa actual; null = sem restrição (ex. contexto consolidado). */
export function getModulosAtivosForContext(
  currentEmpresaId: 'consolidado' | number,
  empresas: { id: number; modulosAtivos?: string[] }[]
): string[] | null {
  if (currentEmpresaId === 'consolidado' || typeof currentEmpresaId !== 'number') return null;
  const emp = empresas.find(e => e.id === currentEmpresaId);
  return emp?.modulosAtivos ?? null;
}
