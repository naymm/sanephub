-- =============================================================================
-- GRUPO SANEP — Comunicação Interna
-- Tabelas: noticias, eventos
-- Multi-tenant via empresa_id + RLS (Admin/PCA grupo podem ver tudo)
-- =============================================================================

-- 1) Notícias
create table if not exists public.noticias (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  titulo text not null,
  conteudo text not null default '',
  imagem_url text,
  featured boolean not null default false,
  publicado boolean not null default false,
  publicado_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_noticias_empresa on public.noticias(empresa_id);
create index if not exists idx_noticias_publicado on public.noticias(publicado, empresa_id);
create index if not exists idx_noticias_publicado_em on public.noticias(publicado_em);

alter table public.noticias enable row level security;

-- Tenant select
create policy "noticias: tenant select"
  on public.noticias for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.noticias.empresa_id = p.empresa_id)
        )
    )
  );

-- Tenant insert
create policy "noticias: tenant insert"
  on public.noticias for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.noticias.empresa_id = p.empresa_id)
        )
    )
  );

-- Tenant update
create policy "noticias: tenant update"
  on public.noticias for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.noticias.empresa_id = p.empresa_id)
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
          or (p.empresa_id is not null and public.noticias.empresa_id = p.empresa_id)
        )
    )
  );

-- Tenant delete
create policy "noticias: tenant delete"
  on public.noticias for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.noticias.empresa_id = p.empresa_id)
        )
    )
  );

-- 2) Eventos
create table if not exists public.eventos (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  titulo text not null,
  descricao text not null default '',
  local text not null default '',
  data_inicio timestamptz not null,
  imagem_url text,
  is_interno boolean not null default true,
  alerta_antes_horas integer,
  alerta_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_eventos_empresa on public.eventos(empresa_id);
create index if not exists idx_eventos_data_inicio on public.eventos(data_inicio);

alter table public.eventos enable row level security;

create policy "eventos: tenant select"
  on public.eventos for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.eventos.empresa_id = p.empresa_id)
        )
    )
  );

create policy "eventos: tenant insert"
  on public.eventos for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.eventos.empresa_id = p.empresa_id)
        )
    )
  );

create policy "eventos: tenant update"
  on public.eventos for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.eventos.empresa_id = p.empresa_id)
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
          or (p.empresa_id is not null and public.eventos.empresa_id = p.empresa_id)
        )
    )
  );

create policy "eventos: tenant delete"
  on public.eventos for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.eventos.empresa_id = p.empresa_id)
        )
    )
  );

-- 3) Storage: buckets para imagens
insert into storage.buckets (id, name, public)
values ('noticias', 'noticias', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('eventos', 'eventos', true)
on conflict (id) do nothing;

-- Políticas bucket: qualquer utilizador autenticado (padrão do projecto)
create policy "noticias_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'noticias');

create policy "noticias_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'noticias');

create policy "noticias_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'noticias')
  with check (bucket_id = 'noticias');

create policy "noticias_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'noticias');

create policy "eventos_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'eventos');

create policy "eventos_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'eventos');

create policy "eventos_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'eventos')
  with check (bucket_id = 'eventos');

create policy "eventos_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'eventos');

