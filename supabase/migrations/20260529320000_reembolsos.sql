-- Reembolsos de despesas (individual ou em lote) — fluxo colaborador → Finanças.

create table if not exists public.reembolsos (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete cascade,
  num text not null,
  tipo text not null check (tipo in ('individual', 'lote')),
  status text not null default 'Pendente' check (
    status in ('Pendente', 'Em Análise', 'Aguarda Correcção', 'Aprovado', 'Rejeitado', 'Pago')
  ),
  solicitante_colaborador_id bigint not null references public.colaboradores (id) on delete restrict,
  data date not null default current_date,
  montante_total numeric(18, 2) not null default 0,
  observacoes text,
  motivo_rejeicao text,
  motivo_correcao text,
  aprovado_por text,
  data_pagamento date,
  comprovativo_pagamento_anexos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reembolsos_num_empresa unique (empresa_id, num)
);

create index if not exists idx_reembolsos_empresa on public.reembolsos (empresa_id);
create index if not exists idx_reembolsos_solicitante on public.reembolsos (solicitante_colaborador_id);
create index if not exists idx_reembolsos_status on public.reembolsos (status);

create table if not exists public.reembolso_linhas (
  id bigserial primary key,
  reembolso_id bigint not null references public.reembolsos (id) on delete cascade,
  ordem int not null default 0,
  nome_entidade text not null,
  descricao text not null default '',
  montante numeric(18, 2) not null,
  recibo_anexos text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_reembolso_linhas_reembolso on public.reembolso_linhas (reembolso_id);

alter table public.movimentos_tesouraria
  add column if not exists reembolso_id bigint references public.reembolsos (id) on delete set null;

create index if not exists idx_movimentos_tesouraria_reembolso on public.movimentos_tesouraria (reembolso_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reembolsos'
  ) then
    alter publication supabase_realtime add table public.reembolsos;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reembolso_linhas'
  ) then
    alter publication supabase_realtime add table public.reembolso_linhas;
  end if;
end $$;

comment on table public.reembolsos is 'Pedidos de reembolso de despesas (individual ou lote).';
comment on table public.reembolso_linhas is 'Linhas de um pedido de reembolso (entidade, descrição, montante, recibo).';
