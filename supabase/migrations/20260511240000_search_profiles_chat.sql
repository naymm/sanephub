-- Pesquisa de perfis para Chat / directório (autocomplete, sem carregar todos os utilizadores).
-- Requer extensão pg_trgm (já usada em search_colaboradores).

create extension if not exists pg_trgm;

create index if not exists idx_profiles_nome_trgm
  on public.profiles using gin (nome gin_trgm_ops);

create index if not exists idx_profiles_email_trgm
  on public.profiles using gin (lower(email) gin_trgm_ops);

create index if not exists idx_profiles_username_trgm
  on public.profiles using gin (lower(trim(username)) gin_trgm_ops)
  where username is not null and trim(username) <> '';

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
set search_path = public
as $$
declare
  v_q text;
  v_lim int;
  v_my_profile_id bigint;
  v_pattern text;
begin
  if auth.uid() is null then
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
  where p.auth_user_id = auth.uid()
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
    similarity(p.nome, v_q) desc nulls last,
    p.nome asc
  limit v_lim;
end $$;

revoke all on function public.search_profiles_chat(text, int) from public;
grant execute on function public.search_profiles_chat(text, int) to authenticated;

comment on function public.search_profiles_chat(text, int) is
  'Pesquisa perfis (id = profiles.id) para chat/selectores. Mínimo 4 caracteres; exclui o próprio utilizador.';
