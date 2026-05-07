-- =============================================================================
-- Produtividade — Eventos (activity feed) + Comentários
-- =============================================================================

create table if not exists public.produtividade_eventos (
  id bigserial primary key,
  actividade_id bigint not null references public.produtividade_actividades(id) on delete cascade,
  tipo text not null check (
    tipo in (
      'created',
      'status_changed',
      'priority_changed',
      'deadline_changed',
      'deliverable_uploaded',
      'comment_added'
    )
  ),
  actor_profile_id bigint references public.profiles(id) on delete set null,
  actor_colaborador_id bigint references public.colaboradores(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_produtividade_eventos_actividade on public.produtividade_eventos(actividade_id, created_at desc);

create table if not exists public.produtividade_comentarios (
  id bigserial primary key,
  actividade_id bigint not null references public.produtividade_actividades(id) on delete cascade,
  autor_colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_produtividade_comentarios_actividade on public.produtividade_comentarios(actividade_id, created_at desc);

-- RLS
alter table public.produtividade_eventos enable row level security;
alter table public.produtividade_comentarios enable row level security;

-- Mesma regra da actividade pai: colaborador vê própria; Admin/Director vê equipa da empresa.
create policy "produtividade_eventos: select own or team"
  on public.produtividade_eventos for select
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p
        on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_eventos.actividade_id
        and (
          a.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_eventos: insert own or team"
  on public.produtividade_eventos for insert
  with check (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p
        on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_eventos.actividade_id
        and (
          a.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_comentarios: select own or team"
  on public.produtividade_comentarios for select
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p
        on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_comentarios.actividade_id
        and (
          a.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_comentarios: insert own or team"
  on public.produtividade_comentarios for insert
  with check (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p
        on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_comentarios.actividade_id
        and (
          -- Só quem participa (dono) ou gestor consegue comentar; e o autor tem de ser o seu colaborador
          (a.colaborador_id = p.colaborador_id and public.produtividade_comentarios.autor_colaborador_id = p.colaborador_id)
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
            and public.produtividade_comentarios.autor_colaborador_id = coalesce(p.colaborador_id, public.produtividade_comentarios.autor_colaborador_id)
          )
        )
    )
  );

-- Triggers: gerar eventos
create or replace function public.fn_produtividade_event_on_activity_insert()
returns trigger
language plpgsql
as $$
declare
  pid bigint;
begin
  select p.id into pid from public.profiles p where p.auth_user_id = auth.uid() limit 1;
  insert into public.produtividade_eventos(actividade_id, tipo, actor_profile_id, actor_colaborador_id, payload)
  values (new.id, 'created', pid, new.colaborador_id, jsonb_build_object('titulo', new.titulo));
  return new;
end $$;

drop trigger if exists tr_produtividade_event_on_insert on public.produtividade_actividades;
create trigger tr_produtividade_event_on_insert
  after insert on public.produtividade_actividades
  for each row execute procedure public.fn_produtividade_event_on_activity_insert();

create or replace function public.fn_produtividade_event_on_activity_update()
returns trigger
language plpgsql
as $$
declare
  pid bigint;
begin
  select p.id into pid from public.profiles p where p.auth_user_id = auth.uid() limit 1;

  if old.status is distinct from new.status then
    insert into public.produtividade_eventos(actividade_id, tipo, actor_profile_id, actor_colaborador_id, payload)
    values (new.id, 'status_changed', pid, new.colaborador_id, jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if old.prioridade is distinct from new.prioridade then
    insert into public.produtividade_eventos(actividade_id, tipo, actor_profile_id, actor_colaborador_id, payload)
    values (new.id, 'priority_changed', pid, new.colaborador_id, jsonb_build_object('from', old.prioridade, 'to', new.prioridade));
  end if;

  if old.prazo is distinct from new.prazo then
    insert into public.produtividade_eventos(actividade_id, tipo, actor_profile_id, actor_colaborador_id, payload)
    values (new.id, 'deadline_changed', pid, new.colaborador_id, jsonb_build_object('from', old.prazo, 'to', new.prazo));
  end if;

  return new;
end $$;

drop trigger if exists tr_produtividade_event_on_update on public.produtividade_actividades;
create trigger tr_produtividade_event_on_update
  after update on public.produtividade_actividades
  for each row execute procedure public.fn_produtividade_event_on_activity_update();

create or replace function public.fn_produtividade_event_on_deliverable_insert()
returns trigger
language plpgsql
as $$
declare
  pid bigint;
begin
  select p.id into pid from public.profiles p where p.auth_user_id = auth.uid() limit 1;
  insert into public.produtividade_eventos(actividade_id, tipo, actor_profile_id, actor_colaborador_id, payload)
  values (
    new.actividade_id,
    'deliverable_uploaded',
    pid,
    new.uploaded_by_colaborador_id,
    jsonb_build_object('nome', new.nome_ficheiro, 'mime', new.mime_type)
  );
  return new;
end $$;

drop trigger if exists tr_produtividade_event_on_deliverable_insert on public.produtividade_entregaveis;
create trigger tr_produtividade_event_on_deliverable_insert
  after insert on public.produtividade_entregaveis
  for each row execute procedure public.fn_produtividade_event_on_deliverable_insert();

create or replace function public.fn_produtividade_event_on_comment_insert()
returns trigger
language plpgsql
as $$
declare
  pid bigint;
begin
  select p.id into pid from public.profiles p where p.auth_user_id = auth.uid() limit 1;
  insert into public.produtividade_eventos(actividade_id, tipo, actor_profile_id, actor_colaborador_id, payload)
  values (
    new.actividade_id,
    'comment_added',
    pid,
    new.autor_colaborador_id,
    jsonb_build_object('comment_id', new.id)
  );
  return new;
end $$;

drop trigger if exists tr_produtividade_event_on_comment_insert on public.produtividade_comentarios;
create trigger tr_produtividade_event_on_comment_insert
  after insert on public.produtividade_comentarios
  for each row execute procedure public.fn_produtividade_event_on_comment_insert();

