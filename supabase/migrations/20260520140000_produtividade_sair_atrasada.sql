-- Permite sair de «Atrasada» (ou Pendente/Em Progresso com prazo vencido) para Em Progresso / Em aprovação / Concluída.
-- Corrige: (1) promoção a «Atrasada» em cada UPDATE com prazo vencido; (2) re-promoção ao gravar só kanban_order.

create or replace function public.fn_produtividade_apply_overdue_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.status = 'Atrasada' then
    raise exception 'O estado «Atrasada» não pode ser definido manualmente. Resulta do prazo vencido.';
  end if;

  if tg_op = 'UPDATE' and new.status = 'Atrasada' and old.status is distinct from 'Atrasada' then
    raise exception 'O estado «Atrasada» não pode ser definido manualmente. Resulta do prazo vencido.';
  end if;

  -- Promoção automática a «Atrasada» apenas no INSERT (nunca repor em UPDATE — inclui reordenação Kanban).
  if tg_op = 'INSERT'
     and new.status not in ('Concluída', 'Cancelada', 'Em aprovação')
     and new.prazo < current_date then
    new.status := 'Atrasada';
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
