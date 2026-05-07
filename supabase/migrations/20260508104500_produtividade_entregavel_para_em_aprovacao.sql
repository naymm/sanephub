-- Exige entregável ao passar para «Em aprovação» (igual ao concluído), quando possui_entregavel = true.

create or replace function public.fn_produtividade_block_complete_without_entregavel()
returns trigger
language plpgsql
as $$
begin
  if new.possui_entregavel = true
     and (tg_op = 'UPDATE')
     and (old.status is distinct from new.status)
     and new.status in ('Concluída', 'Em aprovação')
  then
    if not exists (
      select 1
      from public.produtividade_entregaveis e
      where e.actividade_id = new.id
    ) then
      raise exception 'Entregável obrigatório: anexe um ficheiro antes de submeter para aprovação ou de concluir a actividade.';
    end if;
  end if;
  return new;
end $$;
