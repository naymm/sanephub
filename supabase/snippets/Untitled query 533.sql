create policy "Admin pode apagar qualquer perfil"
  on public.profiles for delete
  to authenticated
  using (public.current_user_is_admin());