-- =============================================================================
-- Auditoria global (Admin): eventos de sessão, chat, produtividade, ponto, GPS.
-- Inserções via triggers (SECURITY DEFINER) + RPC para login/logout no cliente.
-- =============================================================================

create table if not exists public.intranet_audit_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  event_category text not null,
  action text not null default 'insert',
  actor_profile_id bigint references public.profiles (id) on delete set null,
  actor_auth_uid uuid,
  resource_type text,
  resource_id text,
  empresa_id bigint references public.empresas (id) on delete set null,
  colaborador_id bigint references public.colaboradores (id) on delete set null,
  summary text,
  details jsonb not null default '{}'::jsonb
);

create index if not exists idx_intranet_audit_created on public.intranet_audit_events (created_at desc);
create index if not exists idx_intranet_audit_category on public.intranet_audit_events (event_category);
create index if not exists idx_intranet_audit_actor on public.intranet_audit_events (actor_profile_id);

comment on table public.intranet_audit_events is
  'Trilho de auditoria da intranet (visível só a Admin). event_category: login, logout, chat_message, produtividade_actividade, produtividade_comentario, produtividade_log, time_punch, ponto_biometrico, localizacao.';

-- Escreve linha de auditoria (usado por triggers e pela RPC pública de sessão).
create or replace function public.intranet_audit_write(
  p_category text,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_summary text,
  p_details jsonb,
  p_actor_profile_id bigint default null,
  p_empresa_id bigint default null,
  p_colaborador_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid bigint;
  v_cid bigint;
  v_eid bigint;
begin
  if p_actor_profile_id is not null then
    v_pid := p_actor_profile_id;
    select colaborador_id, empresa_id into v_cid, v_eid
    from public.profiles where id = p_actor_profile_id limit 1;
  else
    select id, colaborador_id, empresa_id
    into v_pid, v_cid, v_eid
    from public.profiles
    where auth_user_id = auth.uid()
    limit 1;
  end if;

  insert into public.intranet_audit_events (
    event_category,
    action,
    actor_profile_id,
    actor_auth_uid,
    resource_type,
    resource_id,
    empresa_id,
    colaborador_id,
    summary,
    details
  ) values (
    p_category,
    coalesce(nullif(trim(p_action), ''), 'insert'),
    v_pid,
    auth.uid(),
    p_resource_type,
    p_resource_id,
    coalesce(p_empresa_id, v_eid),
    coalesce(p_colaborador_id, v_cid),
    left(coalesce(p_summary, ''), 500),
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.intranet_audit_write(text, text, text, text, text, jsonb, bigint, bigint, bigint) from public;
-- Só a função SECURITY DEFINER insere; não expor ao cliente directamente.

-- RPC: login / logout (e reservado «sistema») chamada pelo cliente autenticado.
create or replace function public.intranet_audit_client_event(
  p_category text,
  p_action text default 'session',
  p_summary text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_category is null or p_category not in ('login', 'logout', 'sistema') then
    raise exception 'Categoria de auditoria inválida para o cliente.';
  end if;
  perform public.intranet_audit_write(
    p_category,
    coalesce(nullif(trim(p_action), ''), 'session'),
    null,
    null,
    p_summary,
    coalesce(p_details, '{}'::jsonb),
    null,
    null,
    null
  );
end;
$$;

revoke all on function public.intranet_audit_client_event(text, text, text, jsonb) from public;
grant execute on function public.intranet_audit_client_event(text, text, text, jsonb) to authenticated;

alter table public.intranet_audit_events enable row level security;

drop policy if exists "intranet_audit_events_select_admin" on public.intranet_audit_events;
create policy "intranet_audit_events_select_admin"
  on public.intranet_audit_events for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid() and p.perfil = 'Admin'
    )
  );

grant select on public.intranet_audit_events to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.tr_intranet_audit_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.intranet_audit_write(
    'chat_message',
    'insert',
    'intranet_chat_messages',
    new.id::text,
    'Mensagem enviada no chat',
    jsonb_build_object(
      'conversation_id', new.conversation_id,
      'preview', left(new.content, 160)
    ),
    new.sender_profile_id,
    null,
    null
  );
  return new;
end;
$$;

drop trigger if exists tr_intranet_audit_chat_message on public.intranet_chat_messages;
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'intranet_chat_messages'
  ) then
    create trigger tr_intranet_audit_chat_message
      after insert on public.intranet_chat_messages
      for each row execute function public.tr_intranet_audit_chat_message();
  end if;
