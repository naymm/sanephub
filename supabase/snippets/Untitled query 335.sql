create policy "organizacao_settings_update_admin"
  on public.organizacao_settings for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid() and p.perfil = 'Admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid() and p.perfil = 'Admin'
    )
  );