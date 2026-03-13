-- Bucket para comprovativos de pagamento e conclusão (requisições)
insert into storage.buckets (id, name, public)
values ('comprovativos', 'comprovativos', true)
on conflict (id) do nothing;

-- Políticas: qualquer utilizador autenticado pode ler e escrever comprovativos
create policy "comprovativos_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'comprovativos');

create policy "comprovativos_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'comprovativos');

create policy "comprovativos_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'comprovativos')
  with check (bucket_id = 'comprovativos');

create policy "comprovativos_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'comprovativos');
