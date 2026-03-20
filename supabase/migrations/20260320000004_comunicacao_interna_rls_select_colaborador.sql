-- Permitir que Colaboradores vejam Notícias e Eventos
-- (mantendo CRUD restrito a Admin/PCA).

-- 1) Notícias SELECT
drop policy if exists "noticias: tenant select" on public.noticias;

create policy "noticias: tenant select"
  on public.noticias for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          -- Admin/PCA no nível de grupo (sem empresa_id) vê tudo do grupo
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          -- Todos os perfis com empresa_id vêem apenas o seu tenant
          or (p.empresa_id is not null and public.noticias.empresa_id = p.empresa_id)
        )
    )
  );

-- 2) Eventos SELECT
drop policy if exists "eventos: tenant select" on public.eventos;

create policy "eventos: tenant select"
  on public.eventos for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          -- Admin/PCA no nível de grupo (sem empresa_id) vê tudo do grupo
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          -- Todos os perfis com empresa_id vêem apenas o seu tenant
          or (p.empresa_id is not null and public.eventos.empresa_id = p.empresa_id)
        )
    )
  );

