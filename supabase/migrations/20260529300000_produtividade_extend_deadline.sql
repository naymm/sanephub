-- Extensão de prazo com motivo (RPC) + motivo no evento deadline_changed.

create or replace function public.fn_produtividade_event_on_activity_update()
returns trigger
language plpgsql
as $$
declare
  pid bigint;
  actor_cid bigint;
  prazo_motivo text;
begin
  select p.id, p.colaborador_id
    into pid, actor_cid
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;

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
    prazo_motivo := nullif(trim(current_setting('app.produtividade_prazo_motivo', true)), '');
    insert into public.produtividade_eventos(actividade_id, tipo, actor_profile_id, actor_colaborador_id, payload)
    values (
      new.id,
      'deadline_changed',
      pid,
      actor_cid,
      jsonb_strip_nulls(
        jsonb_build_object(
          'from', old.prazo,
          'to', new.prazo,
          'motivo', prazo_motivo
        )
      )
    );
  end if;

  return new;
end $$;

create or replace function public.extend_produtividade_deadline(
  p_actividade_id bigint,
  p_novo_prazo date,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.produtividade_actividades%rowtype;
  min_prazo date;
  motivo_trim text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão inválida.';
  end if;

  if not public.fn_produtividade_can_access_actividade(p_actividade_id) then
    raise exception 'Sem permissão para alterar o prazo desta actividade.';
  end if;

  motivo_trim := trim(coalesce(p_motivo, ''));
  if motivo_trim = '' then
    raise exception 'Indique o motivo da extensão do prazo.';
  end if;

  select * into v_old
  from public.produtividade_actividades
  where id = p_actividade_id;

  if not found then
    raise exception 'Actividade não encontrada.';
  end if;

  if v_old.status in ('Concluída', 'Cancelada') then
    raise exception 'Não é possível alterar o prazo de uma actividade concluída ou cancelada.';
  end if;

  min_prazo := greatest(current_date, v_old.data_actividade);

  if p_novo_prazo < min_prazo then
    raise exception 'Prazo inválido: não pode ser anterior a %.', min_prazo;
  end if;

  if p_novo_prazo <= v_old.prazo then
    raise exception 'O próximo prazo deve ser posterior ao prazo actual (%).', v_old.prazo;
  end if;

  perform set_config('app.produtividade_prazo_motivo', motivo_trim, true);

  update public.produtividade_actividades
  set
    prazo = p_novo_prazo,
    status = case
      when status = 'Atrasada' and p_novo_prazo >= current_date then 'Em Progresso'
      else status
    end
  where id = p_actividade_id;

  perform set_config('app.produtividade_prazo_motivo', '', true);
end $$;

revoke all on function public.extend_produtividade_deadline(bigint, date, text) from public, anon;
grant execute on function public.extend_produtividade_deadline(bigint, date, text) to authenticated;
