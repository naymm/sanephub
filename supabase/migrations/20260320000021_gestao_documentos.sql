-- =============================================================================
-- Módulo: Gestão Documental (pastas, ficheiros, permissões, auditoria)
-- Storage: bucket gestao-documentos (path: {empresa_id}/{object_path})
-- =============================================================================

-- Pastas hierárquicas por empresa
create table if not exists public.gestao_documentos_pastas (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete cascade,
  parent_id bigint references public.gestao_documentos_pastas (id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  constraint gestao_pastas_nome_parent unique (empresa_id, parent_id, nome)
);

create index if not exists idx_gestao_pastas_empresa on public.gestao_documentos_pastas (empresa_id);
create index if not exists idx_gestao_pastas_parent on public.gestao_documentos_pastas (parent_id);

comment on table public.gestao_documentos_pastas is 'Árvore de pastas para gestão documental por empresa.';

-- Metadados + permissões (arrays vazios = sem restrição nesse eixo)
create table if not exists public.gestao_documentos_arquivos (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete cascade,
  pasta_id bigint not null references public.gestao_documentos_pastas (id) on delete restrict,
  titulo text not null,
  observacao text not null default '',
  storage_path text not null,
  nome_ficheiro text not null,
  mime_type text not null default 'application/octet-stream',
  tamanho_bytes bigint not null default 0,
  tipo_ficheiro text not null default '',
  modulos_acesso text[] not null default '{}',
  sectores_acesso text[] not null default '{}',
  origem_modulo text,
  uploaded_by bigint references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gestao_arquivos_titulo_len check (char_length(trim(titulo)) >= 1)
);

create index if not exists idx_gestao_arquivos_empresa on public.gestao_documentos_arquivos (empresa_id);
create index if not exists idx_gestao_arquivos_pasta on public.gestao_documentos_arquivos (pasta_id);
create index if not exists idx_gestao_arquivos_created on public.gestao_documentos_arquivos (created_at desc);
create index if not exists idx_gestao_arquivos_uploaded_by on public.gestao_documentos_arquivos (uploaded_by);

comment on table public.gestao_documentos_arquivos is 'Documentos digitais centralizados; modulos_acesso/sectores_acesso vazios = visível a todo o tenant (com política).';

-- Auditoria: upload, visualização, download, eliminação
-- Sem FK a arquivos: evita CASCADE apagar o histórico quando o ficheiro é removido.
create table if not exists public.gestao_documentos_auditoria (
  id bigserial primary key,
  arquivo_id bigint not null,
  profile_id bigint references public.profiles (id) on delete set null,
  accao text not null check (accao in ('upload', 'view', 'download', 'delete')),
  detalhe jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_gestao_audit_arquivo on public.gestao_documentos_auditoria (arquivo_id);
create index if not exists idx_gestao_audit_created on public.gestao_documentos_auditoria (created_at desc);

-- Estrutura de pastas: Admin, PCA, Secretaria
create or replace function public.gestao_documentos_pode_gerir()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and (
        p.perfil = 'Admin'
        or (p.perfil = 'PCA' and p.empresa_id is null)
        or (p.perfil in ('PCA', 'Secretaria') and p.empresa_id is not null)
      )
  );
$$;

-- Carregar ficheiros: módulos que produzem documentação
create or replace function public.gestao_documentos_pode_carregar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and (
        p.perfil = 'Admin'
        or (p.perfil = 'PCA' and p.empresa_id is null)
        or (p.perfil in ('PCA', 'Secretaria', 'Financeiro', 'Juridico', 'RH', 'Contabilidade') and p.empresa_id is not null)
      )
  );
$$;

-- Leitura: tenant + (Admin/PCA grupo OU regras módulo/sector)
create or replace function public.gestao_documento_pode_ler(
  p_empresa_id bigint,
  p_modulos text[],
  p_sectores text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and (
        (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
        or (
          p.empresa_id is not null
          and p.empresa_id = p_empresa_id
          and (
            p.perfil in ('Admin', 'PCA', 'Secretaria', 'Director')
            or (
              cardinality(coalesce(p_modulos, '{}')) = 0
              or coalesce(p.modulos, '{}') && coalesce(p_modulos, '{}')
              or (
                p.modulos is null
                and (
                  ('financas' = any (coalesce(p_modulos, '{}')) and p.perfil in ('Financeiro'))
                  or ('contabilidade' = any (coalesce(p_modulos, '{}')) and p.perfil in ('Contabilidade', 'Financeiro'))
                  or ('capital-humano' = any (coalesce(p_modulos, '{}')) and p.perfil in ('RH'))
                  or ('juridico' = any (coalesce(p_modulos, '{}')) and p.perfil in ('Juridico'))
                  or ('secretaria' = any (coalesce(p_modulos, '{}')) and p.perfil in ('Secretaria'))
                  or ('planeamento' = any (coalesce(p_modulos, '{}')) and p.perfil in ('Planeamento'))
                  or ('comunicacao-interna' = any (coalesce(p_modulos, '{}')) and p.perfil not in ('Colaborador'))
                  or ('conselho-administracao' = any (coalesce(p_modulos, '{}')) and p.perfil in ('PCA'))
                )
              )
            )
            and (
              cardinality(coalesce(p_sectores, '{}')) = 0
              or nullif(trim(p.departamento), '') is null
              or trim(p.departamento) = any (select unnest(coalesce(p_sectores, '{}')))
            )
          )
        )
      )
  );
$$;

alter table public.gestao_documentos_pastas enable row level security;
alter table public.gestao_documentos_arquivos enable row level security;
alter table public.gestao_documentos_auditoria enable row level security;

-- Pastas: leitura por tenant
create policy "gestao_pastas: select tenant"
  on public.gestao_documentos_pastas for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and p.empresa_id = gestao_documentos_pastas.empresa_id)
        )
    )
  );

