-- =============================================================================
-- Produtividade — exigir entregável ao concluir (quando possui_entregavel=true)
-- =============================================================================

create or replace function public.fn_produtividade_block_complete_without_entregavel()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'Concluída'
     and new.possui_entregavel = true
     and (tg_op = 'UPDATE')
     and (old.status is distinct from new.status)
  then
    if not exists (
      select 1
      from public.produtividade_entregaveis e
      where e.actividade_id = new.id
    ) then
      raise exception 'Entregável obrigatório: anexe um ficheiro antes de concluir a actividade.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tr_produtividade_require_entregavel on public.produtividade_actividades;
create trigger tr_produtividade_require_entregavel
  before update on public.produtividade_actividades
  for each row
  execute procedure public.fn_produtividade_block_complete_without_entregavel();

