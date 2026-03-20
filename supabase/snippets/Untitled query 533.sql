
create policy "noticias_gostos: tenant delete"
  on public.noticias_gostos for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.id = public.noticias_gostos.autor_perfil_id
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.noticias_gostos.empresa_id = p.empresa_id)
        )
    )
  );
