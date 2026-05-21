-- Activar Controlo Interno no pacote de módulos das empresas activas (menu intranet).

update public.empresas
set
  modulos_ativos = array_append(modulos_ativos, 'controlo-interno'),
  updated_at = now()
where
  activo = true
  and modulos_ativos is not null
  and not ('controlo-interno' = any (modulos_ativos));

-- Empresas sem lista explícita: pacote grupo completo (inclui controlo-interno)
update public.empresas
set
  modulos_ativos = array[
    'dashboard',
    'produtividade',
    'capital-humano',
    'financas',
    'contabilidade',
    'planeamento',
    'secretaria',
    'gestao-documentos',
    'patrimonio',
    'juridico',
    'controlo-interno',
    'conselho-administracao',
    'portal-colaborador',
    'comunicacao-interna'
  ]::text[],
  updated_at = now()
where activo = true and (modulos_ativos is null or cardinality(modulos_ativos) = 0);
