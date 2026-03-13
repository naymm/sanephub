-- Data da nomeação de referência (para despacho de exoneração: "desde o dia X")
alter table public.documentos_oficiais
  add column if not exists data_referencia_nomeacao date;
