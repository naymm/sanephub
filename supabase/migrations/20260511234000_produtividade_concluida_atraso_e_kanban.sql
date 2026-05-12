-- Conclusão fora do prazo: flag persistente + Kanban livre quando o utilizador muda o estado (não forçar «Atrasada» em cada UPDATE).

alter table public.produtividade_actividades
  add column if not exists concluida_com_atraso boolean not null default false;

comment on column public.produtividade_actividades.concluida_com_atraso is
  'Verdadeiro se a conclusão ocorreu numa data (Lisboa) posterior ao prazo.';

update public.produtividade_actividades a
set concluida_com_atraso = true
where a.status = 'Concluída'
  and a.concluida_em is not null
  and (timezone('Europe/Lisbon', a.concluida_em))::date > a.prazo;

create or replace function public.fn_produtividade_apply_overdue_status()
returns trigger
language plpgsql
as $$
begin
  -- Só promover automaticamente a «Atrasada» em INSERT ou quando o estado não foi alterado neste UPDATE
  -- (permite arrastar/mudar Pendente/Em Progresso mesmo com prazo vencido).
  if new.status not in ('Concluída', 'Cancelada', 'Em aprovação')
     and new.prazo < current_date then
    if tg_op = 'INSERT' then
      new.status := 'Atrasada';
    elsif tg_op = 'UPDATE' and old.status is not distinct from new.status then
      new.status := 'Atrasada';
    end if;
  end if;

  if new.status = 'Concluída' then
    if new.concluida_em is null then
      new.concluida_em := now();
    end if;
    new.concluida_com_atraso := (timezone('Europe/Lisbon', new.concluida_em))::date > new.prazo;
  else
    new.concluida_com_atraso := false;
  end if;

  if new.status = 'Cancelada' and new.cancelada_em is null then
    new.cancelada_em := now();
  end if;

  if new.tipo_actividade <> 'Presencial' then
    new.localizacao := null;
  end if;
  return new;
end $$;
