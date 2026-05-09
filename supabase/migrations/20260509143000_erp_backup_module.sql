-- =============================================================================
-- Módulo de backups ERP (PostgreSQL): definições, histórico, fila manual
-- Os scripts shell no host usam SUPERUSER/url interna para INSERT/UPDATE
-- e contornam RLS como dono da relação ou role postgres.
-- =============================================================================

create table if not exists public.erp_backup_settings (
  id smallint primary key default 1 constraint erp_backup_settings_singleton check (id = 1),
  retention_days int not null default 30 constraint erp_backup_settings_ret_pos check (retention_days > 0),
  cron_expression text not null default '0 2 * * *',
  google_drive_upload boolean not null default false,
  backup_database_enabled boolean not null default true,
  backup_storage_enabled boolean not null default true,
  backup_configs_enabled boolean not null default true,
  notify_on_failure boolean not null default true,
  docker_project_dir text null,
  extra_config_paths text[] not null default '{}',
  updated_at timestamptz not null default now()
);

comment on table public.erp_backup_settings is
  'Configurações de backup expostas no ERP (Admin). Credenciais rclone/Google ficam apenas no servidor (.env dos scripts).';

insert into public.erp_backup_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.erp_backup_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  status text not null default 'queued' constraint erp_backup_runs_status_ck check (
    status in ('queued', 'running', 'success', 'partial', 'failed')
  ),
  trigger_source text not null default 'manual' constraint erp_backup_runs_trig_ck check (
    trigger_source in ('manual', 'cron', 'queue')
  ),
  phase text null,
  artifact_database_path text null,
  artifact_storage_path text null,
  artifact_configs_path text null,
  total_bytes bigint null,
  duration_ms int null,
  error_message text null,
  log_summary text null,
  health_ok boolean null,
  checksum_sha256_db text null
);

comment on table public.erp_backup_runs is
  'Histórico de corridas de backup (fila manual, cron, etc.). Artefactos ficam em disco/Drive conforme scripts.';

create index if not exists idx_erp_backup_runs_created on public.erp_backup_runs (created_at desc);
create index if not exists idx_erp_backup_runs_status on public.erp_backup_runs (status) where status in ('queued', 'running');

alter table public.erp_backup_settings enable row level security;
alter table public.erp_backup_runs enable row level security;

drop policy if exists erp_backup_settings_select_admin on public.erp_backup_settings;
create policy erp_backup_settings_select_admin on public.erp_backup_settings
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.perfil = 'Admin')
  );

drop policy if exists erp_backup_settings_update_admin on public.erp_backup_settings;
create policy erp_backup_settings_update_admin on public.erp_backup_settings
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.perfil = 'Admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.perfil = 'Admin')
  );

drop policy if exists erp_backup_runs_select_admin on public.erp_backup_runs;
create policy erp_backup_runs_select_admin on public.erp_backup_runs
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.perfil = 'Admin')
  );

-- Inserções via painel são feitas apenas pela RPC segurança definida.

create or replace function public.is_admin_auth()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid() and p.perfil = 'Admin'
  );
$$;

create or replace function public.erp_admin_request_backup()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin_auth() then
    raise exception 'Apenas administradores podem pedir backups.';
  end if;
  insert into public.erp_backup_runs (status, trigger_source)
  values ('queued', 'manual')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.erp_admin_request_backup() from public;
grant execute on function public.erp_admin_request_backup() to authenticated;

create or replace function public.erp_admin_backup_settings_patch(
  p_retention_days int default null,
  p_cron_expression text default null,
  p_google_drive_upload boolean default null,
  p_backup_database_enabled boolean default null,
  p_backup_storage_enabled boolean default null,
  p_backup_configs_enabled boolean default null,
  p_notify_on_failure boolean default null,
  p_docker_project_dir text default null,
  p_extra_config_paths text[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_auth() then
    raise exception 'Apenas administradores podem alterar definições de backup.';
  end if;
  update public.erp_backup_settings
     set retention_days            = coalesce(p_retention_days, retention_days),
         cron_expression          = coalesce(nullif(trim(p_cron_expression), ''), cron_expression),
         google_drive_upload      = coalesce(p_google_drive_upload, google_drive_upload),
         backup_database_enabled = coalesce(p_backup_database_enabled, backup_database_enabled),
         backup_storage_enabled  = coalesce(p_backup_storage_enabled, backup_storage_enabled),
         backup_configs_enabled  = coalesce(p_backup_configs_enabled, backup_configs_enabled),
         notify_on_failure       = coalesce(p_notify_on_failure, notify_on_failure),
         docker_project_dir      = case when p_docker_project_dir is null then docker_project_dir else nullif(trim(p_docker_project_dir), '') end,
         extra_config_paths      = coalesce(p_extra_config_paths, extra_config_paths),
         updated_at              = now()
   where id = 1;
end;
$$;

revoke all on function public.erp_admin_backup_settings_patch(int, text, boolean, boolean, boolean, boolean, boolean, text, text[]) from public;
grant execute on function public.erp_admin_backup_settings_patch(int, text, boolean, boolean, boolean, boolean, boolean, text, text[]) to authenticated;
