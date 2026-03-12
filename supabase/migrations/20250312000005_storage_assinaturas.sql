-- Bucket para assinaturas digitais (imagens)
insert into storage.buckets (id, name, public)
values ('assinaturas', 'assinaturas', true)
on conflict (id) do nothing;

-- Política: qualquer utilizador autenticado pode gerir os próprios ficheiros de assinatura
create policy "assinaturas_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'assinaturas');

create policy "assinaturas_authenticated_write"
  on storage.objects for insert
  with check (bucket_id = 'assinaturas');

create policy "assinaturas_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'assinaturas')
  with check (bucket_id = 'assinaturas');

create policy "assinaturas_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'assinaturas');

