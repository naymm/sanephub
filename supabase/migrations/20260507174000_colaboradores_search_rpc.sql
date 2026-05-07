-- =============================================================================
-- Colaboradores — pesquisa optimizada (autocomplete EmployeeSelect)
-- =============================================================================

-- Extensão para pesquisa eficiente por substring (ILIKE) com GIN trigram.
create extension if not exists pg_trgm;

create index if not exists idx_colaboradores_nome_trgm
  on public.colaboradores using gin (nome gin_trgm_ops);

-- RPC: pesquisa por nome dentro de uma empresa permitida ao utilizador.
-- Regras de permissão:
-- - Admin/PCA grupo (empresa_id null) pode pesquisar numa empresa especificada em p_empresa_id.
-- - Utilizador com empresa_id só pode pesquisar na sua própria empresa (p_empresa_id pode ser omitido ou igual).
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
set search_path = public
as $$
declare
  v_q text;
  v_limit int;
  v_empresa_id bigint;
  v_perfil text;
begin
  if auth.uid() is null then
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
  where p.auth_user_id = auth.uid()
  limit 1;

  -- contexto empresa: se o perfil tiver empresa_id, força; senão exige p_empresa_id
  if v_empresa_id is not null then
    if p_empresa_id is not null and p_empresa_id <> v_empresa_id then
      return;
    end if;
    v_empresa_id := v_empresa_id;
  else
    -- empresa_id null => perfil grupo; permitir apenas Admin/PCA
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
  order by similarity(c.nome, v_q) desc, c.nome asc
  limit v_limit;
end $$;

revoke all on function public.search_colaboradores(text, bigint, int) from public;
grant execute on function public.search_colaboradores(text, bigint, int) to authenticated;

comment on function public.search_colaboradores(text, bigint, int) is
  'Pesquisa colaboradores por nome (autocomplete). Requer >=4 caracteres. Limita resultados e valida empresa/perfil.';

