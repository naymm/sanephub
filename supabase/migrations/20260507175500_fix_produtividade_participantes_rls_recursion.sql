-- =============================================================================
-- Fix — RLS recursion in produtividade_participantes
-- Motivo: policy em `produtividade_participantes` fazia SELECT na própria tabela,
-- o que causa "infinite recursion detected in policy".
-- Solução: usar função SECURITY DEFINER com row_security=off para verificar membership.
-- =============================================================================

create or replace function public.fn_produtividade_is_participante(p_actividade_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cid bigint;
begin
  if auth.uid() is null then
    return false;
  end if;

  -- Evitar recursão de RLS ao consultar a tabela no corpo da função
  perform set_config('row_security', 'off', true);

  select p.colaborador_id into cid
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;

  if cid is null then
    return false;
  end if;

  return exists (
    select 1
    from public.produtividade_participantes pp
    where pp.actividade_id = p_actividade_id
      and pp.colaborador_id = cid
    limit 1
  );
end $$;

revoke all on function public.fn_produtividade_is_participante(bigint) from public;
grant execute on function public.fn_produtividade_is_participante(bigint) to authenticated;

-- Recriar policies sem auto-referência
drop policy if exists "produtividade_participantes: select own or team" on public.produtividade_participantes;
drop policy if exists "produtividade_participantes: insert by owner or team" on public.produtividade_participantes;
drop policy if exists "produtividade_participantes: delete by owner or team" on public.produtividade_participantes;

create policy "produtividade_participantes: select participants or team"
  on public.produtividade_participantes for select
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_participantes.actividade_id
        and (
          public.fn_produtividade_is_participante(a.id)
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_participantes: insert by owner or team"
  on public.produtividade_participantes for insert
  with check (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_participantes.actividade_id
        and (
          -- owner pode gerir participantes
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

