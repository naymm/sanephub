-- Adiciona o estado \"Assinado\" aos documentos oficiais
alter table public.documentos_oficiais
  alter column status type text
    using status::text,
  alter column status set default 'Rascunho',
  drop constraint if exists documentos_oficiais_status_check;

alter table public.documentos_oficiais
  add constraint documentos_oficiais_status_check
    check (status in ('Rascunho', 'Em Revisão', 'Aprovado', 'Publicado', 'Arquivado', 'Assinado'));

