-- Assinatura digital por utilizador (profiles)
alter table public.profiles
  add column if not exists assinatura_linha text,
  add column if not exists assinatura_cargo text,
  add column if not exists assinatura_imagem_url text;

