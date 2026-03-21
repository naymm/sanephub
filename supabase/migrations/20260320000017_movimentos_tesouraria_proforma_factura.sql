-- Saídas na tesouraria: proforma e/ou factura final (PDFs no bucket proformas via app)
alter table public.movimentos_tesouraria
  add column if not exists proforma_anexos text[] not null default '{}',
  add column if not exists factura_final_anexos text[] not null default '{}';

comment on column public.movimentos_tesouraria.proforma_anexos is 'URLs públicos de PDFs de proforma (saídas).';
comment on column public.movimentos_tesouraria.factura_final_anexos is 'URLs públicos de PDFs de factura final (saídas).';
