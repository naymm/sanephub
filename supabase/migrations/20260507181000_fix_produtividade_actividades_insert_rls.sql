-- =============================================================================
-- Fix — RLS INSERT for produtividade_actividades
-- Erro: 42501 new row violates row-level security policy
-- Regra:
-- - Utilizador com colaborador associado pode criar actividade para si.
-- - Se profile.empresa_id != null: tem de coincidir com new.empresa_id.
-- - Se profile.empresa_id == null (grupo): permitir apenas Admin/PCA, mas ainda exige colaborador_id coerente.
-- =============================================================================

drop policy if exists "produtividade_actividades: insert own" on public.produtividade_actividades;
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
          (p.empresa_id is not null and public.produtividade_actividades.empresa_id = p.empresa_id)
          or (p.empresa_id is null and p.perfil in ('Admin', 'PCA'))
        )
    )
  );

