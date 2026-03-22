
create policy "gestao_pastas: insert"
  on public.gestao_documentos_pastas for insert
  with check (
    (
      public.gestao_documentos_pode_gerir()
      or public.gestao_documentos_pode_carregar()
    )
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id = gestao_documentos_pastas.empresa_id)
        )
    )
  );