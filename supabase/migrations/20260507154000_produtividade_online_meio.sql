-- =============================================================================
-- Produtividade — meio (online): Zoom/Google Meet/Microsoft Teams
-- =============================================================================

alter table public.produtividade_actividades
  add column if not exists meio_online text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'produtividade_actividades_meio_online_check'
  ) then
    alter table public.produtividade_actividades
      add constraint produtividade_actividades_meio_online_check
      check (
        meio_online is null
        or meio_online in ('Zoom', 'Google Meet', 'Microsoft Teams')
      );
  end if;
end $$;

