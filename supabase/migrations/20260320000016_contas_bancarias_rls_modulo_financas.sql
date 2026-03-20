-- =============================================================================
-- contas_bancarias: INSERT/UPDATE/DELETE alinhado com hasModuleAccess(..., 'financas')
-- — Admin; ou lista modulos contém 'financas'; ou (sem modulos) perfil Financeiro.
-- Escopo empresa: Admin qualquer empresa; PCA grupo (empresa_id null) qualquer;
-- demais só linhas com empresa_id = perfil.empresa_id (empresa_id obrigatório).
-- =============================================================================

create or replace function public.profile_tem_modulo_financas(p_perfil text, p_modulos text[])
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    p_perfil = 'Admin'
    or (
      coalesce(cardinality(p_modulos), 0) > 0
      and 'financas' = any(p_modulos)
    )
    or (
      coalesce(cardinality(p_modulos), 0) = 0
      and p_perfil in ('Financeiro')
    );
$$;

comment on function public.profile_tem_modulo_financas(text, text[]) is
  'Espelha a app: acesso ao módulo financas (Admin; modulos com financas; ou perfil Financeiro se modulos vazio).';

grant execute on function public.profile_tem_modulo_financas(text, text[]) to authenticated;

drop policy if exists "contas_bancarias: financas insert" on public.contas_bancarias;
drop policy if exists "contas_bancarias: financas update" on public.contas_bancarias;
drop policy if exists "contas_bancarias: financas delete" on public.contas_bancarias;

create policy "contas_bancarias: financas insert"
  on public.contas_bancarias for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and public.profile_tem_modulo_financas(p.perfil, p.modulos)
        and (
          p.perfil = 'Admin'
          or (p.perfil = 'PCA' and p.empresa_id is null)
          or (
            p.empresa_id is not null
            and public.contas_bancarias.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "contas_bancarias: financas update"
  on public.contas_bancarias for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and public.profile_tem_modulo_financas(p.perfil, p.modulos)
        and (
          p.perfil = 'Admin'
          or (p.perfil = 'PCA' and p.empresa_id is null)
          or (
            p.empresa_id is not null
            and public.contas_bancarias.empresa_id = p.empresa_id
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and public.profile_tem_modulo_financas(p.perfil, p.modulos)
        and (
          p.perfil = 'Admin'
          or (p.perfil = 'PCA' and p.empresa_id is null)
          or (
            p.empresa_id is not null
            and public.contas_bancarias.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "contas_bancarias: financas delete"
  on public.contas_bancarias for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and public.profile_tem_modulo_financas(p.perfil, p.modulos)
        and (
          p.perfil = 'Admin'
          or (p.perfil = 'PCA' and p.empresa_id is null)
          or (
            p.empresa_id is not null
            and public.contas_bancarias.empresa_id = p.empresa_id
          )
        )
    )
  );
