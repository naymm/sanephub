-- Permite que Admin actualize e apague qualquer perfil (CRUD completo em Configurações > Utilizadores).

create policy "Admin pode atualizar qualquer perfil"
  on public.profiles for update
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create policy "Admin pode apagar qualquer perfil"
  on public.profiles for delete
  to authenticated
  using (public.current_user_is_admin());
