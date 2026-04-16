create policy "comunicado_leituras: insert own"
  on public.comunicado_leituras for insert
  with check (
    profile_id = (select p.id from public.profiles p where p.auth_user_id = auth.uid())
  );