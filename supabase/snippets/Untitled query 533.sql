update public.gestao_documentos_pastas
set nome = 'Capital Humano'
where parent_id is null
  and nome = 'RH';