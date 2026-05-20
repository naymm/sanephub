/** Módulos da intranet para categorizar tutoriais (filtro + formulário Admin). */
export const TUTORIAIS_MODULO_OPCOES: { value: string; label: string }[] = [
  { value: '', label: 'Geral / Introdução' },
  { value: 'dashboard', label: 'Dashboard e notificações' },
  { value: 'produtividade', label: 'Produtividade' },
  { value: 'capital-humano', label: 'Capital Humano' },
  { value: 'financas', label: 'Finanças' },
  { value: 'facturacao', label: 'Facturação' },
  { value: 'contabilidade', label: 'Contabilidade' },
  { value: 'planeamento', label: 'Planeamento' },
  { value: 'secretaria', label: 'Secretaria Geral' },
  { value: 'gestao-documentos', label: 'Gestão de Documentos' },
  { value: 'patrimonio', label: 'Património' },
  { value: 'juridico', label: 'Jurídico' },
  { value: 'comunicacao-interna', label: 'Comunicação interna' },
  { value: 'chat', label: 'Chat corporativo' },
  { value: 'configuracoes', label: 'Configurações' },
];

export function labelModuloTutorial(modulo: string | null | undefined): string {
  const v = (modulo ?? '').trim();
  if (!v) return 'Geral';
  return TUTORIAIS_MODULO_OPCOES.find(o => o.value === v)?.label ?? v;
}
