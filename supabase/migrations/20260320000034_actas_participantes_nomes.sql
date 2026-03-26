-- Actas: nomes dos participantes (paralelo a participantes_ids, mesma ordem)

alter table public.actas
  add column if not exists participantes_nomes text[] not null default '{}';

comment on column public.actas.participantes_nomes is
  'Nomes dos colaboradores em participantes_ids, na mesma ordem (denormalizado para relatórios / n8n).';
