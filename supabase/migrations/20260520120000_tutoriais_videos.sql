-- Tutoriais em vídeo (como utilizar a aplicação)
-- URLs: YouTube, Vimeo ou ficheiro MP4 público (Storage/CDN)

create table if not exists public.tutoriais_videos (
  id bigserial primary key,
  empresa_id bigint references public.empresas(id) on delete cascade,
  titulo text not null,
  descricao text not null default '',
  video_url text not null,
  video_provedor text not null default 'youtube'
    check (video_provedor in ('youtube', 'vimeo', 'url')),
  modulo_relacionado text,
  ordem int not null default 0,
  publicado boolean not null default true,
  duracao_minutos int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tutoriais_videos_publicado_ordem
  on public.tutoriais_videos (publicado, ordem desc, id desc);

create index if not exists idx_tutoriais_videos_empresa
  on public.tutoriais_videos (empresa_id)
  where empresa_id is not null;

create index if not exists idx_tutoriais_videos_modulo
  on public.tutoriais_videos (modulo_relacionado)
  where modulo_relacionado is not null and trim(modulo_relacionado) <> '';

alter table public.tutoriais_videos enable row level security;

-- Leitura: tutoriais publicados (globais ou da empresa do utilizador)
create policy "tutoriais_videos: read published"
  on public.tutoriais_videos for select
  using (
    publicado = true
    and (
      empresa_id is null
      or exists (
        select 1
        from public.profiles p
        where p.auth_user_id = auth.uid()
          and (
            (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
            or (p.empresa_id is not null and p.empresa_id = tutoriais_videos.empresa_id)
          )
      )
    )
  );

-- Admin vê rascunhos e todos os registos
create policy "tutoriais_videos: admin select all"
  on public.tutoriais_videos for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil = 'Admin'
    )
  );

create policy "tutoriais_videos: admin insert"
  on public.tutoriais_videos for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil = 'Admin'
    )
  );

create policy "tutoriais_videos: admin update"
  on public.tutoriais_videos for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil = 'Admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil = 'Admin'
    )
  );

create policy "tutoriais_videos: admin delete"
  on public.tutoriais_videos for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil = 'Admin'
    )
  );

comment on table public.tutoriais_videos is
  'Vídeos tutoriais da intranet (YouTube/Vimeo/URL). empresa_id NULL = visível em todas as empresas.';
