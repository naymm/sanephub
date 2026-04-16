-- Quantidade por linha de activo (inventário agregado por código/nome).

alter table public.patrimonio_activos
  add column if not exists quantidade integer not null default 1;

alter table public.patrimonio_activos
  drop constraint if exists patrimonio_activos_quantidade_check;

alter table public.patrimonio_activos
  add constraint patrimonio_activos_quantidade_check check (quantidade >= 1);

comment on column public.patrimonio_activos.quantidade is 'Número de unidades representadas por esta linha de activo.';
