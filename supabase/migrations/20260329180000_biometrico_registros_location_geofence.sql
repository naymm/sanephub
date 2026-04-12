-- Colunas para localização e validação por geofence na marcação (ERP / biométrico).
-- A app envia: location_*, geofence_id, is_within_geofence quando o colaborador tem zonas em colaborador_geofences.

alter table public.biometrico_registros
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists geofence_id bigint,
  add column if not exists is_within_geofence boolean;

comment on column public.biometrico_registros.location_lat is 'Latitude WGS84 (ex.: navegador ao marcar pelo ERP).';
comment on column public.biometrico_registros.location_lng is 'Longitude WGS84.';
comment on column public.biometrico_registros.location_accuracy_m is 'Precisão estimada do GPS em metros.';
comment on column public.biometrico_registros.geofence_id is 'Zona de ponto em que a posição foi validada (public.geofences).';
comment on column public.biometrico_registros.is_within_geofence is 'Se a posição cumpriu o raio da geofence indicada.';

-- FK opcional (só se existir public.geofences e ainda não houver esta constraint nesta tabela)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'geofences'
  ) and not exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid and rel.relnamespace = (select oid from pg_namespace where nspname = 'public')
    where c.conname = 'biometrico_registros_geofence_id_fkey'
      and rel.relname = 'biometrico_registros'
  ) then
    alter table public.biometrico_registros
      add constraint biometrico_registros_geofence_id_fkey
      foreign key (geofence_id) references public.geofences (id) on delete set null;
  end if;
end $$;