end $$;

create or replace function public.tr_intranet_audit_produtividade_actividade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sum text;
  v_det jsonb;
begin
  if tg_op = 'INSERT' then
    v_sum := 'Nova actividade: ' || left(new.titulo, 200);
    v_det := jsonb_build_object(
      'titulo', new.titulo,
      'status', new.status,
      'empresa_id', new.empresa_id,
      'colaborador_id', new.colaborador_id,
      'tipo_actividade', new.tipo_actividade,
      'localizacao', new.localizacao
    );
    perform public.intranet_audit_write(
      'produtividade_actividade', 'insert', 'produtividade_actividades', new.id::text, v_sum, v_det,
      null, new.empresa_id, new.colaborador_id
    );
    return new;
  elsif tg_op = 'DELETE' then
    perform public.intranet_audit_write(
      'produtividade_actividade', 'delete', 'produtividade_actividades', old.id::text,
      'Actividade eliminada: ' || left(old.titulo, 200),
      jsonb_build_object('titulo', old.titulo, 'status', old.status),
      null, old.empresa_id, old.colaborador_id
    );
    return old;
  elsif tg_op = 'UPDATE' then
    if old.kanban_order is distinct from new.kanban_order
       and old.status is not distinct from new.status
       and old.titulo is not distinct from new.titulo
       and old.prazo is not distinct from new.prazo
       and old.descricao is not distinct from new.descricao
       and old.comentario is not distinct from new.comentario
       and old.prioridade is not distinct from new.prioridade
       and old.categoria is not distinct from new.categoria
       and old.tipo_actividade is not distinct from new.tipo_actividade
       and old.possui_entregavel is not distinct from new.possui_entregavel
       and old.colaborador_id is not distinct from new.colaborador_id
       and old.empresa_id is not distinct from new.empresa_id
       and old.localizacao is not distinct from new.localizacao
       and old.requer_aprovacao is not distinct from new.requer_aprovacao
       and old.aprovador_colaborador_id is not distinct from new.aprovador_colaborador_id
       and old.concluida_em is not distinct from new.concluida_em
       and old.cancelada_em is not distinct from new.cancelada_em
    then
      return new;
    end if;
    v_sum := 'Actividade actualizada';
    if old.status is distinct from new.status then
      v_sum := v_sum || format(' — estado %s → %s', old.status, new.status);
    end if;
    v_det := jsonb_build_object(
      'titulo', new.titulo,
      'status_was', old.status,
      'status', new.status,
      'prazo', new.prazo,
      'tipo_actividade', new.tipo_actividade,
      'localizacao', new.localizacao
    );
    perform public.intranet_audit_write(
      'produtividade_actividade', 'update', 'produtividade_actividades', new.id::text, v_sum, v_det,
      null, new.empresa_id, new.colaborador_id
    );
    return new;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_intranet_audit_produtividade_actividade on public.produtividade_actividades;
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'produtividade_actividades'
  ) then
    create trigger tr_intranet_audit_produtividade_actividade
      after insert or update or delete on public.produtividade_actividades
      for each row execute function public.tr_intranet_audit_produtividade_actividade();
  end if;
end $$;

create or replace function public.tr_intranet_audit_produtividade_comentario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp bigint;
  v_col bigint;
begin
  select a.empresa_id, a.colaborador_id into v_emp, v_col
  from public.produtividade_actividades a
  where a.id = new.actividade_id
  limit 1;

  perform public.intranet_audit_write(
    'produtividade_comentario',
    'insert',
    'produtividade_comentarios',
    new.id::text,
    'Comentário em actividade',
    jsonb_build_object(
      'actividade_id', new.actividade_id,
      'preview', left(new.conteudo, 200)
    ),
    null, v_emp, new.autor_colaborador_id
  );
  return new;
end;
$$;

drop trigger if exists tr_intranet_audit_produtividade_comentario on public.produtividade_comentarios;
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'produtividade_comentarios'
  ) then
    create trigger tr_intranet_audit_produtividade_comentario
      after insert on public.produtividade_comentarios
      for each row execute function public.tr_intranet_audit_produtividade_comentario();
  end if;
