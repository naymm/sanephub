-- Desconto por faltas (referência 22 dias úteis no bruto, antes de impostos).

alter table public.recibos_salario
  add column if not exists desconto_faltas numeric(18,2) not null default 0;

alter table public.recibos_salario
  add column if not exists dias_falta_desconto integer not null default 0;

comment on column public.recibos_salario.desconto_faltas is 'Total descontado no bruto por faltas (base+alim.+transp.)/22 por dia, antes de INSS/IRT.';
comment on column public.recibos_salario.dias_falta_desconto is 'N.º de dias de falta que originaram o desconto (Injustificada e Por atrasos no mês).';
