-- Notificações: suportar multi-tenant (empresa_id).

alter table public.noticacoes
  add column if not exists empresa_id bigint references public.empresas(id) on delete set null;

create index if not exists idx_notificacoes_empresa_id on public.noticacoes(empresa_id);