create policy "gestao_pastas: insert"
  on public.gestao_documentos_pastas for insert
  with check (
    public.gestao_documentos_pode_gerir()
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id = gestao_documentos_pastas.empresa_id)
        )
    )
  );

create policy "gestao_pastas: update"
  on public.gestao_documentos_pastas for update
  using (public.gestao_documentos_pode_gerir())
  with check (public.gestao_documentos_pode_gerir());

create policy "gestao_pastas: delete"
  on public.gestao_documentos_pastas for delete
  using (public.gestao_documentos_pode_gerir());

-- Arquivos
create policy "gestao_arquivos: select"
  on public.gestao_documentos_arquivos for select
  using (
    public.gestao_documento_pode_ler(
      gestao_documentos_arquivos.empresa_id,
      gestao_documentos_arquivos.modulos_acesso,
      gestao_documentos_arquivos.sectores_acesso
    )
  );

create policy "gestao_arquivos: insert"
  on public.gestao_documentos_arquivos for insert
  with check (
    public.gestao_documentos_pode_carregar()
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id = gestao_documentos_arquivos.empresa_id)
        )
    )
  );

create policy "gestao_arquivos: update"
  on public.gestao_documentos_arquivos for update
  using (public.gestao_documentos_pode_gerir())
  with check (public.gestao_documentos_pode_gerir());

create policy "gestao_arquivos: delete"
  on public.gestao_documentos_arquivos for delete
  using (public.gestao_documentos_pode_gerir());

-- Auditoria: inserir o próprio utilizador autenticado; ler quem pode ler o arquivo
create policy "gestao_audit: select"
  on public.gestao_documentos_auditoria for select
  using (
    public.gestao_documentos_pode_gerir()
    or exists (
      select 1
      from public.gestao_documentos_arquivos a
      where a.id = gestao_documentos_auditoria.arquivo_id
        and public.gestao_documento_pode_ler(a.empresa_id, a.modulos_acesso, a.sectores_acesso)
    )
  );

create policy "gestao_audit: insert"
  on public.gestao_documentos_auditoria for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.id = gestao_documentos_auditoria.profile_id
    )
  );

-- Bucket (URLs públicas como restantes buckets da app; path opaco)
insert into storage.buckets (id, name, public)
values ('gestao-documentos', 'gestao-documentos', true)
on conflict (id) do nothing;

create policy "gestao_docs_storage_select"
  on storage.objects for select
  using (bucket_id = 'gestao-documentos');

create policy "gestao_docs_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'gestao-documentos'
    and public.gestao_documentos_pode_carregar()
  );

create policy "gestao_docs_storage_update"
  on storage.objects for update
  using (bucket_id = 'gestao-documentos' and public.gestao_documentos_pode_carregar())
  with check (bucket_id = 'gestao-documentos');

create policy "gestao_docs_storage_delete"
  on storage.objects for delete
  using (bucket_id = 'gestao-documentos' and public.gestao_documentos_pode_gerir());

-- Pastas iniciais por empresa (exemplo da especificação)
do $$
declare
  e record;
  id_fin bigint;
  id_jur bigint;
  id_rh bigint;
begin
  for e in select id from public.empresas
  loop
    if exists (select 1 from public.gestao_documentos_pastas where empresa_id = e.id) then
      continue;
    end if;

    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem)
    values (e.id, null, 'Financeiro', 1)
    returning id into id_fin;
    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem) values
      (e.id, id_fin, 'Orçamentos', 1),
      (e.id, id_fin, 'Pagamentos', 2);

    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem)
    values (e.id, null, 'Jurídico', 2)
    returning id into id_jur;
    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem) values
      (e.id, id_jur, 'Contratos', 1),
      (e.id, id_jur, 'Processos', 2);

    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem)
    values (e.id, null, 'RH', 3)
    returning id into id_rh;
    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem) values
      (e.id, id_rh, 'Colaboradores', 1);

    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem) values
      (e.id, null, 'Finanças', 4),
      (e.id, null, 'Contabilidade', 5),
      (e.id, null, 'Planeamento', 6),
      (e.id, null, 'Comunicação Interna', 7),
      (e.id, null, 'Geral', 8);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gestao_documentos_arquivos'
  ) then
    alter publication supabase_realtime add table public.gestao_documentos_arquivos;
  end if;
end $$;
