-- Fotografia de perfil dos colaboradores (Capital Humano)

alter table public.colaboradores
  add column if not exists foto_perfil_url text;

comment on column public.colaboradores.foto_perfil_url is
  'URL pública (storage) da fotografia de perfil; opcional.';

insert into storage.buckets (id, name, public)
values ('colaboradores-fotos', 'colaboradores-fotos', true)
on conflict (id) do nothing;

drop policy if exists "colaboradores_fotos_authenticated_read" on storage.objects;
drop policy if exists "colaboradores_fotos_authenticated_insert" on storage.objects;
drop policy if exists "colaboradores_fotos_authenticated_update" on storage.objects;
drop policy if exists "colaboradores_fotos_authenticated_delete" on storage.objects;

create policy "colaboradores_fotos_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'colaboradores-fotos');

create policy "colaboradores_fotos_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'colaboradores-fotos');

create policy "colaboradores_fotos_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'colaboradores-fotos')
  with check (bucket_id = 'colaboradores-fotos');

create policy "colaboradores_fotos_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'colaboradores-fotos');
