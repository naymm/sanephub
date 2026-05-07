-- =============================================================================
-- Produtividade — permitir "colegas" como participantes (role=collaborator)
-- - Colaborador (owner) pode adicionar colegas como 'collaborator'
-- - Apenas Admin/Director/PCA podem adicionar 'assignee'
-- =============================================================================

-- 1) Alargar enum de role
alter table public.produtividade_participantes
  drop constraint if exists produtividade_participantes_role_check;

alter table public.produtividade_participantes
  add constraint produtividade_participantes_role_check
  check (role in ('owner', 'assignee', 'collaborator'));

-- 2) Policy INSERT: combinar regras
drop policy if exists "produtividade_participantes: insert by admin director pca" on public.produtividade_participantes;

create policy "produtividade_participantes: insert collaborators or assignees"
  on public.produtividade_participantes for insert
  with check (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_participantes.actividade_id
        and (
          -- Admin/Director/PCA: podem atribuir (assignee) e adicionar colaboradores
          (
            p.perfil in ('Admin', 'Director', 'PCA')
            and (
              (p.empresa_id is not null and a.empresa_id = p.empresa_id)
              or (p.empresa_id is null and p.perfil in ('Admin', 'PCA'))
            )
          )
          -- Colaborador/qualquer owner: pode adicionar apenas colegas (role collaborator) na sua actividade
          or (
            a.colaborador_id = p.colaborador_id
            and public.produtividade_participantes.role = 'collaborator'
            and exists (
              select 1
              from public.colaboradores c
              where c.id = public.produtividade_participantes.colaborador_id
                and c.empresa_id = a.empresa_id
              limit 1
            )
          )
        )
    )
  );

