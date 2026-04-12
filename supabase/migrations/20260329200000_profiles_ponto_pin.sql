-- PIN de 4 dígitos para marcação de ponto (hash bcrypt; nunca expor em select * do cliente).
create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists ponto_pin_hash text;

comment on column public.profiles.ponto_pin_hash is 'bcrypt (pgcrypto) do PIN de 4 dígitos para ponto; usar apenas RPCs.';

create or replace function public._validar_pin_quatro_digitos(pin text)
returns boolean
language sql
immutable
security invoker
set search_path = public
as $$
  select pin is not null and char_length(pin) = 4 and pin ~ '^\d{4}$';
$$;

create or replace function public.perfil_tem_ponto_pin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select ponto_pin_hash is not null and char_length(trim(ponto_pin_hash)) > 0
      from public.profiles
      where auth_user_id = auth.uid()
      limit 1
    ),
    false
  );
$$;

-- Primeira definição (só quando ainda não existe PIN).
create or replace function public.definir_meu_ponto_pin(pin_plain text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tem boolean;
begin
  if not public._validar_pin_quatro_digitos(pin_plain) then
    raise exception 'PIN inválido: use exactamente 4 dígitos.';
  end if;
  select (ponto_pin_hash is not null and char_length(trim(ponto_pin_hash)) > 0)
  into v_tem
  from public.profiles
  where auth_user_id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado.';
  end if;
  if v_tem then
    raise exception 'Já tem um PIN definido. Utilize a opção para alterar o PIN.';
  end if;
  update public.profiles
  set
    ponto_pin_hash = crypt(pin_plain, gen_salt('bf', 8)),
    updated_at = now()
  where auth_user_id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado.';
  end if;
end;
$$;

create or replace function public.alterar_meu_ponto_pin(pin_atual text, pin_novo text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text;
begin
  if not public._validar_pin_quatro_digitos(pin_atual) or not public._validar_pin_quatro_digitos(pin_novo) then
    raise exception 'PIN inválido: use exactamente 4 dígitos.';
  end if;
  if pin_atual = pin_novo then
    raise exception 'O novo PIN tem de ser diferente do actual.';
  end if;
  select ponto_pin_hash into strict h from public.profiles where auth_user_id = auth.uid();
  if h is null or char_length(trim(h)) = 0 then
    raise exception 'Ainda não definiu um PIN. Use a definição inicial primeiro.';
  end if;
  if h <> crypt(pin_atual, h) then
    raise exception 'PIN actual incorreto.';
  end if;
  update public.profiles
  set
    ponto_pin_hash = crypt(pin_novo, gen_salt('bf', 8)),
    updated_at = now()
  where auth_user_id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado.';
  end if;
end;
$$;

create or replace function public.verificar_meu_ponto_pin(pin_plain text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (
      select
        p.ponto_pin_hash is not null
        and char_length(trim(p.ponto_pin_hash)) > 0
        and p.ponto_pin_hash = crypt(pin_plain, p.ponto_pin_hash)
      from public.profiles p
      where p.auth_user_id = auth.uid()
      limit 1
    ),
    false
  );
$$;

revoke execute on function public._validar_pin_quatro_digitos(text) from public;

grant execute on function public.perfil_tem_ponto_pin() to authenticated;
grant execute on function public.definir_meu_ponto_pin(text) to authenticated;
grant execute on function public.alterar_meu_ponto_pin(text, text) to authenticated;
grant execute on function public.verificar_meu_ponto_pin(text) to authenticated;
