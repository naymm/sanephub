-- Publicação Realtime para todas as tabelas usadas por useRealtimeTable / gateway SSE.
-- Idempotente: ignora tabelas já na publicação supabase_realtime.

do $$
declare
  t text;
  tables text[] := array[
    'empresas',
    'departamentos',
    'colaboradores',
    'centros_custo',
    'projectos',
    'reunioes',
    'actas',
    'contratos',
    'requisicoes',
    'pagamentos',
    'movimentos_tesouraria',
    'ferias',
    'faltas',
    'recibos_salario',
    'declaracoes',
    'processos_judiciais',
    'prazos_legais',
    'riscos_juridicos',
    'processos_disciplinares',
    'rescisoes_contrato',
    'correspondencias',
    'documentos_oficiais',
    'pendencias_documentais',
    'relatorios_planeamento',
    'notificacoes'
  ];
begin
  foreach t in array tables
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = t
    ) and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
