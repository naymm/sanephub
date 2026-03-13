-- Bucket para facturas proforma de requisições
insert into storage.buckets (id, name, public)
values ('proformas', 'proformas', true)
on conflict (id) do nothing;

-- Políticas: qualquer utilizador autenticado pode ler e escrever proformas
create policy "proformas_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'proformas');

create policy "proformas_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'proformas');

create policy "proformas_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'proformas')
  with check (bucket_id = 'proformas');

create policy "proformas_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'proformas');

