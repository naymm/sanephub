-- Registo de leitura de comunicados por perfil (popup "marcar como lido" na intranet).

create table if not exists public.comunicado_leituras (
  comunicado_id bigint not null references public.comunicados (id) on delete cascade,
  profile_id bigint not null references public.profiles (id) on delete cascade,
  lido_em timestamptz not null default now(),
  primary key (comunicado_id, profile_id)
);

create index if not exists idx_comunicado_leituras_profile on public.comunicado_leituras (profile_id);

alter table public.comunicado_leituras enable row level security;

create policy "comunicado_leituras: select own"
  on public.comunicado_leituras for select
  using (
    profile_id = (select p.id from public.profiles p where p.auth_user_id = auth.uid())
  );

create policy "comunicado_leituras: insert own"
  on public.comunicado_leituras for insert
  with check (
    profile_id = (select p.id from public.profiles p where p.auth_user_id = auth.uid())
  );
