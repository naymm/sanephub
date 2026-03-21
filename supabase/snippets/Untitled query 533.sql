alter table public.gestao_documentos_auditoria
  add constraint gestao_documentos_auditoria_accao_check
  check (accao in ('upload', 'view', 'download', 'delete', 'move'));
