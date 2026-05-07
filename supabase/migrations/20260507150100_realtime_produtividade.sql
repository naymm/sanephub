-- Adiciona tabelas de produtividade ao Realtime (supabase_realtime)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'produtividade_actividades')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'produtividade_actividades'
    ) then
    execute 'alter publication supabase_realtime add table public.produtividade_actividades';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'produtividade_entregaveis')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'produtividade_entregaveis'
    ) then
    execute 'alter publication supabase_realtime add table public.produtividade_entregaveis';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'produtividade_eventos')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'produtividade_eventos'
    ) then
    execute 'alter publication supabase_realtime add table public.produtividade_eventos';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'produtividade_comentarios')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'produtividade_comentarios'
    ) then
    execute 'alter publication supabase_realtime add table public.produtividade_comentarios';
  end if;
end $$;

