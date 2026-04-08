-- Dados extra da contraparte em contratos de prestação de serviços (singular = colaborador; colectivo = NIF + denominação).

alter table public.contratos
  add column if not exists contraparte_nif text,
  add column if not exists contraparte_colaborador_id bigint references public.colaboradores(id) on delete set null,
  add column if not exists personalidade_contraparte text;

comment on column public.contratos.contraparte_nif is 'NIF da contraparte quando pessoa colectiva.';
comment on column public.contratos.contraparte_colaborador_id is 'Colaborador quando a contraparte é singular (prestação de serviços).';
comment on column public.contratos.personalidade_contraparte is 'Singular ou Colectivo; aplicável sobretudo a Prestação de Serviços.';
