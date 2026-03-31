-- Janeiro 2026 — consolidado alinhado ao dashboard (Volume 443926901.96, Custos 271148522.61, EBITDA 208664170.25, RL 172778379.35, margem líquida ~39%).
-- Proporção por empresa = share de receita do template de referência; INSS/IRT alinhados ao delta EBITDA vs RL.
-- ON CONFLICT (empresa_id, mes_ano) DO NOTHING.

insert into public.relatorios_planeamento (
  empresa_id,
  mes_ano,
  status,
  actividades_comerciais,
  principais_constrangimentos,
  estrategias_receitas,
  estrategias_custos,
  ciclo_vida,
  necessidades_investimento,
  stock_inicial,
  compras_periodo,
  stock_final,
  vendas_produtos,
  vendas_servicos,
  custo_mercadorias_vendidas,
  fornecimento_servicos_externos,
  gastos_pessoal,
  ebitda,
  margem_bruta,
  margem_ebitda,
  juros_financeiros,
  depreciacao_amortizacoes,
  impostos_lucro,
  resultado_liquido,
  saldos_bancarios,
  pendentes_pagamento,
  pendentes_recebimento,
  submetido_em,
  submetido_por
)
select
  e.id,
  '2026-01',
  'Submetido',
  case e.codigo
    when 'SANEP-SGPS' then '["Janeiro: arranque de ano e síntese de indicadores do grupo.","Planeamento trimestral e tesouraria entre unidades."]'
    when 'CREDIANGOLAR' then '["Fecho de ciclo de crédito de Dezembro; arranque de carteira em Janeiro.","Reforço de cobrança e reestruturações ligeiras."]'
    when 'NOVA-FIBREX' then '["Fornecimento e O&M em projectos activos no primeiro mês do ano.","Stock e importações alinhados a obras programadas."]'
    when 'SANEP-LDA' then '["Serviços técnicos e contratos de campo em Janeiro.","Retoma de SLA com clientes institucionais."]'
    when 'SANEP-VIDA' then '["Campanha comercial pós-festas e reforço de parceiros bancários.","Renovação de metas de adesão a produtos simbundos."]'
    else '["Actividade comercial — Janeiro 2026."]'
  end,
  case e.codigo
    when 'SANEP-SGPS' then '["Reforço de liquidez no início do ano.","Harmonização de relatórios entre empresas."]'
    when 'CREDIANGOLAR' then '["Mora residual em alguns segmentos retalhistas."]'
    when 'NOVA-FIBREX' then '["Logística e alfândega em horizonte de picos pontuais."]'
    when 'SANEP-LDA' then '["Custos de mobilidade e materiais em subida."]'
    when 'SANEP-VIDA' then '["Concorrência em canais digitais de seguros."]'
    else '["Constrangimentos operacionais."]'
  end,
  case e.codigo
    when 'SANEP-SGPS' then '["Capital de trabalho e sinergias comerciais.","Cross-selling no grupo."]'
    when 'CREDIANGOLAR' then '["Crédito responsável e produtos associados a seguros."]'
    when 'NOVA-FIBREX' then '["Expansão de rede com operadores."]'
    when 'SANEP-LDA' then '["Contratos de serviço e manutenção."]'
    when 'SANEP-VIDA' then '["Marketing digital e parcerias."]'
    else '["Diversificação de receitas."]'
  end,
  case e.codigo
    when 'SANEP-SGPS' then '["Disciplina de compras consolidadas.","Orçamentos apertados no Q1."]'
    when 'CREDIANGOLAR' then '["Automatização de processos internos."]'
    when 'NOVA-FIBREX' then '["Negociação com fornecedores-chave."]'
    when 'SANEP-LDA' then '["Optimização de horas técnicas e deslocações."]'
    when 'SANEP-VIDA' then '["CAC por canal e parcerias."]'
    else '["Contenção de custos."]'
  end,
  case e.codigo
    when 'SANEP-SGPS' then 'Maturidade'
    when 'CREDIANGOLAR' then 'Crescimento'
    when 'NOVA-FIBREX' then 'Crescimento'
    when 'SANEP-LDA' then 'Maturidade'
    when 'SANEP-VIDA' then 'Startup'
    else 'Crescimento'
  end::text,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"Receita produtos Jan/2026","quantidade":1,"precoUnitario":21169924.51,"total":21169924.51}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"Receita produtos Jan/2026","quantidade":1,"precoUnitario":5452859.34,"total":5452859.34}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"Receita produtos Jan/2026","quantidade":1,"precoUnitario":230944631.08,"total":230944631.08}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"Receita produtos Jan/2026","quantidade":1,"precoUnitario":76981543.69,"total":76981543.69}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"Receita produtos Jan/2026","quantidade":1,"precoUnitario":26943540.29,"total":26943540.29}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"Receita serviços Jan/2026","quantidade":1,"precoUnitario":7698154.37,"total":7698154.37}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"Receita serviços Jan/2026","quantidade":1,"precoUnitario":1796236.02,"total":1796236.02}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"Receita serviços Jan/2026","quantidade":1,"precoUnitario":64151286.41,"total":64151286.41}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"Receita serviços Jan/2026","quantidade":1,"precoUnitario":6094372.21,"total":6094372.21}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"Receita serviços Jan/2026","quantidade":1,"precoUnitario":2694354.03,"total":2694354.03}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"CMV Jan/2026","quantidade":1,"precoUnitario":2812675.24,"total":2812675.24}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"CMV Jan/2026","quantidade":1,"precoUnitario":322548.72,"total":322548.72}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"CMV Jan/2026","quantidade":1,"precoUnitario":110827574.02,"total":110827574.02}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"CMV Jan/2026","quantidade":1,"precoUnitario":19818020.39,"total":19818020.39}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"CMV Jan/2026","quantidade":1,"precoUnitario":6684070.29,"total":6684070.29}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"Serviços externos Jan/2026","quantidade":1,"precoUnitario":958866.56,"total":958866.56}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"Serviços externos Jan/2026","quantidade":1,"precoUnitario":278564.81,"total":278564.81}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"Serviços externos Jan/2026","quantidade":1,"precoUnitario":15832510.57,"total":15832510.57}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"Serviços externos Jan/2026","quantidade":1,"precoUnitario":2236408.55,"total":2236408.55}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"Serviços externos Jan/2026","quantidade":1,"precoUnitario":822246.74,"total":822246.74}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"tipo":"salarios_base","descricao":"Salários base","quantidade":1,"precoUnitario":10665861.81,"total":10665861.81},{"tipo":"subsidios","descricao":"Subsídios","quantidade":1,"precoUnitario":861473.45,"total":861473.45},{"tipo":"inss","descricao":"INSS","quantidade":1,"precoUnitario":435080.5,"total":435080.5},{"tipo":"irt","descricao":"IRT","quantidade":1,"precoUnitario":1898533.07,"total":1898533.07}]'::jsonb
    when 'CREDIANGOLAR' then '[{"tipo":"salarios_base","descricao":"Salários base","quantidade":1,"precoUnitario":2984767.28,"total":2984767.28},{"tipo":"subsidios","descricao":"Subsídios","quantidade":1,"precoUnitario":255837.2,"total":255837.2},{"tipo":"inss","descricao":"INSS","quantidade":1,"precoUnitario":127083.53,"total":127083.53},{"tipo":"irt","descricao":"IRT","quantidade":1,"precoUnitario":458912.77,"total":458912.77}]'::jsonb
    when 'NOVA-FIBREX' then '[{"tipo":"salarios_base","descricao":"Salários base","quantidade":1,"precoUnitario":27683623.4,"total":27683623.4},{"tipo":"subsidios","descricao":"Subsídios","quantidade":1,"precoUnitario":2044813.09,"total":2044813.09},{"tipo":"inss","descricao":"INSS","quantidade":1,"precoUnitario":4840087.4,"total":4840087.4},{"tipo":"irt","descricao":"IRT","quantidade":1,"precoUnitario":19014629.09,"total":19014629.09}]'::jsonb
    when 'SANEP-LDA' then '[{"tipo":"salarios_base","descricao":"Salários base","quantidade":1,"precoUnitario":20428828.04,"total":20428828.04},{"tipo":"subsidios","descricao":"Subsídios","quantidade":1,"precoUnitario":1543511.45,"total":1543511.45},{"tipo":"inss","descricao":"INSS","quantidade":1,"precoUnitario":1222144.31,"total":1222144.31},{"tipo":"irt","descricao":"IRT","quantidade":1,"precoUnitario":5493476.97,"total":5493476.97}]'::jsonb
    when 'SANEP-VIDA' then '[{"tipo":"salarios_base","descricao":"Salários base","quantidade":1,"precoUnitario":7519110.68,"total":7519110.68},{"tipo":"subsidios","descricao":"Subsídios","quantidade":1,"precoUnitario":681419.41,"total":681419.41},{"tipo":"inss","descricao":"INSS","quantidade":1,"precoUnitario":450703.19,"total":450703.19},{"tipo":"irt","descricao":"IRT","quantidade":1,"precoUnitario":1945140.07,"total":1945140.07}]'::jsonb
    else '[{"tipo":"salarios_base","descricao":"","quantidade":1,"precoUnitario":0,"total":0},{"tipo":"subsidios","descricao":"","quantidade":1,"precoUnitario":0,"total":0},{"tipo":"inss","descricao":"","quantidade":1,"precoUnitario":0,"total":0},{"tipo":"irt","descricao":"","quantidade":1,"precoUnitario":0,"total":0}]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then 13569201.82
    when 'CREDIANGOLAR' then 3407377.35
    when 'NOVA-FIBREX' then 138707396.41
    when 'SANEP-LDA' then 39049147.47
    when 'SANEP-VIDA' then 13931047.2
    else 0
  end,
  case e.codigo
    when 'SANEP-SGPS' then 0.902568
    when 'CREDIANGOLAR' then 0.955505
    when 'NOVA-FIBREX' then 0.624435
    when 'SANEP-LDA' then 0.761447
    when 'SANEP-VIDA' then 0.774476
    else 0
  end,
  case e.codigo
    when 'SANEP-SGPS' then 0.470042
    when 'CREDIANGOLAR' then 0.470042
    when 'NOVA-FIBREX' then 0.470042
    when 'SANEP-LDA' then 0.470042
    when 'SANEP-VIDA' then 0.470042
    else 0
  end,
  0::numeric,
  0::numeric,
  0::numeric,
  case e.codigo
    when 'SANEP-SGPS' then 11235588.25
    when 'CREDIANGOLAR' then 2821381.05
    when 'NOVA-FIBREX' then 114852679.91
    when 'SANEP-LDA' then 32333526.19
    when 'SANEP-VIDA' then 11535203.94
    else 0
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"banco":"BFA","numeroConta":"0001","saldoActual":5196254}]'::jsonb
    when 'CREDIANGOLAR' then '[{"banco":"BFA","numeroConta":"0001","saldoActual":1304837}]'::jsonb
    when 'NOVA-FIBREX' then '[{"banco":"BFA","numeroConta":"0001","saldoActual":53117265}]'::jsonb
    when 'SANEP-LDA' then '[{"banco":"BFA","numeroConta":"0001","saldoActual":14953665}]'::jsonb
    when 'SANEP-VIDA' then '[{"banco":"BFA","numeroConta":"0001","saldoActual":5334821}]'::jsonb
    else '[]'::jsonb
  end,
  '[]'::jsonb,
  '[]'::jsonb,
  '2026-02-05 09:00:00+01'::timestamptz,
  'Dashboard consolidado — Janeiro 2026'
from public.empresas e
where e.activo = true
on conflict (empresa_id, mes_ano) do nothing;
