-- Corrige RLS de subcategorias: o WITH CHECK com JOIN às categorias podia falhar no INSERT.
-- Passa a usar o mesmo critério que patrimonio_activos (perfil + empresa da categoria pai).

drop policy if exists "patrimonio_subcategorias: tenant select" on public.patrimonio_subcategorias;
drop policy if exists "patrimonio_subcategorias: tenant insert" on public.patrimonio_subcategorias;
drop policy if exists "patrimonio_subcategorias: tenant update" on public.patrimonio_subcategorias;
drop policy if exists "patrimonio_subcategorias: tenant delete" on public.patrimonio_subcategorias;

create policy "patrimonio_subcategorias: tenant select"
  on public.patrimonio_subcategorias for select
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (
            p.empresa_id is not null
            and p.empresa_id = (
              select c.empresa_id from public.patrimonio_categorias c where c.id = categoria_id
            )
          )
        )
    )
  );

create policy "patrimonio_subcategorias: tenant insert"
  on public.patrimonio_subcategorias for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (
            p.empresa_id is not null
            and p.empresa_id = (
              select c.empresa_id from public.patrimonio_categorias c where c.id = categoria_id
            )
          )
        )
    )
  );

create policy "patrimonio_subcategorias: tenant update"
  on public.patrimonio_subcategorias for update
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (
            p.empresa_id is not null
            and p.empresa_id = (
              select c.empresa_id from public.patrimonio_categorias c where c.id = categoria_id
            )
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (
            p.empresa_id is not null
            and p.empresa_id = (
              select c.empresa_id from public.patrimonio_categorias c where c.id = categoria_id
            )
          )
        )
    )
  );

create policy "patrimonio_subcategorias: tenant delete"
  on public.patrimonio_subcategorias for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (
            p.empresa_id is not null
            and p.empresa_id = (
              select c.empresa_id from public.patrimonio_categorias c where c.id = categoria_id
            )
          )
        )
    )
  );
