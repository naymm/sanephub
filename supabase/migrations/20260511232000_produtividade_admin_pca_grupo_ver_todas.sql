-- Admin / PCA com profiles.empresa_id nulo (nível grupo) podem ler todas as actividades de produtividade (todas as empresas).

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
  v_my_cargo text;
  v_my_empresa_id bigint;
  v_my_dept text;
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

  if v_perfil in ('Admin', 'PCA') and v_empresa_id is null then
    return exists (
      select 1
      from public.produtividade_actividades a
      where a.id = p_actividade_id
      limit 1
    );
  end if;

  if v_perfil in ('Admin', 'Director', 'PCA') and v_empresa_id is not null then
    return exists (
      select 1
      from public.produtividade_actividades a
      where a.id = p_actividade_id
        and a.empresa_id = v_empresa_id
      limit 1
    );
  end if;

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

    if exists (
      select 1
      from public.produtividade_actividades a
      where a.id = p_actividade_id
        and a.aprovador_colaborador_id = v_colab_id
        and a.status = 'Em aprovação'
      limit 1
    ) then
      return true;
    end if;

    select c.cargo, c.empresa_id, trim(coalesce(c.departamento, ''))
    into v_my_cargo, v_my_empresa_id, v_my_dept
    from public.colaboradores c
    where c.id = v_colab_id
    limit 1;

    if v_my_empresa_id is not null
      and v_my_cargo is not null
      and (
        lower(v_my_cargo) like '%director%'
        or lower(v_my_cargo) like '%diretor%'
        or lower(v_my_cargo) like '%coordenador%'
      )
    then
      if v_my_empresa_id = 1 then
        if v_my_dept = '' then
          return false;
        end if;

        return exists (
          select 1
          from public.produtividade_actividades a
          where a.id = p_actividade_id
            and a.empresa_id = v_my_empresa_id
            and (
              exists (
                select 1
                from public.colaboradores c_own
                where c_own.id = a.colaborador_id
                  and lower(trim(coalesce(c_own.departamento, ''))) = lower(trim(v_my_dept))
                limit 1
              )
              or exists (
                select 1
                from public.produtividade_participantes pp
                join public.colaboradores c_pt on c_pt.id = pp.colaborador_id
                where pp.actividade_id = a.id
                  and lower(trim(coalesce(c_pt.departamento, ''))) = lower(trim(v_my_dept))
                limit 1
              )
            )
          limit 1
        );
      end if;

      return exists (
        select 1
        from public.produtividade_actividades a
        where a.id = p_actividade_id
          and a.empresa_id = v_my_empresa_id
        limit 1
      );
    end if;
  end if;

  return false;
end $$;

revoke all on function public.fn_produtividade_can_access_actividade(bigint) from public;
grant execute on function public.fn_produtividade_can_access_actividade(bigint) to authenticated;
