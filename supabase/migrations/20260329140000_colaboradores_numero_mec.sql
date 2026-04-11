-- Número mecanográfico do colaborador (identificação interna / folha).

alter table public.colaboradores
  add column if not exists numero_mec text;

comment on column public.colaboradores.numero_mec is 'Número mecanográfico do colaborador.';
