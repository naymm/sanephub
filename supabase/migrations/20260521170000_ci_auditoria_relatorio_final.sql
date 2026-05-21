-- Relatório final obrigatório ao concluir auditoria (storage em controlo-interno-evidencias)

alter table public.ci_auditorias
  add column if not exists relatorio_final_storage_path text,
  add column if not exists relatorio_final_nome_ficheiro text,
  add column if not exists relatorio_final_mime_type text,
  add column if not exists relatorio_final_tamanho_bytes bigint,
  add column if not exists relatorio_final_uploaded_at timestamptz;

comment on column public.ci_auditorias.relatorio_final_storage_path is
  'Caminho no bucket controlo-interno-evidencias; preenchido ao passar para Concluída.';
