alter table public.documentos_oficiais
  add constraint documentos_oficiais_status_check
    check (status in ('Rascunho', 'Em Revisão', 'Aprovado', 'Publicado', 'Arquivado', 'Assinado'));