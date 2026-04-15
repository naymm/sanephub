-- Galeria opcional (até 6 URLs de imagens) além da imagem de capa.
alter table public.noticias
  add column if not exists galeria_urls jsonb not null default '[]'::jsonb;

comment on column public.noticias.galeria_urls is 'Array JSON de URLs públicas (Storage), máx. 6 imagens, ordem da galeria.';
