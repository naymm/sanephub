-- Pacote de módulos igual ao da operação Sanep SGPS para todas as empresas activas (paridade de acessos no grupo).
-- Administradores podem ajustar por empresa em Empresas do Grupo.

update public.empresas
set
  modulos_ativos = array[
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
    'comunicacao-interna'
  ]::text[],
  updated_at = now()
where activo = true;
