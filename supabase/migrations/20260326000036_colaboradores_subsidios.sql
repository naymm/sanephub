-- Subsídios recorrentes do colaborador (para pré-preencher processamento de salários)

alter table public.colaboradores
  add column if not exists subsidio_alimentacao numeric(18,2) not null default 0;

alter table public.colaboradores
  add column if not exists subsidio_transporte numeric(18,2) not null default 0;

alter table public.colaboradores
  add column if not exists outros_subsidios numeric(18,2) not null default 0;

comment on column public.colaboradores.subsidio_alimentacao is 'Subsídio mensal de alimentação (Kz).';
comment on column public.colaboradores.subsidio_transporte is 'Subsídio mensal de transporte (Kz).';
comment on column public.colaboradores.outros_subsidios is 'Outros subsídios mensais (Kz).';

