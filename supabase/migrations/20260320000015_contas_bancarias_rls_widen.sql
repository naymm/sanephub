-- =============================================================================
-- Corrige 403 em contas_bancarias: Admin com empresa_id preenchido a criar conta
-- para outra empresa (selector / vista consolidada), e perfil Contabilidade.
-- =============================================================================

drop policy if exists "contas_bancarias: financas insert" on public.contas_bancarias;
drop policy if exists "contas_bancarias: financas update" on public.contas_bancarias;
drop policy if exists "contas_bancarias: financas delete" on public.contas_bancarias;

-- INSERT: Admin (qualquer empresa_id no perfil) gere todas as contas;
-- PCA só nível grupo (empresa_id null); Financeiro/Contabilidade só da sua empresa.
create policy "contas_bancarias: financas insert"
  on public.contas_bancarias for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          p.perfil = 'Admin'
          or (p.perfil = 'PCA' and p.empresa_id is null)
          or (
            p.perfil in ('Financeiro', 'Contabilidade')
            and p.empresa_id is not null
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
        and (
          p.perfil = 'Admin'
          or (p.perfil = 'PCA' and p.empresa_id is null)
          or (
            p.perfil in ('Financeiro', 'Contabilidade')
            and p.empresa_id is not null
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
        and (
          p.perfil = 'Admin'
          or (p.perfil = 'PCA' and p.empresa_id is null)
          or (
            p.perfil in ('Financeiro', 'Contabilidade')
            and p.empresa_id is not null
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
        and (
          p.perfil = 'Admin'
          or (p.perfil = 'PCA' and p.empresa_id is null)
          or (
            p.perfil in ('Financeiro', 'Contabilidade')
            and p.empresa_id is not null
            and public.contas_bancarias.empresa_id = p.empresa_id
          )
        )
    )
  );
