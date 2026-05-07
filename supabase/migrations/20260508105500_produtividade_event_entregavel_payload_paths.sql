-- Eventos «deliverable_uploaded»: incluir id e storage_path para a UI poder descarregar a partir da timeline.

create or replace function public.fn_produtividade_event_on_deliverable_insert()
returns trigger
language plpgsql
as $$
declare
  pid bigint;
begin
  select p.id into pid from public.profiles p where p.auth_user_id = auth.uid() limit 1;
  insert into public.produtividade_eventos(actividade_id, tipo, actor_profile_id, actor_colaborador_id, payload)
  values (
    new.actividade_id,
    'deliverable_uploaded',
    pid,
    new.uploaded_by_colaborador_id,
    jsonb_build_object(
      'nome', new.nome_ficheiro,
      'mime', new.mime_type,
      'entregavel_id', new.id,
      'storage_path', new.storage_path,
      'tamanho_bytes', new.tamanho_bytes
    )
  );
  return new;
end $$;
