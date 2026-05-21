-- Anexos de correspondência (documento + protocolo) — Secretaria Geral

alter table public.correspondencias
  add column if not exists documento_storage_path text,
  add column if not exists documento_nome_ficheiro text,
  add column if not exists protocolo_storage_path text,
  add column if not exists protocolo_nome_ficheiro text;

comment on column public.correspondencias.documento_storage_path is 'Object path no bucket correspondencias-anexos.';
comment on column public.correspondencias.protocolo_storage_path is 'Object path no bucket correspondencias-anexos (protocolo).';

insert into storage.buckets (id, name, public)
values ('correspondencias-anexos', 'correspondencias-anexos', true)
on conflict (id) do nothing;

create policy "correspondencias_anexos_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'correspondencias-anexos');

create policy "correspondencias_anexos_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'correspondencias-anexos');

create policy "correspondencias_anexos_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'correspondencias-anexos')
  with check (bucket_id = 'correspondencias-anexos');

create policy "correspondencias_anexos_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'correspondencias-anexos');
