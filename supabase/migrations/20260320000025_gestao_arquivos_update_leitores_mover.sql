-- Permitir UPDATE a quem consegue ler o ficheiro e a pasta (origem e destino), não só a gestores.
-- Quem não é gestor só pode alterar pasta_id e updated_at (trigger).

drop policy if exists "gestao_arquivos: update" on public.gestao_documentos_arquivos;

create policy "gestao_arquivos: update"
  on public.gestao_documentos_arquivos for update
  using (
    public.gestao_documentos_pode_gerir()
    or (
      public.gestao_documento_pode_ler(
        gestao_documentos_arquivos.empresa_id,
        gestao_documentos_arquivos.modulos_acesso,
        gestao_documentos_arquivos.sectores_acesso
      )
      and exists (
        select 1
        from public.gestao_documentos_pastas gp
        where gp.id = gestao_documentos_arquivos.pasta_id
          and gp.empresa_id = gestao_documentos_arquivos.empresa_id
          and public.gestao_pasta_pode_ler(gp.empresa_id, gp.modulos_acesso, gp.sectores_acesso)
      )
    )
  )
  with check (
    public.gestao_documentos_pode_gerir()
    or (
      public.gestao_documento_pode_ler(
        gestao_documentos_arquivos.empresa_id,
        gestao_documentos_arquivos.modulos_acesso,
        gestao_documentos_arquivos.sectores_acesso
      )
      and exists (
        select 1
        from public.gestao_documentos_pastas gp
        where gp.id = gestao_documentos_arquivos.pasta_id
          and gp.empresa_id = gestao_documentos_arquivos.empresa_id
          and public.gestao_pasta_pode_ler(gp.empresa_id, gp.modulos_acesso, gp.sectores_acesso)
      )
    )
  );

-- Bloquear alteração de metadados por quem não gere (só mover: pasta_id + updated_at).
create or replace function public.gestao_arquivos_restringe_update_nao_gerir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.gestao_documentos_pode_gerir() then
    return new;
  end if;
  if new.empresa_id is distinct from old.empresa_id
     or new.titulo is distinct from old.titulo
     or new.observacao is distinct from old.observacao
     or new.storage_path is distinct from old.storage_path
     or new.nome_ficheiro is distinct from old.nome_ficheiro
     or new.mime_type is distinct from old.mime_type
     or new.tamanho_bytes is distinct from old.tamanho_bytes
     or new.tipo_ficheiro is distinct from old.tipo_ficheiro
     or new.modulos_acesso is distinct from old.modulos_acesso
     or new.sectores_acesso is distinct from old.sectores_acesso
     or new.origem_modulo is distinct from old.origem_modulo
     or new.uploaded_by is distinct from old.uploaded_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Apenas gestores documentais podem alterar estes campos; outros utilizadores só podem mover o ficheiro entre pastas.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists gestao_arquivos_restringe_update on public.gestao_documentos_arquivos;

create trigger gestao_arquivos_restringe_update
  before update on public.gestao_documentos_arquivos
  for each row
  execute function public.gestao_arquivos_restringe_update_nao_gerir();
