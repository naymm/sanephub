-- =============================================================================
-- GRUPO SANEP — Comunicação Interna: comunicados (feriados, RH, anexos PDF/DOC)
-- Multi-tenant via empresa_id + RLS (mesmo padrão de notícias/eventos)
-- =============================================================================

create table if not exists public.comunicados (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  titulo text not null,
  resumo text not null default '',
  conteudo text not null default '',
  tipo text not null default 'outro' check (
    tipo in (
      'feriado',
      'tolerancia_ponto',
      'situacao_interna',
      'nova_contratacao',
      'nomeacao',
      'exoneracao',
      'demissao',
      'outro'
    )
  ),
  anexo_url text,
  anexo_nome text,
  publicado_em timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_comunicados_empresa on public.comunicados(empresa_id);
create index if not exists idx_comunicados_publicado_em on public.comunicados(publicado_em desc);
create index if not exists idx_comunicados_tipo on public.comunicados(tipo);

alter table public.comunicados enable row level security;

create policy "comunicados: tenant select"
  on public.comunicados for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.comunicados.empresa_id = p.empresa_id)
        )
    )
  );

create policy "comunicados: tenant insert"
  on public.comunicados for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.comunicados.empresa_id = p.empresa_id)
        )
    )
  );

create policy "comunicados: tenant update"
  on public.comunicados for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.comunicados.empresa_id = p.empresa_id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.comunicados.empresa_id = p.empresa_id)
        )
    )
  );

create policy "comunicados: tenant delete"
  on public.comunicados for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.comunicados.empresa_id = p.empresa_id)
        )
    )
  );

-- Storage: anexos (PDF, DOC, etc.) — bucket público para leitura via URL
insert into storage.buckets (id, name, public)
values ('comunicados', 'comunicados', true)
on conflict (id) do nothing;

create policy "comunicados_storage_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'comunicados');

create policy "comunicados_storage_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'comunicados');

create policy "comunicados_storage_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'comunicados')
  with check (bucket_id = 'comunicados');

create policy "comunicados_storage_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'comunicados');

-- Realtime
do $$
declare
  t text := 'comunicados';
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = t
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = t
  ) then
    execute format('alter publication supabase_realtime add table public.%I', t);
  end if;
end $$;
