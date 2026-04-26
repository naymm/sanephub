-- Exemplo de insert alinhado ao esquema actual de `biometrico_registros`:
--   numero_mec bigint, data_hora timestamp without time zone (horário local Luanda),
--   tipo text (ex.: entrada / saida), empresa text (nome ou código da empresa), via text opcional.
--
-- O recálculo de atrasos (`recompute_colaborador_atrasos_mes`) cruza `numero_mec` com `trim(colaboradores.numero_mec)`
-- e `empresa` com `empresas.nome` ou `empresas.codigo` (case-insensitive).

/*
insert into public.biometrico_registros (numero_mec, data_hora, tipo, empresa, via)
values
  (910001, timestamp '2026-04-07 11:15:00', 'entrada', 'SEED — Assiduidade e ponto', 'manual'),
  (910001, timestamp '2026-04-07 17:30:00', 'saida', 'SEED — Assiduidade e ponto', 'manual');
*/
