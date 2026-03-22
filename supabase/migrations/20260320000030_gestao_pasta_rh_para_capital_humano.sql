-- Alinhar nomenclatura à árvore «Capital Humano / Colaboradores» (legado: pasta raiz «RH»).

update public.gestao_documentos_pastas
set nome = 'Capital Humano'
where parent_id is null
  and nome = 'RH';
