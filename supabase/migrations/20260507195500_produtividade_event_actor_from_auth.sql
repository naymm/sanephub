-- Fix: usar o actor real (utilizador autenticado) nos eventos de update.
-- Antes: actor_colaborador_id = new.colaborador_id (dono), o que mostra nome errado
-- quando um participante muda status/prioridade/prazo.

create or replace function public.fn_produtividade_event_on_activity_update()
returns trigger
language plpgsql
as $$
declare
  pid bigint;
  actor_cid bigint;
begin
  -- Perfil actual (Supabase auth)
  select p.id, p.colaborador_id
    into pid, actor_cid
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;

  -- Fallback: se não houver colaborador ligado (ex.: alguns perfis), mantém o dono
  actor_cid := coalesce(actor_cid, new.colaborador_id);

  if old.status is distinct from new.status then
    insert into public.produtividade_eventos(actividade_id, tipo, actor_profile_id, actor_colaborador_id, payload)
    values (new.id, 'status_changed', pid, actor_cid, jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if old.prioridade is distinct from new.prioridade then
    insert into public.produtividade_eventos(actividade_id, tipo, actor_profile_id, actor_colaborador_id, payload)
    values (new.id, 'priority_changed', pid, actor_cid, jsonb_build_object('from', old.prioridade, 'to', new.prioridade));
  end if;

  if old.prazo is distinct from new.prazo then
    insert into public.produtividade_eventos(actividade_id, tipo, actor_profile_id, actor_colaborador_id, payload)
    values (new.id, 'deadline_changed', pid, actor_cid, jsonb_build_object('from', old.prazo, 'to', new.prazo));
  end if;

  return new;
end $$;

