-- Bucket público para anexos de chat (Microsoft Viewer precisa de URL HTTPS acessível sem sessão do browser).
insert into storage.buckets (id, name, public)
values ('intranet-chat-attachments', 'intranet-chat-attachments', true)
on conflict (id) do nothing;

drop policy if exists "intranet_chat_attachments_select" on storage.objects;
create policy "intranet_chat_attachments_select"
  on storage.objects for select
  using (bucket_id = 'intranet-chat-attachments');

drop policy if exists "intranet_chat_attachments_insert" on storage.objects;
create policy "intranet_chat_attachments_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'intranet-chat-attachments');

drop policy if exists "intranet_chat_attachments_update" on storage.objects;
create policy "intranet_chat_attachments_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'intranet-chat-attachments')
  with check (bucket_id = 'intranet-chat-attachments');

drop policy if exists "intranet_chat_attachments_delete" on storage.objects;
create policy "intranet_chat_attachments_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'intranet-chat-attachments');

comment on policy "intranet_chat_attachments_select" on storage.objects is
  'Leitura pública dos objectos deste bucket (URL pública + Microsoft Viewer). Caminhos opacos (UUID).';
