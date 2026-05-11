-- Após o Admin repor a senha (Edge Function), o utilizador deve definir uma nova ao entrar.
alter table public.profiles
  add column if not exists obrigar_troca_senha boolean not null default false;

comment on column public.profiles.obrigar_troca_senha is
  'Se true, a intranet obriga a alteração de palavra-passe no próximo acesso (senha reposta pelo Admin).';
