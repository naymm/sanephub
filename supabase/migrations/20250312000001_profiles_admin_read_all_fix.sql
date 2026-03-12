-- Corrige a policy "Admin pode ler todos os perfis" que causava 500 (recursão RLS).
-- Remove a policy antiga e usa uma função SECURITY DEFINER para verificar se o utilizador é Admin.

drop policy if exists "Admin pode ler todos os perfis" on public.profiles;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid() and perfil = 'Admin'
  );
$$;

create policy "Admin pode ler todos os perfis"
  on public.profiles for select
  to authenticated
  using (public.current_user_is_admin());
