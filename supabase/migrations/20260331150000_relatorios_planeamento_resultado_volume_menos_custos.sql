-- Resultado líquido da demonstração = volume de negócio − custos totais (alinhado ao EBITDA guardado).
update public.relatorios_planeamento
set resultado_liquido = coalesce(ebitda, resultado_liquido);
