-- Anexos do comprovativo e controlo das 48h para anexar a factura final
alter table public.requisicoes
  add column if not exists comprovativo_anexos text[] not null default '{}';

alter table public.requisicoes
  add column if not exists comprovativo_anexado_em timestamptz;

comment on column public.requisicoes.comprovativo_anexado_em is 'Data/hora em que o comprovativo foi anexado (para controle de 48h).';

