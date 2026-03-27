-- Subsídios completos do colaborador (Spring/Primavera-like)

alter table public.colaboradores
  add column if not exists subsidio_natal numeric(18,2) not null default 0;

alter table public.colaboradores
  add column if not exists abono_familia numeric(18,2) not null default 0;

alter table public.colaboradores
  add column if not exists subsidio_turno numeric(18,2) not null default 0;

alter table public.colaboradores
  add column if not exists subsidio_disponibilidade numeric(18,2) not null default 0;

alter table public.colaboradores
  add column if not exists subsidio_risco numeric(18,2) not null default 0;

alter table public.colaboradores
  add column if not exists subsidio_atavio numeric(18,2) not null default 0;

alter table public.colaboradores
  add column if not exists subsidio_representacao numeric(18,2) not null default 0;

comment on column public.colaboradores.subsidio_natal is 'Subsídio de Natal (Kz).';
comment on column public.colaboradores.abono_familia is 'Abono de família (Kz).';
comment on column public.colaboradores.subsidio_turno is 'Subsídio de turno (Kz).';
comment on column public.colaboradores.subsidio_disponibilidade is 'Subsídio de disponibilidade (Kz).';
comment on column public.colaboradores.subsidio_risco is 'Subsídio de risco (Kz).';
comment on column public.colaboradores.subsidio_atavio is 'Subsídio de atavio (Kz).';
comment on column public.colaboradores.subsidio_representacao is 'Subsídio de representação (Kz).';

