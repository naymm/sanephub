-- Banner opcional no Dashboard (imagem PNG de feriados / celebração), URL pública ou Storage.

alter table public.organizacao_settings
  add column if not exists dashboard_banner_feriados_url text;

comment on column public.organizacao_settings.dashboard_banner_feriados_url is
  'URL da imagem (ex. PNG) para o banner à direita do Dashboard em desktop; vazio = placeholder.';
