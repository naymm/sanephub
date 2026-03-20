-- Ajuste de RLS: permitir que qualquer perfil do tenant dê “gosto” nas Notícias.

-- Estrutura: trocar a unicidade/identidade do gosto para autor_perfil_id (profiles.id).

alter table public.noticias_gostos
  add column if not exists autor_perfil_id bigint references public.profiles(id) on delete cascade;

-- compatibilidade: permitir null para colaborador (para perfis sem colaborador associado)
alter table public.noticias_gostos
  alter column colaborador_id drop not null;

-- preencher autor_perfil_id para likes existentes (quando houver colaborador associado)
update public.noticias_gostos g
set autor_perfil_id = p.id
from public.profiles p
where p.colaborador_id is not null
  and p.colaborador_id = g.colaborador_id
  and g.autor_perfil_id is null;

-- remover unique antigo (noticia_id, colaborador_id)
do $$
declare
  t_oid oid;
  a_noticia int4;
  a_colab int4;
  conrec record;
begin
  select oid into t_oid from pg_class where relname = 'noticias_gostos';
  select attnum into a_noticia from pg_attribute where attrelid = t_oid and attname = 'noticia_id';
  select attnum into a_colab from pg_attribute where attrelid = t_oid and attname = 'colaborador_id';

  for conrec in
    select c.conname, c.oid
    from pg_constraint c
    where c.conrelid = t_oid
      and c.contype = 'u'
      and c.conkey @> array[a_noticia, a_colab]
  loop
    execute format('alter table public.noticias_gostos drop constraint %I', conrec.conname);
  end loop;
end $$;

-- garantir unicidade por autor_perfil_id
create unique index if not exists idx_noticias_gostos_unique_noticia_autor
  on public.noticias_gostos(noticia_id, autor_perfil_id);

-- RLS: policies para SELECT/INSERT/DELETE
drop policy if exists "noticias_gostos: tenant select" on public.noticias_gostos;
drop policy if exists "noticias_gostos: tenant insert" on public.noticias_gostos;
drop policy if exists "noticias_gostos: tenant delete" on public.noticias_gostos;

alter table public.noticias_gostos enable row level security;

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

create policy "noticias_gostos: tenant insert"
  on public.noticias_gostos for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.id = public.noticias_gostos.autor_perfil_id
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.noticias_gostos.empresa_id = p.empresa_id)
        )
        and exists (
          select 1 from public.noticias n
          where n.id = public.noticias_gostos.noticia_id
            and n.empresa_id = public.noticias_gostos.empresa_id
        )
    )
  );

create policy "noticias_gostos: tenant delete"
  on public.noticias_gostos for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.id = public.noticias_gostos.autor_perfil_id
        and (
          (p.perfil in ('Admin','PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.noticias_gostos.empresa_id = p.empresa_id)
        )
    )
  );

