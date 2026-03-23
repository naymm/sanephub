
create policy "actas_audio_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'actas-audio');

create policy "actas_audio_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'actas-audio');

create policy "actas_audio_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'actas-audio')
  with check (bucket_id = 'actas-audio');

create policy "actas_audio_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'actas-audio');