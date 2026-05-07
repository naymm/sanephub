-- =============================================================================
-- Produtividade — apenas Admin/Director/PCA podem atribuir (adicionar assignees)
-- =============================================================================

-- Policy de insert em produtividade_participantes:
-- - permite sempre o trigger inserir o owner (executa como owner, mas sob auth.uid() pode ser null em alguns contexts);
--   nesse caso, a inserção já é "idempotente" e não precisa de permissões do cliente.
-- - bloqueia UI/client para perfis fora da lista.

drop policy if exists "produtividade_participantes: insert by owner or team" on public.produtividade_participantes;

create policy "produtividade_participantes: insert by admin director pca"
  on public.produtividade_participantes for insert
  with check (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_participantes.actividade_id
        and p.perfil in ('Admin', 'Director', 'PCA')
        and (
          -- perfil com empresa => só dentro da empresa
          (p.empresa_id is not null and a.empresa_id = p.empresa_id)
          -- PCA/Admin grupo (empresa_id null) pode atribuir em qualquer empresa
          or (p.empresa_id is null and p.perfil in ('Admin', 'PCA'))
        )
    )
  );

