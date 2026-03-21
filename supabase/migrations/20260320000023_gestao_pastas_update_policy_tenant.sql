-- UPDATE de pastas: alinhar a INSERT — exige que o perfil pertença ao tenant da pasta (Admin/PCA grupo ou mesma empresa).

drop policy if exists "gestao_pastas: update" on public.gestao_documentos_pastas;

create policy "gestao_pastas: update"
  on public.gestao_documentos_pastas for update
  using (
    public.gestao_documentos_pode_gerir()
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id = gestao_documentos_pastas.empresa_id)
        )
    )
  )
  with check (
    public.gestao_documentos_pode_gerir()
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
