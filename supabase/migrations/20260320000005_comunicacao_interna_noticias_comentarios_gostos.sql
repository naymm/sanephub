-- Comunicação Interna — Comentários e “gostos” nas Notícias
-- Multi-tenant via empresa_id e RLS.

-- 1) Comentários
create table if not exists public.noticias_comentarios (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  noticia_id bigint not null references public.noticias(id) on delete cascade,

  autor_texto text not null,
  autor_colaborador_id bigint references public.colaboradores(id) on delete set null,

  conteudo text not null,
  parent_comentario_id bigint references public.noticias_comentarios(id) on delete cascade,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_noticias_comentarios_noticia on public.noticias_comentarios(noticia_id);
create index if not exists idx_noticias_comentarios_parent on public.noticias_comentarios(parent_comentario_id);
create index if not exists idx_noticias_comentarios_empresa on public.noticias_comentarios(empresa_id);

alter table public.noticias_comentarios enable row level security;

-- SELECT (qualquer perfil do tenant ou Admin/PCA do grupo)
drop policy if exists "noticias_comentarios: tenant select" on public.noticias_comentarios;
create policy "noticias_comentarios: tenant select"
  on public.noticias_comentarios for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.noticias_comentarios.empresa_id = p.empresa_id)
        )
    )
  );

-- INSERT (Colaborador cria comentários; Admin/PCA cria também)
drop policy if exists "noticias_comentarios: tenant insert" on public.noticias_comentarios;
create policy "noticias_comentarios: tenant insert"
  on public.noticias_comentarios for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (
            p.perfil in ('Admin','PCA')
            and p.empresa_id is null
          )
          or (
            p.empresa_id is not null
            and public.noticias_comentarios.empresa_id = p.empresa_id
            and exists (
              select 1 from public.noticias n
              where n.id = public.noticias_comentarios.noticia_id
                and n.empresa_id = public.noticias_comentarios.empresa_id
            )
            and (
              -- Colaborador deve ser o autor
              (p.perfil = 'Colaborador' and public.noticias_comentarios.autor_colaborador_id = p.colaborador_id)
              -- Perfis com empresa_id mas sem colaborador associado (ex.: RH) — autor_colaborador pode ficar null
              or (p.perfil <> 'Colaborador' and public.noticias_comentarios.autor_colaborador_id is null)
            )
          )
        )
    )
  );

-- UPDATE (apenas o autor ou Admin/PCA)
drop policy if exists "noticias_comentarios: tenant update" on public.noticias_comentarios;
create policy "noticias_comentarios: tenant update"
  on public.noticias_comentarios for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (
            p.perfil = 'Colaborador'
            and p.empresa_id is not null
            and public.noticias_comentarios.empresa_id = p.empresa_id
            and public.noticias_comentarios.autor_colaborador_id = p.colaborador_id
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (
            p.perfil = 'Colaborador'
            and p.empresa_id is not null
            and public.noticias_comentarios.empresa_id = p.empresa_id
            and public.noticias_comentarios.autor_colaborador_id = p.colaborador_id
          )
        )
    )
  );

-- DELETE (apenas o autor ou Admin/PCA)
drop policy if exists "noticias_comentarios: tenant delete" on public.noticias_comentarios;
create policy "noticias_comentarios: tenant delete"
  on public.noticias_comentarios for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (
            p.perfil = 'Colaborador'
            and p.empresa_id is not null
            and public.noticias_comentarios.empresa_id = p.empresa_id
            and public.noticias_comentarios.autor_colaborador_id = p.colaborador_id
          )
        )
    )
  );

-- 2) “Gostos”
create table if not exists public.noticias_gostos (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  noticia_id bigint not null references public.noticias(id) on delete cascade,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  created_at timestamptz default now(),

  unique(noticia_id, colaborador_id)
);

create index if not exists idx_noticias_gostos_noticia on public.noticias_gostos(noticia_id);
create index if not exists idx_noticias_gostos_empresa on public.noticias_gostos(empresa_id);
create index if not exists idx_noticias_gostos_colab on public.noticias_gostos(colaborador_id);

alter table public.noticias_gostos enable row level security;

drop policy if exists "noticias_gostos: tenant select" on public.noticias_gostos;
create policy "noticias_gostos: tenant select"
  on public.noticias_gostos for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.noticias_gostos.empresa_id = p.empresa_id)
        )
    )
  );

drop policy if exists "noticias_gostos: tenant insert" on public.noticias_gostos;
create policy "noticias_gostos: tenant insert"
  on public.noticias_gostos for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil = 'Colaborador'
        and p.colaborador_id = public.noticias_gostos.colaborador_id
        and p.empresa_id is not null
        and public.noticias_gostos.empresa_id = p.empresa_id
        and exists (
          select 1 from public.noticias n
          where n.id = public.noticias_gostos.noticia_id
            and n.empresa_id = public.noticias_gostos.empresa_id
        )
    )
  );

drop policy if exists "noticias_gostos: tenant delete" on public.noticias_gostos;
create policy "noticias_gostos: tenant delete"
  on public.noticias_gostos for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil = 'Colaborador'
        and p.colaborador_id = public.noticias_gostos.colaborador_id
        and p.empresa_id is not null
        and public.noticias_gostos.empresa_id = p.empresa_id
        and exists (
          select 1 from public.noticias n
          where n.id = public.noticias_gostos.noticia_id
            and n.empresa_id = public.noticias_gostos.empresa_id
        )
    )
  );

