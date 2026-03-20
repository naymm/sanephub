-- =============================================================================
-- GRUPO SANEP — Comunicação Interna
-- Adiciona tabelas novas à publicação Supabase Realtime (supabase_realtime)
-- =============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'noticias',
    'eventos'
  ];
begin
  foreach t in array tables
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = t
    ) and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

