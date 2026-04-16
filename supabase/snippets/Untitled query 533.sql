
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