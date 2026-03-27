-- Tabela do IRT (imposto sobre rendimento do trabalho)
-- Valores extraídos da imagem anexada.

create table if not exists public.irt_escalaes (
  id bigserial primary key,
  ordem integer not null unique,
  valor_min numeric(18,2) not null,
  valor_max numeric(18,2),
  parcela_fixa numeric(18,2) not null,
  taxa_percent numeric(7,4) not null,
  excesso_de numeric(18,2) not null
);

-- Valores fixos (por ordem)
insert into public.irt_escalaes (ordem, valor_min, valor_max, parcela_fixa, taxa_percent, excesso_de) values
  (1, 0, 150000, 0, 0, 0),
  (2, 150000, 200000, 12500, 16, 150000),
  (3, 200000, 300000, 31250, 18, 200000),
  (4, 300000, 500000, 49250, 19, 300000),
  (5, 500000, 1000000, 87250, 20, 500000),
  (6, 1000000, 1500000, 187250, 21, 1000000),
  (7, 1500000, 2000000, 292250, 22, 1500000),
  (8, 2000000, 2500000, 402250, 23, 2000000),
  (9, 2500000, 5000000, 517250, 24, 2500000),
  (10, 5000000, 10000000, 1117250, 24.5, 5000000),
  (11, 10000000, null, 2342250, 25, 10000000)
on conflict (ordem) do nothing;

comment on table public.irt_escalaes is 'Escalões e taxas para cálculo do IRT.';

