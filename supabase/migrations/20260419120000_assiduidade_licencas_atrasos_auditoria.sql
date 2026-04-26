-- Assiduidade: licenças (ex. maternidade), atrasos com justificação no mesmo dia, auditoria.

create table if not exists public.assiduidade_licencas (
  id bigserial primary key,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  tipo text not null default 'maternidade' check (tipo in ('maternidade', 'outro')),
  data_inicio date not null,
  data_fim date not null,
  observacoes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (data_fim >= data_inicio)
);

create index if not exists idx_assiduidade_licencas_colab on public.assiduidade_licencas(colaborador_id);
create index if not exists idx_assiduidade_licencas_empresa on public.assiduidade_licencas(empresa_id);
create index if not exists idx_assiduidade_licencas_datas on public.assiduidade_licencas(data_inicio, data_fim);

create table if not exists public.assiduidade_atrasos (
  id bigserial primary key,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  data_ref date not null,
  minutos_atraso integer not null default 0 check (minutos_atraso >= 0),
  justificado boolean not null default false,
  justificacao text default '',
  justificado_em timestamptz,
  registado_por text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (colaborador_id, data_ref)
);

create index if not exists idx_assiduidade_atrasos_colab on public.assiduidade_atrasos(colaborador_id);
create index if not exists idx_assiduidade_atrasos_empresa on public.assiduidade_atrasos(empresa_id);

create table if not exists public.assiduidade_auditoria (
  id bigserial primary key,
  empresa_id bigint references public.empresas(id) on delete set null,
  colaborador_id bigint references public.colaboradores(id) on delete set null,
  accao text not null,
  entidade text not null,
  entidade_id bigint,
  detalhe jsonb,
  actor text not null default '',
  created_at timestamptz default now()
);

create index if not exists idx_assiduidade_auditoria_created on public.assiduidade_auditoria(created_at desc);

alter table public.assiduidade_licencas enable row level security;
alter table public.assiduidade_atrasos enable row level security;
alter table public.assiduidade_auditoria enable row level security;

create policy "assiduidade_licencas: authenticated select"
  on public.assiduidade_licencas for select to authenticated using (true);
create policy "assiduidade_licencas: authenticated insert"
  on public.assiduidade_licencas for insert to authenticated with check (true);
create policy "assiduidade_licencas: authenticated update"
  on public.assiduidade_licencas for update to authenticated using (true) with check (true);
create policy "assiduidade_licencas: authenticated delete"
  on public.assiduidade_licencas for delete to authenticated using (true);

create policy "assiduidade_atrasos: authenticated select"
  on public.assiduidade_atrasos for select to authenticated using (true);
create policy "assiduidade_atrasos: authenticated insert"
  on public.assiduidade_atrasos for insert to authenticated with check (true);
create policy "assiduidade_atrasos: authenticated update"
  on public.assiduidade_atrasos for update to authenticated using (true) with check (true);
create policy "assiduidade_atrasos: authenticated delete"
  on public.assiduidade_atrasos for delete to authenticated using (true);

create policy "assiduidade_auditoria: authenticated select"
  on public.assiduidade_auditoria for select to authenticated using (true);
create policy "assiduidade_auditoria: authenticated insert"
  on public.assiduidade_auditoria for insert to authenticated with check (true);

comment on table public.assiduidade_licencas is 'Licenças de assiduidade (maternidade, etc.) para integração com processamento salarial.';
comment on table public.assiduidade_atrasos is 'Atrasos por dia; justificação permitida apenas no mesmo dia civil.';
comment on table public.assiduidade_auditoria is 'Registo de auditoria de acções em assiduidade.';
