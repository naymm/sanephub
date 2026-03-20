-- =============================================================================
-- GRUPO SANEP — Comunicação Interna
-- Ajuste de permissões (RLS): CRUD apenas para Admin/PCA
-- =============================================================================

-- Noticias: ajustar INSERT/UPDATE/DELETE
drop policy if exists "noticias: tenant insert" on public.noticias;
drop policy if exists "noticias: tenant update" on public.noticias;
drop policy if exists "noticias: tenant delete" on public.noticias;

create policy "noticias: tenant insert"
  on public.noticias for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil in ('Admin','PCA')
        and (
          p.empresa_id is null
          or public.noticias.empresa_id = p.empresa_id
        )
    )
  );

create policy "noticias: tenant update"
  on public.noticias for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil in ('Admin','PCA')
        and (
          p.empresa_id is null
          or public.noticias.empresa_id = p.empresa_id
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil in ('Admin','PCA')
        and (
          p.empresa_id is null
          or public.noticias.empresa_id = p.empresa_id
        )
    )
  );

create policy "noticias: tenant delete"
  on public.noticias for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil in ('Admin','PCA')
        and (
          p.empresa_id is null
          or public.noticias.empresa_id = p.empresa_id
        )
    )
  );

-- Eventos: ajustar INSERT/UPDATE/DELETE
drop policy if exists "eventos: tenant insert" on public.eventos;
drop policy if exists "eventos: tenant update" on public.eventos;
drop policy if exists "eventos: tenant delete" on public.eventos;

create policy "eventos: tenant insert"
  on public.eventos for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil in ('Admin','PCA')
        and (
          p.empresa_id is null
          or public.eventos.empresa_id = p.empresa_id
        )
    )
  );

create policy "eventos: tenant update"
  on public.eventos for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil in ('Admin','PCA')
        and (
          p.empresa_id is null
          or public.eventos.empresa_id = p.empresa_id
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil in ('Admin','PCA')
        and (
          p.empresa_id is null
          or public.eventos.empresa_id = p.empresa_id
        )
    )
  );

create policy "eventos: tenant delete"
  on public.eventos for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil in ('Admin','PCA')
        and (
          p.empresa_id is null
          or public.eventos.empresa_id = p.empresa_id
        )
    )
  );

