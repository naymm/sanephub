-- Colaboradores novos: primeiro login obriga alterar senha e definir PIN de ponto.

alter table public.profiles
  add column if not exists primeiro_acesso_pendente boolean not null default false;

comment on column public.profiles.primeiro_acesso_pendente is
  'Se true (tipicamente Colaborador recém-criado), a app exige alterar senha e definir PIN antes de continuar.';
