-- =============================================================================
-- Chat intranet: conversas e mensagens partilhadas (Supabase + Realtime)
-- Substitui o armazenamento apenas em localStorage entre utilizadores reais.
-- =============================================================================

create table if not exists public.intranet_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('private', 'group')),
  name text,
  participant_ids bigint[] not null,
  created_by_profile_id bigint not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intranet_chat_conv_participants_min check (cardinality(participant_ids) >= 2)
);

create index if not exists idx_intranet_chat_conv_participants
  on public.intranet_chat_conversations using gin (participant_ids);

comment on table public.intranet_chat_conversations is 'Conversas de chat; participant_ids = profiles.id.';

create table if not exists public.intranet_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.intranet_chat_conversations (id) on delete cascade,
  sender_profile_id bigint not null references public.profiles (id) on delete cascade,
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
  read_by_profile_ids bigint[] not null default '{}',
  pinned boolean not null default false,
  pinned_at timestamptz,
  pinned_by_profile_id bigint references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_intranet_chat_msg_conversation
  on public.intranet_chat_messages (conversation_id, created_at);

comment on table public.intranet_chat_messages is 'Mensagens do chat intranet; attachments = JSON array de anexos.';

-- Marcar lidas (append ao array sem expor lógica frágil no cliente)
create or replace function public.intranet_chat_mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid bigint;
begin
  select p.id into v_pid
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;

  if v_pid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.intranet_chat_conversations c
    where c.id = p_conversation_id
      and v_pid = any (c.participant_ids)
  ) then
    raise exception 'forbidden';
  end if;

  update public.intranet_chat_messages m
  set read_by_profile_ids =
    case
      when v_pid = any (m.read_by_profile_ids) then m.read_by_profile_ids
      else m.read_by_profile_ids || v_pid
    end
  where m.conversation_id = p_conversation_id
    and m.sender_profile_id is distinct from v_pid;
end;
$$;

revoke all on function public.intranet_chat_mark_conversation_read(uuid) from public;
grant execute on function public.intranet_chat_mark_conversation_read(uuid) to authenticated;

alter table public.intranet_chat_conversations enable row level security;
alter table public.intranet_chat_messages enable row level security;

drop policy if exists "intranet_chat_conv_select" on public.intranet_chat_conversations;
create policy "intranet_chat_conv_select"
  on public.intranet_chat_conversations for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.id = any (participant_ids)
    )
  );

drop policy if exists "intranet_chat_conv_insert" on public.intranet_chat_conversations;
create policy "intranet_chat_conv_insert"
  on public.intranet_chat_conversations for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.id = created_by_profile_id
        and p.id = any (participant_ids)
    )
  );

drop policy if exists "intranet_chat_conv_update" on public.intranet_chat_conversations;
create policy "intranet_chat_conv_update"
  on public.intranet_chat_conversations for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.id = any (participant_ids)
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.id = any (participant_ids)
    )
  );

drop policy if exists "intranet_chat_msg_select" on public.intranet_chat_messages;
create policy "intranet_chat_msg_select"
  on public.intranet_chat_messages for select
  using (
    exists (
      select 1
      from public.intranet_chat_conversations c
      join public.profiles p on p.auth_user_id = auth.uid()
      where c.id = intranet_chat_messages.conversation_id
        and p.id = any (c.participant_ids)
    )
  );

drop policy if exists "intranet_chat_msg_insert" on public.intranet_chat_messages;
create policy "intranet_chat_msg_insert"
  on public.intranet_chat_messages for insert
  with check (
    sender_profile_id = (select id from public.profiles where auth_user_id = auth.uid() limit 1)
    and exists (
      select 1
      from public.intranet_chat_conversations c
      join public.profiles p on p.auth_user_id = auth.uid() and p.id = sender_profile_id
      where c.id = conversation_id
        and p.id = any (c.participant_ids)
    )
  );

drop policy if exists "intranet_chat_msg_update" on public.intranet_chat_messages;
create policy "intranet_chat_msg_update"
  on public.intranet_chat_messages for update
  using (
    exists (
      select 1
      from public.intranet_chat_conversations c
      join public.profiles p on p.auth_user_id = auth.uid()
      where c.id = intranet_chat_messages.conversation_id
        and p.id = any (c.participant_ids)
    )
  )
  with check (
    exists (
      select 1
      from public.intranet_chat_conversations c
      join public.profiles p on p.auth_user_id = auth.uid()
      where c.id = intranet_chat_messages.conversation_id
        and p.id = any (c.participant_ids)
    )
  );

grant select, insert, update on public.intranet_chat_conversations to authenticated;
grant select, insert, update on public.intranet_chat_messages to authenticated;

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'intranet_chat_conversations'
  ) then
    alter publication supabase_realtime add table public.intranet_chat_conversations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'intranet_chat_messages'
  ) then
    alter publication supabase_realtime add table public.intranet_chat_messages;
  end if;
end $$;
