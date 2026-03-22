-- Nível académico (Capital Humano / colaboradores)

alter table public.colaboradores
  add column if not exists nivel_academico text not null default '';

comment on column public.colaboradores.nivel_academico is
  'Ensino Primário a Doutoramento; vazio se não definido.';
