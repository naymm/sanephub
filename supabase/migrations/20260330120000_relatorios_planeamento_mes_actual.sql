-- Relatórios mensais de planeamento para o mês civil actual (timezone Luanda),
-- uma linha por empresa activa. Dados de exemplo realistas por unidade.
-- Re-execução: ON CONFLICT (empresa_id, mes_ano) DO NOTHING — não apaga nem sobrescreve.

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
  saldos_bancarios,
  pendentes_pagamento,
  pendentes_recebimento
)
select
  e.id,
  to_char((current_timestamp at time zone 'Africa/Luanda')::date, 'YYYY-MM'),
  'Rascunho',
  case e.codigo
    when 'SANEP-SGPS' then '["Operação corrente do grupo e coordenação das unidades.","Reuniões de alinhamento estratégico e reporting consolidado."]'
    when 'CREDIANGOLAR' then '["Concessão e reestruturação de crédito.","Campanha de cobrança cooperativa no período."]'
    when 'NOVA-FIBREX' then '["Fornecimento de fibras e materiais para projectos de rede.","Manutenção de contratos O&M regionais."]'
    when 'SANEP-LDA' then '["Prestação de serviços técnicos em Luanda.","Expansão da base de clientes PME."]'
    when 'SANEP-VIDA' then '["Comercialização de produtos de seguros de vida simbundos.","Parcerias com distribuidores e bancos parceiros."]'
    else '["Actividade comercial no período."]'
  end,
  case e.codigo
    when 'SANEP-SGPS' then '["Pressão cambial e custos de financiamento.","Integração de dados entre unidades."]'
    when 'CREDIANGOLAR' then '["Mora e recuperação de créditos em certos segmentos."]'
    when 'NOVA-FIBREX' then '["Atrasos pontuais na logística de importação."]'
    when 'SANEP-LDA' then '["Concorrência local em serviços especializados."]'
    when 'SANEP-VIDA' then '["Sensibilização de mercado para produtos de longo prazo."]'
    else '["Constrangimentos operacionais gerais."]'
  end,
  case e.codigo
    when 'SANEP-SGPS' then '["Foco em eficiência de capital de trabalho.","Cross-selling entre empresas do grupo."]'
    when 'CREDIANGOLAR' then '["Novos produtos de microcrédito e seguros associados."]'
    when 'NOVA-FIBREX' then '["Projectos de expansão de rede com operadores."]'
    when 'SANEP-LDA' then '["Pacotes de serviço e SLA diferenciados."]'
    when 'SANEP-VIDA' then '["Campanhas digitais e canal bancário."]'
    else '["Diversificação de receitas."]'
  end,
  case e.codigo
    when 'SANEP-SGPS' then '["Centralização de compras do grupo.","Disciplina orçamental por unidade."]'
    when 'CREDIANGOLAR' then '["Automatização de processos de back-office."]'
    when 'NOVA-FIBREX' then '["Negociação com fornecedores estratégicos."]'
    when 'SANEP-LDA' then '["Optimização de deslocações e horas técnicas."]'
    when 'SANEP-VIDA' then '["Redução de custos de aquisição por canal."]'
    else '["Contenção de custos administrativos."]'
  end,
  case e.codigo
    when 'SANEP-SGPS' then 'Maturidade'
    when 'CREDIANGOLAR' then 'Crescimento'
    when 'NOVA-FIBREX' then 'Crescimento'
    when 'SANEP-LDA' then 'Maturidade'
    when 'SANEP-VIDA' then 'Startup'
    else 'Crescimento'
  end::text,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"Licenças software grupo","quantidade":1,"precoUnitario":2500000,"total":2500000},{"descricao":"Hardware rede","quantidade":4,"precoUnitario":800000,"total":3200000}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"Sistema anti-fraude","quantidade":1,"precoUnitario":1800000,"total":1800000}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"Equipamento medição óptica","quantidade":2,"precoUnitario":3200000,"total":6400000}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"Viatura serviço campo","quantidade":1,"precoUnitario":12500000,"total":12500000}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"Plataforma simbunding","quantidade":1,"precoUnitario":950000,"total":950000}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"Matéria-prima A","quantidade":80,"precoUnitario":5200,"total":416000}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"Papel consumíveis","quantidade":120,"precoUnitario":850,"total":102000}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"Bobine fibra","quantidade":40,"precoUnitario":185000,"total":7400000}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"Material técnico","quantidade":200,"precoUnitario":4200,"total":840000}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"Material divulgação","quantidade":500,"precoUnitario":1200,"total":600000}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"Fornecedor global materials","quantidade":1,"precoUnitario":950000,"total":950000},{"descricao":"Serviço logístico","quantidade":1,"precoUnitario":320000,"total":320000}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"Mobiliário sucursal","quantidade":1,"precoUnitario":450000,"total":450000}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"Import fibra especial","quantidade":10,"precoUnitario":980000,"total":9800000}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"Consumíveis campo","quantidade":1,"precoUnitario":280000,"total":280000}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"Impressos e brindes","quantidade":1,"precoUnitario":180000,"total":180000}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"Matéria-prima A","quantidade":65,"precoUnitario":5350,"total":347750}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"Papel consumíveis","quantidade":90,"precoUnitario":880,"total":79200}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"Bobine fibra","quantidade":35,"precoUnitario":190000,"total":6650000}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"Material técnico","quantidade":150,"precoUnitario":4300,"total":645000}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"Material divulgação","quantidade":420,"precoUnitario":1250,"total":525000}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"Produto grupo","quantidade":15,"precoUnitario":220000,"total":3300000}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"Taxas e comissões","quantidade":1,"precoUnitario":850000,"total":850000}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"Cabos e kits","quantidade":800,"precoUnitario":45000,"total":36000000}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"Horas contrato","quantidade":480,"precoUnitario":25000,"total":12000000}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"Prémios simbundos","quantidade":1200,"precoUnitario":3500,"total":4200000}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"Consultoria interna","quantidade":1,"precoUnitario":1200000,"total":1200000}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"Serviços jurídicos","quantidade":1,"precoUnitario":280000,"total":280000}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"Instalação rede","quantidade":4,"precoUnitario":2500000,"total":10000000}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"Suporte técnico","quantidade":1,"precoUnitario":950000,"total":950000}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"Formação rede parceiros","quantidade":1,"precoUnitario":420000,"total":420000}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"CMV","quantidade":15,"precoUnitario":88000,"total":1320000}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"Custo operacional crédito","quantidade":1,"precoUnitario":220000,"total":220000}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"CMV fibras","quantidade":800,"precoUnitario":28000,"total":22400000}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"Custos directos serviço","quantidade":480,"precoUnitario":12000,"total":5760000}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"CMV prémios","quantidade":1200,"precoUnitario":2100,"total":2520000}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"descricao":"Auditoria externa","quantidade":1,"precoUnitario":450000,"total":450000}]'::jsonb
    when 'CREDIANGOLAR' then '[{"descricao":"TI alojado","quantidade":1,"precoUnitario":190000,"total":190000}]'::jsonb
    when 'NOVA-FIBREX' then '[{"descricao":"Subempreiteiros campo","quantidade":1,"precoUnitario":3200000,"total":3200000}]'::jsonb
    when 'SANEP-LDA' then '[{"descricao":"Frota aluguer","quantidade":1,"precoUnitario":650000,"total":650000}]'::jsonb
    when 'SANEP-VIDA' then '[{"descricao":"Marketing externo","quantidade":1,"precoUnitario":310000,"total":310000}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"tipo":"salarios_base","descricao":"Salários base","quantidade":1,"precoUnitario":5200000,"total":5200000},{"tipo":"subsidios","descricao":"Subsídios","quantidade":1,"precoUnitario":420000,"total":420000},{"tipo":"inss","descricao":"INSS","quantidade":1,"precoUnitario":165000,"total":165000},{"tipo":"irt","descricao":"IRT","quantidade":1,"precoUnitario":720000,"total":720000}]'::jsonb
    when 'CREDIANGOLAR' then '[{"tipo":"salarios_base","descricao":"Salários base","quantidade":1,"precoUnitario":2100000,"total":2100000},{"tipo":"subsidios","descricao":"Subsídios","quantidade":1,"precoUnitario":180000,"total":180000},{"tipo":"inss","descricao":"INSS","quantidade":1,"precoUnitario":72000,"total":72000},{"tipo":"irt","descricao":"IRT","quantidade":1,"precoUnitario":260000,"total":260000}]'::jsonb
    when 'NOVA-FIBREX' then '[{"tipo":"salarios_base","descricao":"Salários base","quantidade":1,"precoUnitario":8800000,"total":8800000},{"tipo":"subsidios","descricao":"Subsídios","quantidade":1,"precoUnitario":650000,"total":650000},{"tipo":"inss","descricao":"INSS","quantidade":1,"precoUnitario":280000,"total":280000},{"tipo":"irt","descricao":"IRT","quantidade":1,"precoUnitario":1100000,"total":1100000}]'::jsonb
    when 'SANEP-LDA' then '[{"tipo":"salarios_base","descricao":"Salários base","quantidade":1,"precoUnitario":6750000,"total":6750000},{"tipo":"subsidios","descricao":"Subsídios","quantidade":1,"precoUnitario":510000,"total":510000},{"tipo":"inss","descricao":"INSS","quantidade":1,"precoUnitario":198000,"total":198000},{"tipo":"irt","descricao":"IRT","quantidade":1,"precoUnitario":890000,"total":890000}]'::jsonb
    when 'SANEP-VIDA' then '[{"tipo":"salarios_base","descricao":"Salários base","quantidade":1,"precoUnitario":3200000,"total":3200000},{"tipo":"subsidios","descricao":"Subsídios","quantidade":1,"precoUnitario":290000,"total":290000},{"tipo":"inss","descricao":"INSS","quantidade":1,"precoUnitario":95000,"total":95000},{"tipo":"irt","descricao":"IRT","quantidade":1,"precoUnitario":410000,"total":410000}]'::jsonb
    else '[{"tipo":"salarios_base","descricao":"Salários base","quantidade":1,"precoUnitario":0,"total":0},{"tipo":"subsidios","descricao":"Subsídios","quantidade":1,"precoUnitario":0,"total":0},{"tipo":"inss","descricao":"INSS","quantidade":1,"precoUnitario":0,"total":0},{"tipo":"irt","descricao":"IRT","quantidade":1,"precoUnitario":0,"total":0}]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then 1850000.00
    when 'CREDIANGOLAR' then 120000.00
    when 'NOVA-FIBREX' then 15200000.00
    when 'SANEP-LDA' then 3100000.00
    when 'SANEP-VIDA' then 890000.00
    else 0
  end,
  case e.codigo
    when 'SANEP-SGPS' then 0.42
    when 'CREDIANGOLAR' then 0.35
    when 'NOVA-FIBREX' then 0.38
    when 'SANEP-LDA' then 0.52
    when 'SANEP-VIDA' then 0.40
    else 0
  end,
  case e.codigo
    when 'SANEP-SGPS' then 0.15
    when 'CREDIANGOLAR' then 0.06
    when 'NOVA-FIBREX' then 0.24
    when 'SANEP-LDA' then 0.19
    when 'SANEP-VIDA' then 0.11
    else 0
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"banco":"BFA","numeroConta":"0012345001","saldoActual":8750000},{"banco":"BIC","numeroConta":"0098765002","saldoActual":3200000}]'::jsonb
    when 'CREDIANGOLAR' then '[{"banco":"BFA","numeroConta":"0020001003","saldoActual":1950000}]'::jsonb
    when 'NOVA-FIBREX' then '[{"banco":"BAI","numeroConta":"0035009007","saldoActual":12400000}]'::jsonb
    when 'SANEP-LDA' then '[{"banco":"BFA","numeroConta":"0041008005","saldoActual":4580000}]'::jsonb
    when 'SANEP-VIDA' then '[{"banco":"Standard Bank","numeroConta":"0052003001","saldoActual":2100000}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"nome":"TechSupply Lda","valor":620000},{"nome":"Office Plus","valor":145000}]'::jsonb
    when 'CREDIANGOLAR' then '[{"nome":"Fornecedor equipamentos","valor":98000}]'::jsonb
    when 'NOVA-FIBREX' then '[{"nome":"Import Logistics SA","valor":4100000},{"nome":"Transportes Norte","valor":890000}]'::jsonb
    when 'SANEP-LDA' then '[{"nome":"Fuel & Services","valor":275000}]'::jsonb
    when 'SANEP-VIDA' then '[{"nome":"Agência publicidade","valor":156000}]'::jsonb
    else '[]'::jsonb
  end,
  case e.codigo
    when 'SANEP-SGPS' then '[{"nome":"Cliente Alpha","valor":2100000},{"nome":"Cliente Beta","valor":980000}]'::jsonb
    when 'CREDIANGOLAR' then '[{"nome":"Recuperações Q1","valor":420000}]'::jsonb
    when 'NOVA-FIBREX' then '[{"nome":"Operador Nacional","valor":8900000}]'::jsonb
    when 'SANEP-LDA' then '[{"nome":"Contrato Ministério","valor":3500000}]'::jsonb
    when 'SANEP-VIDA' then '[{"nome":"Comissões corretores","valor":680000}]'::jsonb
    else '[]'::jsonb
  end
from public.empresas e
where e.activo = true
on conflict (empresa_id, mes_ano) do nothing;