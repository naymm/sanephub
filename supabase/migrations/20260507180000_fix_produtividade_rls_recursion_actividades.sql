-- =============================================================================
-- Fix — RLS recursion in produtividade_actividades (and related tables)
-- Motivo: policies cruzadas entre `produtividade_actividades` e `produtividade_participantes`
-- causavam recursão infinita (cada uma consultava a outra sob RLS).
-- Solução: funções SECURITY DEFINER com row_security=off e policies que não fazem
-- SELECT em tabelas protegidas por RLS que dependem de volta nesta policy.
-- =============================================================================

create or replace function public.fn_produtividade_current_profile()
returns table (
  perfil text,
  empresa_id bigint,
  colaborador_id bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select p.perfil, p.empresa_id, p.colaborador_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1
$$;

revoke all on function public.fn_produtividade_current_profile() from public;
grant execute on function public.fn_produtividade_current_profile() to authenticated;

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
begin
  if auth.uid() is null then
    return false;
  end if;

  -- evitar recursão RLS
  perform set_config('row_security', 'off', true);

  select perfil, empresa_id, colaborador_id
  into v_perfil, v_empresa_id, v_colab_id
  from public.fn_produtividade_current_profile();

  if v_colab_id is null and v_perfil is null then
    return false;
  end if;

  -- Admin/Director de empresa: acesso a actividades da empresa
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
  if v_colab_id is null then
    return false;
  end if;

  return exists (
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
  );
end $$;

revoke all on function public.fn_produtividade_can_access_actividade(bigint) from public;
grant execute on function public.fn_produtividade_can_access_actividade(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Recriar policies sem dependências cruzadas
-- ---------------------------------------------------------------------------

-- produtividade_actividades
drop policy if exists "produtividade_actividades: select participants or team" on public.produtividade_actividades;
drop policy if exists "produtividade_actividades: update participants or team" on public.produtividade_actividades;
drop policy if exists "produtividade_actividades: delete owner or team" on public.produtividade_actividades;

create policy "produtividade_actividades: select can_access"
  on public.produtividade_actividades for select
  using (public.fn_produtividade_can_access_actividade(public.produtividade_actividades.id));

create policy "produtividade_actividades: update can_access"
  on public.produtividade_actividades for update
  using (public.fn_produtividade_can_access_actividade(public.produtividade_actividades.id))
  with check (public.fn_produtividade_can_access_actividade(public.produtividade_actividades.id));

create policy "produtividade_actividades: delete owner or team"
  on public.produtividade_actividades for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          public.produtividade_actividades.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and public.produtividade_actividades.empresa_id = p.empresa_id
          )
        )
    )
  );

-- produtividade_participantes
drop policy if exists "produtividade_participantes: select participants or team" on public.produtividade_participantes;
drop policy if exists "produtividade_participantes: insert by owner or team" on public.produtividade_participantes;
drop policy if exists "produtividade_participantes: delete by owner or team" on public.produtividade_participantes;

create policy "produtividade_participantes: select by activity access"
  on public.produtividade_participantes for select
  using (public.fn_produtividade_can_access_actividade(public.produtividade_participantes.actividade_id));

create policy "produtividade_participantes: insert by owner or team"
  on public.produtividade_participantes for insert
  with check (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_participantes.actividade_id
        and (
          a.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_participantes: delete by owner or team"
  on public.produtividade_participantes for delete
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_participantes.actividade_id
        and (
          a.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

-- Tables that depend on actividade_id: use can_access function
drop policy if exists "produtividade_entregaveis: select participants or team" on public.produtividade_entregaveis;
drop policy if exists "produtividade_entregaveis: insert participants or team" on public.produtividade_entregaveis;
drop policy if exists "produtividade_entregaveis: update participants or team" on public.produtividade_entregaveis;
drop policy if exists "produtividade_entregaveis: delete participants or team" on public.produtividade_entregaveis;

create policy "produtividade_entregaveis: select can_access"
  on public.produtividade_entregaveis for select
  using (public.fn_produtividade_can_access_actividade(public.produtividade_entregaveis.actividade_id));

create policy "produtividade_entregaveis: insert can_access"
  on public.produtividade_entregaveis for insert
  with check (public.fn_produtividade_can_access_actividade(public.produtividade_entregaveis.actividade_id));

create policy "produtividade_entregaveis: update can_access"
  on public.produtividade_entregaveis for update
  using (public.fn_produtividade_can_access_actividade(public.produtividade_entregaveis.actividade_id))
  with check (public.fn_produtividade_can_access_actividade(public.produtividade_entregaveis.actividade_id));

create policy "produtividade_entregaveis: delete owner or team"
  on public.produtividade_entregaveis for delete
  using (public.fn_produtividade_can_access_actividade(public.produtividade_entregaveis.actividade_id));

drop policy if exists "produtividade_eventos: select own or team" on public.produtividade_eventos;
drop policy if exists "produtividade_eventos: insert own or team" on public.produtividade_eventos;

create policy "produtividade_eventos: select can_access"
  on public.produtividade_eventos for select
  using (public.fn_produtividade_can_access_actividade(public.produtividade_eventos.actividade_id));

create policy "produtividade_eventos: insert can_access"
  on public.produtividade_eventos for insert
  with check (public.fn_produtividade_can_access_actividade(public.produtividade_eventos.actividade_id));

drop policy if exists "produtividade_comentarios: select own or team" on public.produtividade_comentarios;
drop policy if exists "produtividade_comentarios: insert own or team" on public.produtividade_comentarios;

create policy "produtividade_comentarios: select can_access"
  on public.produtividade_comentarios for select
  using (public.fn_produtividade_can_access_actividade(public.produtividade_comentarios.actividade_id));

create policy "produtividade_comentarios: insert can_access"
  on public.produtividade_comentarios for insert
  with check (public.fn_produtividade_can_access_actividade(public.produtividade_comentarios.actividade_id));

