-- Campos adicionais de assinatura do PCA para documentos oficiais
alter table public.documentos_oficiais
  add column if not exists pca_assinatura_imagem_url text,
  add column if not exists pca_assinatura_cargo text;

