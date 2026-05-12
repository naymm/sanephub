-- Validação de prazo: não bloquear UPDATEs que só mudam estado/outros campos quando o prazo
-- já está no passado (tarefa atrasada). Só revalidar em INSERT ou quando prazo/data_actividade mudam.

create or replace function public.fn_produtividade_validate_prazo()
returns trigger
language plpgsql
as $$
declare
  min_prazo date;
  should_validate boolean;
begin
  min_prazo := greatest(current_date, new.data_actividade);

  if tg_op = 'INSERT' then
    should_validate := true;
  else
    should_validate :=
      new.prazo is distinct from old.prazo
      or new.data_actividade is distinct from old.data_actividade;
  end if;

  if should_validate and new.prazo < min_prazo then
    raise exception 'Prazo inválido: não pode ser anterior a %.', min_prazo;
  end if;

  return new;
end $$;
