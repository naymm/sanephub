
create policy "contas_bancarias: financas delete"
  on public.contas_bancarias for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and public.profile_tem_modulo_financas(p.perfil, p.modulos)
        and (
          p.perfil = 'Admin'
          or (p.perfil = 'PCA' and p.empresa_id is null)
          or (
            p.empresa_id is not null
            and public.contas_bancarias.empresa_id = p.empresa_id
          )
        )
    )
  );