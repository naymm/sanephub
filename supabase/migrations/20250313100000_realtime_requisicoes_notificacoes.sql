-- Listas e notificações em tempo real (postgres_changes no cliente).
-- Sem isto, INSERT/UPDATE em requisicoes não chegam ao useRealtimeTable.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'requisicoes'
  ) then
    alter publication supabase_realtime add table public.requisicoes;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end $$;
