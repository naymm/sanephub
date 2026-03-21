-- Permitir registo de movimentação de documentos entre pastas na auditoria.

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'gestao_documentos_auditoria'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%accao%'
  loop
    execute format('alter table public.gestao_documentos_auditoria drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.gestao_documentos_auditoria
  add constraint gestao_documentos_auditoria_accao_check
  check (accao in ('upload', 'view', 'download', 'delete', 'move'));
