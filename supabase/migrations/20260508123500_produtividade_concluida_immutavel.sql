-- Bloqueia regressão de estado: uma actividade «Concluída» não pode voltar a outros estados.

create or replace function public.fn_produtividade_block_status_change_from_concluida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status = 'Concluída' and new.status is distinct from old.status then
    raise exception 'Uma actividade «Concluída» não pode ser movida para outro estado.';
  end if;

  return new;
end $$;

drop trigger if exists tr_produtividade_block_from_concluida on public.produtividade_actividades;
create trigger tr_produtividade_block_from_concluida
  before update on public.produtividade_actividades
  for each row execute procedure public.fn_produtividade_block_status_change_from_concluida();

