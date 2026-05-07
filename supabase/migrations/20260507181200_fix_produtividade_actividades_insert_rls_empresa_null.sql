-- =============================================================================
-- Fix — RLS INSERT for produtividade_actividades quando profiles.empresa_id é null
-- Alguns perfis podem ter empresa_id null mas têm colaborador_id associado.
-- Nesses casos, validamos empresa via tabela colaboradores.
-- =============================================================================

drop policy if exists "produtividade_actividades: insert by self" on public.produtividade_actividades;

create policy "produtividade_actividades: insert by self"
  on public.produtividade_actividades for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.colaborador_id is not null
        and public.produtividade_actividades.colaborador_id = p.colaborador_id
        and (
          -- perfil com empresa definida: exigir match directo
          (p.empresa_id is not null and public.produtividade_actividades.empresa_id = p.empresa_id)
          -- perfil sem empresa definida mas com colaborador: validar empresa via colaboradores
          or (
            p.empresa_id is null
            and exists (
              select 1
              from public.colaboradores c
              where c.id = p.colaborador_id
                and c.empresa_id = public.produtividade_actividades.empresa_id
              limit 1
            )
          )
          -- perfil grupo: Admin/PCA
          or (p.empresa_id is null and p.perfil in ('Admin', 'PCA'))
        )
    )
  );

