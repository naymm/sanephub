-- Colaborador avençado (prestação de serviços): salário cadastrado como líquido; retenção na fonte em vez de INSS/IRT.

alter table public.colaboradores
  add column if not exists is_avencado boolean not null default false;

alter table public.colaboradores
  add column if not exists retencao_percent numeric(4, 2) null;

alter table public.recibos_salario
  add column if not exists retencao numeric(14, 2) not null default 0;

comment on column public.colaboradores.is_avencado is
  'Prestação de serviços (avençado): remuneração cadastrada como líquido; sem INSS/IRT no processamento.';
comment on column public.colaboradores.retencao_percent is
  'Taxa de retenção na fonte (2 ou 6,5) quando is_avencado = true.';
comment on column public.recibos_salario.retencao is
  'Retenção na fonte (avençado). O líquido pago ao colaborador não subtrai esta retenção.';
