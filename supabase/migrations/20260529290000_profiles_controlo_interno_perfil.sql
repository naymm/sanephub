-- Perfil ControloInterno: gestão completa no módulo Controlo Interno (RLS).

create or replace function public.fn_ci_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.perfil in ('Admin', 'PCA', 'Director', 'ControloInterno')
  );
$$;
