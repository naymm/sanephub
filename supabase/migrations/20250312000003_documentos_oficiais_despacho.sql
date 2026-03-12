-- Extensões para Despachos (Secretaria Geral) em documentos_oficiais
alter table public.documentos_oficiais
  add column if not exists empresa_id bigint references public.empresas(id),
  add column if not exists despacho_tipo text check (despacho_tipo in ('Nomeação', 'Exoneração', 'Outro')),
  add column if not exists colaborador_id bigint references public.colaboradores(id),
  add column if not exists tratamento text check (tratamento in ('Sr.', 'Sr(a).')),
  add column if not exists funcao text,
  add column if not exists direccao text,
  add column if not exists acumula_funcao boolean,
  add column if not exists numero_espaco_exoneracao text,
  add column if not exists pca_assinado boolean not null default false,
  add column if not exists pca_assinado_em date,
  add column if not exists pca_assinado_por text;

