-- =============================================================================
-- Chat: última mensagem por conversa (lista lateral) + resumo de não lidas
-- Evita carregar todas as mensagens só para a sidebar.
-- =============================================================================

create or replace function public.intranet_chat_latest_messages(p_conversation_ids uuid[])
returns setof public.intranet_chat_messages
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (m.conversation_id) m.*
  from public.intranet_chat_messages m
  inner join public.intranet_chat_conversations c on c.id = m.conversation_id
  inner join public.profiles p on p.auth_user_id = auth.uid()
    and p.id = any (c.participant_ids)
  where m.conversation_id = any (p_conversation_ids)
  order by m.conversation_id, m.created_at desc, m.id desc;
$$;

revoke all on function public.intranet_chat_latest_messages(uuid[]) from public;
grant execute on function public.intranet_chat_latest_messages(uuid[]) to authenticated;

comment on function public.intranet_chat_latest_messages(uuid[]) is
  'Última mensagem por conversa (sidebar); só conversas em que o utilizador participa.';

create or replace function public.intranet_chat_unread_summary()
returns table (conversation_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.id as profile_id
    from public.profiles p
    where p.auth_user_id = auth.uid()
    limit 1
  )
  select m.conversation_id, count(*)::bigint as unread_count
  from public.intranet_chat_messages m
  inner join public.intranet_chat_conversations c on c.id = m.conversation_id
  cross join me
  where me.profile_id = any (c.participant_ids)
    and m.sender_profile_id is distinct from me.profile_id
    and not (me.profile_id = any (m.read_by_profile_ids))
  group by m.conversation_id;
$$;

revoke all on function public.intranet_chat_unread_summary() from public;
grant execute on function public.intranet_chat_unread_summary() to authenticated;

comment on function public.intranet_chat_unread_summary() is
  'Contagem de mensagens não lidas por conversa (para o utilizador actual).';
