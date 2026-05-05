-- Nome de utilizador para login (Auth continua por email + password).

alter table public.profiles
  add column if not exists username text;

-- Backfill: parte local do email em minúsculas; em duplicados, sufixo _<id>.
update public.profiles p
set username = v.u
from (
  select
    s.id,
    case
      when s.base = '' then 'user_' || s.id::text
      when count(*) over (partition by s.base) > 1 then s.base || '_' || s.id::text
      else s.base
    end as u
  from (
    select
      id,
      lower(trim(split_part(coalesce(email, ''), '@', 1))) as base
    from public.profiles
  ) s
) v
where p.id = v.id;

update public.profiles
set username = 'user_' || id::text
where username is null or trim(username) = '';

alter table public.profiles
  alter column username set not null;

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(trim(username)));

comment on column public.profiles.username is 'Nome de utilizador único para login (Supabase Auth usa o email internamente).';

-- Resolver email antes do signInWithPassword; anon não tem SELECT em profiles via RLS.
create or replace function public.resolve_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where lower(trim(username)) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

comment on function public.resolve_login_email(text) is 'Devolve o email do perfil para o username indicado (login).';
