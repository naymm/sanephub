-- A tabela de auditoria não deve estar na publicação Realtime: muitos INSERTs e pouco ganho
-- (o painel Admin usa paginação + polling leve). Remove se tiver sido adicionada na migração inicial.

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'intranet_audit_events'
  ) then
    alter publication supabase_realtime drop table public.intranet_audit_events;
  end if;
end $$;
