-- Tabela de perfis ligada ao Auth do Supabase.
-- Cada utilizador em auth.users deve ter uma linha aqui (criada por trigger ou ao registar).
-- RLS: utilizador só pode ler/atualizar o próprio perfil.

create table if not exists public.profiles (
  id bigserial primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  perfil text not null,
  cargo text default '',
  departamento text default '',
  avatar text default '?',
  permissoes text[] default '{}',
  modulos text[],
  colaborador_id bigint,
  empresa_id bigint,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(auth_user_id)
);

create index if not exists idx_profiles_auth_user_id on public.profiles(auth_user_id);

alter table public.profiles enable row level security;

create policy "Utilizador pode ler o próprio perfil"
  on public.profiles for select
  using (auth.uid() = auth_user_id);

create policy "Utilizador pode atualizar o próprio perfil"
  on public.profiles for update
  using (auth.uid() = auth_user_id);

-- Opcional: permitir que o service role (backend) insira/atualize qualquer perfil.
-- create policy "Service role full access" on public.profiles for all using (auth.role() = 'service_role');

-- Trigger para criar perfil quando um novo user se regista (opcional).
-- Requer que signup passe metadata: nome, perfil, empresa_id, etc.
-- create or replace function public.handle_new_user()
-- returns trigger as $$
-- begin
--   insert into public.profiles (auth_user_id, nome, email, perfil, empresa_id)
--   values (
--     new.id,
--     coalesce(new.raw_user_meta_data->>'nome', new.email),
--     new.email,
--     coalesce(new.raw_user_meta_data->>'perfil', 'Colaborador'),
--     (new.raw_user_meta_data->>'empresa_id')::bigint
--   );
--   return new;
-- end;
-- $$ language plpgsql security definer;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure public.handle_new_user();

comment on table public.profiles is 'Perfis de utilizador do SANEP (ligados a auth.users).';
