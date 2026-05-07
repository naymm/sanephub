-- =============================================================================
-- Produtividade — Validação de prazo (deadline)
-- Regras:
-- - prazo não pode ser anterior à data actual
-- - prazo não pode ser anterior à data da actividade
-- =============================================================================

create or replace function public.fn_produtividade_validate_prazo()
returns trigger
language plpgsql
as $$
declare
  min_prazo date;
begin
  min_prazo := greatest(current_date, new.data_actividade);
  if new.prazo < min_prazo then
    raise exception 'Prazo inválido: não pode ser anterior a %.', min_prazo;
  end if;
  return new;
end $$;

drop trigger if exists tr_produtividade_validate_prazo on public.produtividade_actividades;
create trigger tr_produtividade_validate_prazo
  before insert or update on public.produtividade_actividades
  for each row
  execute procedure public.fn_produtividade_validate_prazo();

