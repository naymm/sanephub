-- Garantir que a tabela requisicoes tem a coluna comprovante (comprovativo de pagamento e conclusão)
alter table public.requisicoes
  add column if not exists comprovante boolean not null default false;

comment on column public.requisicoes.comprovante is 'Comprovativo de pagamento e conclusão anexado';
