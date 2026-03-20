-- Dados da assinatura digital de quem emitiu a declaração (para PDF idêntico no portal)
alter table public.declaracoes
  add column if not exists emitente_assinatura_cargo text,
  add column if not exists emitente_assinatura_imagem_url text;

comment on column public.declaracoes.emitente_assinatura_cargo is 'Cargo/linha de assinatura do emitente no momento da emissão.';
comment on column public.declaracoes.emitente_assinatura_imagem_url is 'URL da imagem de assinatura do emitente (ex. Supabase Storage) na emissão.';
