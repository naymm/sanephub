-- Permitir que colaboradores com cargo Director/Coordenador vejam actividades da sua área (departamento).
-- Implementado via função SECURITY DEFINER usada nas policies (evita recursão RLS).

create or replace function public.fn_produtividade_can_access_actividade(p_actividade_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_perfil text;
  v_empresa_id bigint;
  v_colab_id bigint;
  v_my_dept text;
  v_my_cargo text;
begin
  if auth.uid() is null then
    return false;
  end if;

  perform set_config('row_security', 'off', true);

  select perfil, empresa_id, colaborador_id
  into v_perfil, v_empresa_id, v_colab_id
  from public.fn_produtividade_current_profile();

  if v_colab_id is null and v_perfil is null then
    return false;
  end if;

  -- Admin/Director (perfil) de empresa: acesso a actividades da empresa
  if v_perfil in ('Admin', 'Director') and v_empresa_id is not null then
    return exists (
      select 1
      from public.produtividade_actividades a
      where a.id = p_actividade_id
        and a.empresa_id = v_empresa_id
      limit 1
    );
  end if;

  -- Participante: owner (colaborador_id na actividade) ou na tabela participantes
  if v_colab_id is not null then
    if exists (
      select 1
      from public.produtividade_actividades a
      where a.id = p_actividade_id
        and (
          a.colaborador_id = v_colab_id
          or exists (
            select 1
            from public.produtividade_participantes pp
            where pp.actividade_id = a.id
              and pp.colaborador_id = v_colab_id
            limit 1
          )
        )
      limit 1
    ) then
      return true;
    end if;

    -- Director/Coordenador (cargo) consegue ver actividades do mesmo departamento/área, na mesma empresa.
    select c.departamento, c.cargo
    into v_my_dept, v_my_cargo
    from public.colaboradores c
    where c.id = v_colab_id
    limit 1;

    if v_my_dept is not null
      and v_my_cargo is not null
      and (
        lower(v_my_cargo) like '%director%'
        or lower(v_my_cargo) like '%diretor%'
        or lower(v_my_cargo) like '%coordenador%'
      )
    then
      return exists (
        select 1
        from public.produtividade_actividades a
        join public.colaboradores c2 on c2.id = a.colaborador_id
        where a.id = p_actividade_id
          and a.empresa_id = c2.empresa_id
          and c2.empresa_id = (select c3.empresa_id from public.colaboradores c3 where c3.id = v_colab_id limit 1)
          and coalesce(c2.departamento, '') = coalesce(v_my_dept, '')
        limit 1
      );
    end if;
  end if;

  return false;
end $$;

revoke all on function public.fn_produtividade_can_access_actividade(bigint) from public;
grant execute on function public.fn_produtividade_can_access_actividade(bigint) to authenticated;

