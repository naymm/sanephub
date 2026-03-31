-- Encargos após EBITDA e resultado líquido (consolidável no dashboard).
alter table public.relatorios_planeamento
  add column if not exists juros_financeiros numeric(18,2) not null default 0,
  add column if not exists depreciacao_amortizacoes numeric(18,2) not null default 0,
  add column if not exists impostos_lucro numeric(18,2) not null default 0,
  add column if not exists resultado_liquido numeric(18,2);

update public.relatorios_planeamento
set resultado_liquido =
  coalesce(ebitda, 0)
  - coalesce(juros_financeiros, 0)
  - coalesce(depreciacao_amortizacoes, 0)
  - coalesce(impostos_lucro, 0)
where resultado_liquido is null;
