-- Fluxo de estados: sem recuar (ex.: Em Progresso → Pendente). Só valida quando a coluna status muda no UPDATE
-- (compatível com a promoção automática a «Atrasada» noutro trigger quando o estado pedido não muda).

create or replace function public.fn_produtividade_allowed_status_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case
    when p_from is null or p_from is not distinct from p_to then true
    when p_from = 'Pendente' and p_to in ('Em Progresso', 'Em aprovação', 'Concluída', 'Cancelada') then true
    when p_from = 'Em Progresso' and p_to in ('Em aprovação', 'Concluída', 'Cancelada') then true
    when p_from = 'Atrasada' and p_to in ('Em Progresso', 'Em aprovação', 'Concluída', 'Cancelada') then true
    when p_from = 'Em aprovação' and p_to in ('Em Progresso', 'Concluída', 'Cancelada') then true
    else false
  end;
$$;

create or replace function public.fn_produtividade_enforce_status_flow()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    if not public.fn_produtividade_allowed_status_transition(old.status, new.status) then
      raise exception 'Transição de estado inválida: não é permitido passar de «%» para «%».', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_produtividade_01_enforce_status_flow on public.produtividade_actividades;
create trigger tr_produtividade_01_enforce_status_flow
  before update on public.produtividade_actividades
  for each row
  execute procedure public.fn_produtividade_enforce_status_flow();
