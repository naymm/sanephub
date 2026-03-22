-- =============================================================================
-- Lista de utilizadores (Chat, selectores, etc.): utilizador autenticado pode ler
-- todos os perfis. As policies existentes continuam por OR (próprio perfil + Admin).
-- Sem isto, só Admin via «current_user_is_admin» vê mais do que uma linha.
-- =============================================================================

drop policy if exists "Autenticados podem listar perfis (directório interno)" on public.profiles;

create policy "Autenticados podem listar perfis (directório interno)"
  on public.profiles for select
  to authenticated
  using (auth.uid() is not null);

comment on policy "Autenticados podem listar perfis (directório interno)" on public.profiles is
  'Permite listar todos os perfis com sessão (chat, dropdowns). Dados já visíveis na intranet.';
