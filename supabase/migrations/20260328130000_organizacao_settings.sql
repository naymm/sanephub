-- Definições globais do tenant: módulos e rotas desactivados pelo Admin (funcionalidades incompletas, etc.).

create table if not exists public.organizacao_settings (
  id smallint primary key default 1 constraint organizacao_settings_singleton check (id = 1),
  modulos_desactivados text[] not null default '{}',
  recursos_desactivados text[] not null default '{}',
  updated_at timestamptz not null default now()
);

comment on table public.organizacao_settings is
  'Linha única (id=1). Listas de módulos e de rotas (prefixos) ocultos em toda a organização.';

insert into public.organizacao_settings (id) values (1)
on conflict (id) do nothing;

alter table public.organizacao_settings enable row level security;

create policy "organizacao_settings_select_authenticated"
  on public.organizacao_settings for select
  to authenticated
  using (true);

create policy "organizacao_settings_insert_admin"
  on public.organizacao_settings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid() and p.perfil = 'Admin'
    )
  );

create policy "organizacao_settings_update_admin"
  on public.organizacao_settings for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid() and p.perfil = 'Admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid() and p.perfil = 'Admin'
    )
  );