end $$;

create or replace function public.tr_intranet_audit_produtividade_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp bigint;
  v_col bigint;
begin
  select a.empresa_id, a.colaborador_id into v_emp, v_col
  from public.produtividade_actividades a
  where a.id = new.actividade_id
  limit 1;

  perform public.intranet_audit_write(
    'produtividade_log',
    'insert',
    'produtividade_eventos',
    new.id::text,
    'Registo de actividade: ' || coalesce(new.tipo, ''),
    jsonb_build_object('tipo', new.tipo, 'actividade_id', new.actividade_id, 'payload', new.payload),
    new.actor_profile_id,
    v_emp,
    coalesce(new.actor_colaborador_id, v_col)
  );
  return new;
end;
$$;

drop trigger if exists tr_intranet_audit_produtividade_evento on public.produtividade_eventos;
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'produtividade_eventos'
  ) then
    create trigger tr_intranet_audit_produtividade_evento
      after insert on public.produtividade_eventos
      for each row execute function public.tr_intranet_audit_produtividade_evento();
  end if;
end $$;

create or replace function public.tr_intranet_audit_time_punch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat text;
  v_sum text;
  v_det jsonb;
begin
  v_det := jsonb_build_object(
    'kind', new.kind,
    'occurred_at', new.occurred_at,
    'location_lat', new.location_lat,
    'location_lng', new.location_lng,
    'geofence_id', new.geofence_id,
    'is_within_geofence', new.is_within_geofence
  );
  if new.location_lat is not null and new.location_lng is not null then
    v_cat := 'localizacao';
    v_sum := 'Marcação de ponto com localização GPS';
  else
    v_cat := 'time_punch';
    v_sum := 'Marcação de ponto (time_punches)';
  end if;
  perform public.intranet_audit_write(
    v_cat,
    'insert',
    'time_punches',
    new.id::text,
    v_sum,
    v_det,
    null,
    new.empresa_id,
    new.colaborador_id
  );
  return new;
end;
$$;

drop trigger if exists tr_intranet_audit_time_punch on public.time_punches;
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'time_punches'
  ) then
    create trigger tr_intranet_audit_time_punch
      after insert on public.time_punches
      for each row execute function public.tr_intranet_audit_time_punch();
  end if;
end $$;

create or replace function public.tr_intranet_audit_biometrico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat text;
  v_sum text;
  v_det jsonb;
  v_cid bigint;
  v_emp bigint;
begin
  select c.id, c.empresa_id into v_cid, v_emp
  from public.colaboradores c
  where c.numero_mec is not null
    and lower(trim(c.numero_mec::text)) = lower(trim(new.numero_mec::text))
  limit 1;

  v_det := jsonb_build_object(
    'numero_mec', new.numero_mec,
    'data_hora', new.data_hora,
    'tipo', new.tipo,
    'via', new.via,
    'empresa', new.empresa,
    'location_lat', new.location_lat,
    'location_lng', new.location_lng,
    'location_accuracy_m', new.location_accuracy_m,
    'geofence_id', new.geofence_id,
    'is_within_geofence', new.is_within_geofence
  );

  if new.location_lat is not null and new.location_lng is not null then
    v_cat := 'localizacao';
    v_sum := 'Ponto biométrico / ERP com GPS';
  else
    v_cat := 'ponto_biometrico';
    v_sum := 'Registo biométrico / ERP de ponto';
  end if;

  perform public.intranet_audit_write(
    v_cat,
    'insert',
    'biometrico_registros',
    new.id::text,
    v_sum,
    v_det,
    null,
    v_emp,
    v_cid
  );
  return new;
end;
$$;

drop trigger if exists tr_intranet_audit_biometrico on public.biometrico_registros;
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'biometrico_registros'
  ) then
    create trigger tr_intranet_audit_biometrico
      after insert on public.biometrico_registros
      for each row execute function public.tr_intranet_audit_biometrico();
  end if;
end $$;

-- Realtime (opcional para painel Admin em tempo real)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'intranet_audit_events'
    ) then
      alter publication supabase_realtime add table public.intranet_audit_events;
    end if;
  end if;
end $$;
