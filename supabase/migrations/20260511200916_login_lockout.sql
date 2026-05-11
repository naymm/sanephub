-- =============================================================================
-- Login: 3 tentativas → bloqueio automático; desbloqueio apenas por Admin
-- =============================================================================

alter table public.profiles
  add column if not exists login_failed_attempts int not null default 0
    constraint profiles_login_failed_attempts_ck check (login_failed_attempts >= 0);

alter table public.profiles
  add column if not exists login_locked_at timestamptz null;

alter table public.profiles
  add column if not exists login_lock_reason text null;

alter table public.profiles
  add column if not exists login_unlocked_at timestamptz null;

alter table public.profiles
  add column if not exists login_unlocked_by_auth_uid uuid null;

create index if not exists idx_profiles_email_lower_trim
  on public.profiles (lower(trim(email)));

comment on column public.profiles.login_failed_attempts is
  'Número de tentativas falhadas consecutivas no login (reset quando o Admin desbloqueia).';
comment on column public.profiles.login_locked_at is
  'Se não for null, a conta está bloqueada e só Admin pode desbloquear.';

-- 1) Pre-check: bloquear antes do signInWithPassword (evita gastar tentativas no Auth).
create or replace function public.auth_login_is_blocked(p_identifier text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with i as (
    select lower(trim(coalesce(p_identifier,''))) as v
  )
  select exists (
    select 1
    from public.profiles p, i
    where (lower(trim(p.email)) = i.v or lower(trim(p.username)) = i.v)
      and p.login_locked_at is not null
    limit 1
  );
$$;

revoke all on function public.auth_login_is_blocked(text) from public;
grant execute on function public.auth_login_is_blocked(text) to anon, authenticated;

-- 2) Registar falha: incrementa e bloqueia ao atingir 3.
create or replace function public.auth_login_register_failure(p_identifier text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v text := lower(trim(coalesce(p_identifier,'')));
begin
  if v = '' then
    return;
  end if;

  update public.profiles p
     set login_failed_attempts =
           case
             when p.login_locked_at is null then coalesce(p.login_failed_attempts, 0) + 1
             else p.login_failed_attempts
           end,
         login_locked_at =
           case
             when p.login_locked_at is null and (coalesce(p.login_failed_attempts, 0) + 1) >= 3 then now()
             else p.login_locked_at
           end,
         login_lock_reason =
           case
             when p.login_locked_at is null and (coalesce(p.login_failed_attempts, 0) + 1) >= 3 then 'too_many_attempts'
             else p.login_lock_reason
           end,
         updated_at = now()
   where (lower(trim(p.email)) = v or lower(trim(p.username)) = v);
end;
$$;

revoke all on function public.auth_login_register_failure(text) from public;
grant execute on function public.auth_login_register_failure(text) to anon, authenticated;

-- 3) Registar sucesso: apenas limpa contador se NÃO estiver bloqueado.
create or replace function public.auth_login_register_success(p_auth_user_id uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.profiles p
     set login_failed_attempts = 0,
         updated_at = now()
   where p.auth_user_id = p_auth_user_id
     and p.login_locked_at is null;
$$;

revoke all on function public.auth_login_register_success(uuid) from public;
grant execute on function public.auth_login_register_success(uuid) to authenticated;

-- 4) Admin unlock.
create or replace function public.admin_unlock_login(p_profile_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_admin_auth() then
    raise exception 'Apenas administradores podem desbloquear contas.';
  end if;

  update public.profiles
     set login_failed_attempts = 0,
         login_locked_at = null,
         login_lock_reason = null,
         login_unlocked_at = now(),
         login_unlocked_by_auth_uid = auth.uid(),
         updated_at = now()
   where id = p_profile_id;
end;
$$;

revoke all on function public.admin_unlock_login(bigint) from public;
grant execute on function public.admin_unlock_login(bigint) to authenticated;

