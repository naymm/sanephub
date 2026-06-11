-- Dados bancários para efectuar o reembolso ao colaborador.

alter table public.reembolsos
  add column if not exists nome_reembolso text,
  add column if not exists iban_reembolso text;

comment on column public.reembolsos.nome_reembolso is 'Titular da conta para transferência do reembolso.';
comment on column public.reembolsos.iban_reembolso is 'IBAN da conta para transferência do reembolso.';
