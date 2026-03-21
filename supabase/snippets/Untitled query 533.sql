
-- Pastas iniciais por empresa (exemplo da especificação)
do $$
declare
  e record;
  id_fin bigint;
  id_jur bigint;
  id_rh bigint;
begin
  for e in select id from public.empresas
  loop
    if exists (select 1 from public.gestao_documentos_pastas where empresa_id = e.id) then
      continue;
    end if;

    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem)
    values (e.id, null, 'Financeiro', 1)
    returning id into id_fin;
    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem) values
      (e.id, id_fin, 'Orçamentos', 1),
      (e.id, id_fin, 'Pagamentos', 2);

    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem)
    values (e.id, null, 'Jurídico', 2)
    returning id into id_jur;
    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem) values
      (e.id, id_jur, 'Contratos', 1),
      (e.id, id_jur, 'Processos', 2);

    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem)
    values (e.id, null, 'RH', 3)
    returning id into id_rh;
    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem) values
      (e.id, id_rh, 'Colaboradores', 1);

    insert into public.gestao_documentos_pastas (empresa_id, parent_id, nome, ordem) values
      (e.id, null, 'Finanças', 4),
      (e.id, null, 'Contabilidade', 5),
      (e.id, null, 'Planeamento', 6),
      (e.id, null, 'Comunicação Interna', 7),
      (e.id, null, 'Geral', 8);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gestao_documentos_arquivos'
  ) then
    alter publication supabase_realtime add table public.gestao_documentos_arquivos;
  end if;
end $$;