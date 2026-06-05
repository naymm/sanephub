-- =============================================================================
-- search_colaboradores / search_profiles_chat — similarity() após pg_trgm em extensions
-- Erro remoto: function similarity(text, text) does not exist (search_path só public)
-- =============================================================================

create schema if not exists extensions;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute 'alter extension pg_trgm set schema extensions';
  else
    execute 'create extension pg_trgm with schema extensions';
  end if;
end $$;

create or replace function public.search_colaboradores(
  p_query text,
  p_empresa_id bigint default null,
  p_limit int default 20
)
returns table (
  id bigint,
  nome text,
  empresa_id bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_q text;
  v_limit int;
  v_empresa_id bigint;
  v_perfil text;
begin
  if (select auth.uid()) is null then
    return;
  end if;

  v_q := trim(coalesce(p_query, ''));
  if length(v_q) < 4 then
    return;
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 50));

  select p.empresa_id, p.perfil
  into v_empresa_id, v_perfil
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
  limit 1;

  if v_empresa_id is not null then
    if p_empresa_id is not null and p_empresa_id <> v_empresa_id then
      return;
    end if;
    v_empresa_id := v_empresa_id;
  else
    if v_perfil not in ('Admin', 'PCA') then
      return;
    end if;
    if p_empresa_id is null then
      return;
    end if;
    v_empresa_id := p_empresa_id;
  end if;

  return query
  select c.id, c.nome, c.empresa_id
  from public.colaboradores c
  where c.empresa_id = v_empresa_id
    and c.status = 'Activo'
    and c.nome ilike ('%' || v_q || '%')
  order by extensions.similarity(c.nome, v_q) desc, c.nome asc
  limit v_limit;
end $$;

create or replace function public.search_profiles_chat(
  p_query text,
  p_limit int default 20
)
returns table (
  id bigint,
  nome text,
  email text,
  empresa_id bigint,
  colaborador_id bigint,
  avatar text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_q text;
  v_lim int;
  v_my_profile_id bigint;
  v_pattern text;
begin
  if (select auth.uid()) is null then
    return;
  end if;

  v_q := trim(coalesce(p_query, ''));
  if length(v_q) < 4 then
    return;
  end if;

  v_lim := greatest(1, least(coalesce(p_limit, 20), 50));
  v_pattern := '%' || v_q || '%';

  select p.id
  into v_my_profile_id
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
  limit 1;

  if v_my_profile_id is null then
    return;
  end if;

  return query
  select
    p.id,
    p.nome,
    p.email,
    p.empresa_id,
    p.colaborador_id,
    coalesce(nullif(trim(p.avatar), ''), '?')::text as avatar
  from public.profiles p
  where p.id <> v_my_profile_id
    and (
      p.nome ilike v_pattern
      or p.email ilike v_pattern
      or (p.username is not null and trim(p.username) <> '' and p.username ilike v_pattern)
    )
  order by
    extensions.similarity(p.nome, v_q) desc nulls last,
    p.nome asc
  limit v_lim;
end $$;

revoke all on function public.search_colaboradores(text, bigint, int) from public;
grant execute on function public.search_colaboradores(text, bigint, int) to authenticated;

revoke all on function public.search_profiles_chat(text, int) from public;
grant execute on function public.search_profiles_chat(text, int) to authenticated;
