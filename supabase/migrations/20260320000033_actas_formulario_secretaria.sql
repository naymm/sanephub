-- Actas: campos do formulário (presidência, participantes, local/hora/duração, áudio para n8n)

alter table public.actas
  add column if not exists presidida_por bigint references public.colaboradores (id) on delete set null;

alter table public.actas
  add column if not exists participantes_ids bigint[] not null default '{}';

alter table public.actas
  add column if not exists local text not null default '';

alter table public.actas
  add column if not exists hora text not null default '';

alter table public.actas
  add column if not exists duracao text not null default '';

alter table public.actas
  add column if not exists audio_transcricao_path text;

comment on column public.actas.presidida_por is 'Colaborador que presidiu à sessão registada na acta.';
comment on column public.actas.participantes_ids is 'IDs de colaboradores presentes (pode diferir da reunião).';
comment on column public.actas.local is 'Cópia / acta da localização (sincronizável com a reunião).';
comment on column public.actas.hora is 'Hora da sessão (texto livre).';
comment on column public.actas.duracao is 'Duração (texto livre, ex.: 90 min).';
comment on column public.actas.audio_transcricao_path is 'URL ou path no storage do áudio para transcrição (n8n).';

-- Storage: áudio para transcrição
insert into storage.buckets (id, name, public)
values ('actas-audio', 'actas-audio', true)
on conflict (id) do nothing;

drop policy if exists "actas_audio_authenticated_read" on storage.objects;
drop policy if exists "actas_audio_authenticated_insert" on storage.objects;
drop policy if exists "actas_audio_authenticated_update" on storage.objects;
drop policy if exists "actas_audio_authenticated_delete" on storage.objects;

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
