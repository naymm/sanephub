-- Ajuste de RLS: permitir que qualquer perfil do tenant (e Admin/PCA do grupo)
-- comente e responda nas notícias.

-- Drop e recria policies de INSERT/UPDATE/DELETE para simplificar a validação do autor.

drop policy if exists "noticias_comentarios: tenant insert" on public.noticias_comentarios;
create policy "noticias_comentarios: tenant insert"
  on public.noticias_comentarios for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          -- Admin/PCA (grupo) veem/inserem no nível grupo
          (p.perfil in ('Admin','PCA') and p.empresa_id is null and public.noticias_comentarios.empresa_id is not null)
          -- Perfis com empresa inserem apenas na sua empresa
          or (p.empresa_id is not null and public.noticias_comentarios.empresa_id = p.empresa_id)
        )
        and (
          -- Autor colaborador: aceita null ou bate com p.colaborador_id (se existir).
          public.noticias_comentarios.autor_colaborador_id is null
          or (p.colaborador_id is not null and public.noticias_comentarios.autor_colaborador_id = p.colaborador_id)
        )
    )
  );

drop policy if exists "noticias_comentarios: tenant update" on public.noticias_comentarios;
create policy "noticias_comentarios: tenant update"
  on public.noticias_comentarios for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null and public.noticias_comentarios.empresa_id is not null)
          or (p.empresa_id is not null and public.noticias_comentarios.empresa_id = p.empresa_id)
        )
        and (
          -- permitir atualizar o próprio comentário (quando autor_colaborador_id existir)
          public.noticias_comentarios.autor_colaborador_id is null
          or (p.colaborador_id is not null and public.noticias_comentarios.autor_colaborador_id = p.colaborador_id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null and public.noticias_comentarios.empresa_id is not null)
          or (p.empresa_id is not null and public.noticias_comentarios.empresa_id = p.empresa_id)
        )
    )
  );

drop policy if exists "noticias_comentarios: tenant delete" on public.noticias_comentarios;
create policy "noticias_comentarios: tenant delete"
  on public.noticias_comentarios for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null and public.noticias_comentarios.empresa_id is not null)
          or (p.empresa_id is not null and public.noticias_comentarios.empresa_id = p.empresa_id)
        )
        and (
          public.noticias_comentarios.autor_colaborador_id is null
          or (p.colaborador_id is not null and public.noticias_comentarios.autor_colaborador_id = p.colaborador_id)
        )
    )
  );

