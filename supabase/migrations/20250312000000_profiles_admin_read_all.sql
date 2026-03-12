-- Permite que utilizadores com perfil Admin leiam todos os perfis (para a página Configurações > Utilizadores).
-- Usa uma função SECURITY DEFINER para evitar recursão na RLS (a policy não pode ler profiles com RLS ativo).

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
