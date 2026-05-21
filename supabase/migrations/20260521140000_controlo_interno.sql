-- =============================================================================
-- Controlo Interno — Auditoria, NC, Planos de Acção, Riscos, evidências
-- =============================================================================

-- Códigos sequenciais por ano
create sequence if not exists ci_auditoria_codigo_seq;
create sequence if not exists ci_nc_codigo_seq;

create or replace function public.ci_next_codigo(p_prefix text, p_seq regclass)
returns text
language plpgsql
as $$
declare
  v_year text := to_char(current_date, 'YYYY');
  v_n bigint;
begin
  v_n := nextval(p_seq);
  return p_prefix || '-' || v_year || '-' || lpad(v_n::text, 4, '0');
end;
$$;

-- 1. Planeamento / auditorias
create table if not exists public.ci_auditorias (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete restrict,
  codigo text not null unique,
  titulo text not null default '',
  tipo text not null check (tipo in (
    'Financeira', 'Operacional', 'RH', 'Compliance', 'TI', 'Patrimonial', 'Segurança'
  )),
  area_departamento text not null default '',
  auditor_responsavel_colaborador_id bigint references public.colaboradores (id) on delete set null,
  equipa_colaborador_ids bigint[] not null default '{}',
  data_inicio date,
  data_fim date,
  estado text not null default 'Planeada' check (estado in (
    'Planeada', 'Em Execução', 'Concluída', 'Cancelada'
  )),
  objectivo text not null default '',
  escopo text not null default '',
  observacoes text not null default '',
  created_by_profile_id bigint references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_auditorias_empresa on public.ci_auditorias (empresa_id);
create index if not exists idx_ci_auditorias_estado on public.ci_auditorias (estado);
create index if not exists idx_ci_auditorias_datas on public.ci_auditorias (data_inicio, data_fim);

-- 2. Checklist de execução
create table if not exists public.ci_checklist_itens (
  id bigserial primary key,
  auditoria_id bigint not null references public.ci_auditorias (id) on delete cascade,
  ordem int not null default 0,
  pergunta text not null default '',
  criterio_avaliacao text not null default '',
  resultado text check (resultado is null or resultado in (
    'Conforme', 'Não Conforme', 'Parcialmente Conforme', 'Não Aplicável'
  )),
  observacao text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_checklist_auditoria on public.ci_checklist_itens (auditoria_id, ordem);

create table if not exists public.ci_checklist_evidencias (
  id bigserial primary key,
  checklist_item_id bigint not null references public.ci_checklist_itens (id) on delete cascade,
  storage_path text not null,
  nome_ficheiro text not null default '',
  mime_type text not null default 'application/octet-stream',
  tamanho_bytes bigint,
  uploaded_by_profile_id bigint references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_evidencias_item on public.ci_checklist_evidencias (checklist_item_id);

-- 3. Não conformidades
create table if not exists public.ci_nao_conformidades (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete restrict,
  codigo text not null unique,
  auditoria_id bigint references public.ci_auditorias (id) on delete set null,
  checklist_item_id bigint references public.ci_checklist_itens (id) on delete set null,
  titulo text not null default '',
  descricao text not null default '',
  gravidade text not null default 'Médio' check (gravidade in ('Baixo', 'Médio', 'Alto', 'Crítico')),
  area_responsavel text not null default '',
  impacto text not null default '',
  recomendacao text not null default '',
  prazo_resolucao date,
  estado text not null default 'Aberta' check (estado in (
    'Aberta', 'Em Tratamento', 'Resolvida', 'Encerrada'
  )),
  created_by_profile_id bigint references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_nc_empresa on public.ci_nao_conformidades (empresa_id);
create index if not exists idx_ci_nc_estado on public.ci_nao_conformidades (estado);
create index if not exists idx_ci_nc_prazo on public.ci_nao_conformidades (prazo_resolucao);

-- 4. Planos de acção
create table if not exists public.ci_planos_accao (
  id bigserial primary key,
  nao_conformidade_id bigint not null references public.ci_nao_conformidades (id) on delete cascade,
  accao_correctiva text not null default '',
  responsavel_colaborador_id bigint references public.colaboradores (id) on delete set null,
  prazo date,
  estado text not null default 'Pendente' check (estado in (
    'Pendente', 'Em Progresso', 'Concluída', 'Atrasada', 'Cancelada'
  )),
  evidencia_resolucao_path text,
  evidencia_resolucao_nome text,
  comentarios text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_planos_nc on public.ci_planos_accao (nao_conformidade_id);

-- 5. Riscos corporativos
create table if not exists public.ci_riscos (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete restrict,
  titulo text not null default '',
  categoria text not null check (categoria in (
    'Financeiro', 'Operacional', 'Tecnológico', 'Jurídico', 'Reputacional', 'RH'
  )),
  probabilidade int not null default 1 check (probabilidade between 1 and 5),
  impacto int not null default 1 check (impacto between 1 and 5),
  score int generated always as (probabilidade * impacto) stored,
  mitigacao text not null default '',
  responsavel_colaborador_id bigint references public.colaboradores (id) on delete set null,
  estado text not null default 'Identificado' check (estado in (
    'Identificado', 'Em monitorização', 'Mitigado', 'Encerrado'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_riscos_empresa on public.ci_riscos (empresa_id);
create index if not exists idx_ci_riscos_score on public.ci_riscos (score desc);

-- Triggers updated_at
create or replace function public.ci_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tr_ci_auditorias_updated on public.ci_auditorias;
create trigger tr_ci_auditorias_updated before update on public.ci_auditorias
  for each row execute procedure public.ci_set_updated_at();

drop trigger if exists tr_ci_checklist_updated on public.ci_checklist_itens;
create trigger tr_ci_checklist_updated before update on public.ci_checklist_itens
  for each row execute procedure public.ci_set_updated_at();

drop trigger if exists tr_ci_nc_updated on public.ci_nao_conformidades;
create trigger tr_ci_nc_updated before update on public.ci_nao_conformidades
  for each row execute procedure public.ci_set_updated_at();

drop trigger if exists tr_ci_planos_updated on public.ci_planos_accao;
create trigger tr_ci_planos_updated before update on public.ci_planos_accao
  for each row execute procedure public.ci_set_updated_at();

drop trigger if exists tr_ci_riscos_updated on public.ci_riscos;
create trigger tr_ci_riscos_updated before update on public.ci_riscos
  for each row execute procedure public.ci_set_updated_at();

-- Código automático em INSERT
create or replace function public.ci_auditorias_before_insert()
returns trigger language plpgsql as $$
begin
  if new.codigo is null or trim(new.codigo) = '' then
    new.codigo := public.ci_next_codigo('CI-AUD', 'public.ci_auditoria_codigo_seq'::regclass);
  end if;
  return new;
end;
$$;

drop trigger if exists tr_ci_auditorias_codigo on public.ci_auditorias;
create trigger tr_ci_auditorias_codigo before insert on public.ci_auditorias
  for each row execute procedure public.ci_auditorias_before_insert();

create or replace function public.ci_nc_before_insert()
returns trigger language plpgsql as $$
begin
  if new.codigo is null or trim(new.codigo) = '' then
    new.codigo := public.ci_next_codigo('CI-NC', 'public.ci_nc_codigo_seq'::regclass);
  end if;
  return new;
end;
$$;

drop trigger if exists tr_ci_nc_codigo on public.ci_nao_conformidades;
create trigger tr_ci_nc_codigo before insert on public.ci_nao_conformidades
  for each row execute procedure public.ci_nc_before_insert();

-- Auditoria institucional (eventos do módulo CI)
create or replace function public.ci_audit_log(
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_summary text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.intranet_audit_write(
    'controlo_interno',
    p_action,
    p_resource_type,
    p_resource_id,
    p_summary,
    coalesce(p_details, '{}'::jsonb),
    null,
    null,
    null
  );
end;
$$;

create or replace function public.ci_audit_row_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_sum text;
  v_det jsonb;
begin
  if tg_op = 'INSERT' then
    v_id := new.id::text;
    v_sum := tg_table_name || ' criado';
    v_det := jsonb_build_object('after', to_jsonb(new));
    perform public.ci_audit_log('create', tg_table_name, v_id, v_sum, v_det);
    return new;
  elsif tg_op = 'UPDATE' then
    v_id := new.id::text;
    v_sum := tg_table_name || ' actualizado';
    v_det := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
    perform public.ci_audit_log('update', tg_table_name, v_id, v_sum, v_det);
    return new;
  elsif tg_op = 'DELETE' then
    v_id := old.id::text;
    v_sum := tg_table_name || ' eliminado';
    v_det := jsonb_build_object('before', to_jsonb(old));
    perform public.ci_audit_log('delete', tg_table_name, v_id, v_sum, v_det);
    return old;
  end if;
  return coalesce(new, old);
end;
$$;

-- Estender categorias aceites em intranet_audit (se função restrita, apenas CI triggers usam ci_audit_log)
-- Nota: intranet_audit_client_event mantém login/logout; CI usa ci_audit_log → controlo_interno

drop trigger if exists tr_ci_audit_ci_auditorias on public.ci_auditorias;
create trigger tr_ci_audit_ci_auditorias after insert or update or delete on public.ci_auditorias
  for each row execute procedure public.ci_audit_row_trigger();

drop trigger if exists tr_ci_audit_ci_nao_conformidades on public.ci_nao_conformidades;
create trigger tr_ci_audit_ci_nao_conformidades after insert or update or delete on public.ci_nao_conformidades
  for each row execute procedure public.ci_audit_row_trigger();

drop trigger if exists tr_ci_audit_ci_riscos on public.ci_riscos;
create trigger tr_ci_audit_ci_riscos after insert or update or delete on public.ci_riscos
  for each row execute procedure public.ci_audit_row_trigger();

drop trigger if exists tr_ci_audit_ci_planos_accao on public.ci_planos_accao;
create trigger tr_ci_audit_ci_planos_accao after insert or update or delete on public.ci_planos_accao
  for each row execute procedure public.ci_audit_row_trigger();

-- RLS helpers
create or replace function public.fn_ci_user_empresa_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.fn_ci_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.perfil in ('Admin', 'PCA', 'Director')
  );
$$;

alter table public.ci_auditorias enable row level security;
alter table public.ci_checklist_itens enable row level security;
alter table public.ci_checklist_evidencias enable row level security;
alter table public.ci_nao_conformidades enable row level security;
alter table public.ci_planos_accao enable row level security;
alter table public.ci_riscos enable row level security;

-- Auditorias
create policy "ci_auditorias_select" on public.ci_auditorias for select to authenticated
  using (public.fn_ci_can_manage() or empresa_id = public.fn_ci_user_empresa_id());
create policy "ci_auditorias_write" on public.ci_auditorias for all to authenticated
  using (public.fn_ci_can_manage())
  with check (public.fn_ci_can_manage());

-- Checklist (via auditoria)
create policy "ci_checklist_select" on public.ci_checklist_itens for select to authenticated
  using (exists (
    select 1 from public.ci_auditorias a
    where a.id = auditoria_id
      and (public.fn_ci_can_manage() or a.empresa_id = public.fn_ci_user_empresa_id())
  ));
create policy "ci_checklist_write" on public.ci_checklist_itens for all to authenticated
  using (public.fn_ci_can_manage()) with check (public.fn_ci_can_manage());

create policy "ci_evidencias_select" on public.ci_checklist_evidencias for select to authenticated
  using (exists (
    select 1 from public.ci_checklist_itens i
    join public.ci_auditorias a on a.id = i.auditoria_id
    where i.id = checklist_item_id
      and (public.fn_ci_can_manage() or a.empresa_id = public.fn_ci_user_empresa_id())
  ));
create policy "ci_evidencias_write" on public.ci_checklist_evidencias for all to authenticated
  using (public.fn_ci_can_manage()) with check (public.fn_ci_can_manage());

-- NC
create policy "ci_nc_select" on public.ci_nao_conformidades for select to authenticated
  using (public.fn_ci_can_manage() or empresa_id = public.fn_ci_user_empresa_id());
create policy "ci_nc_write" on public.ci_nao_conformidades for all to authenticated
  using (public.fn_ci_can_manage()) with check (public.fn_ci_can_manage());

-- Planos
create policy "ci_planos_select" on public.ci_planos_accao for select to authenticated
  using (exists (
    select 1 from public.ci_nao_conformidades nc
    where nc.id = nao_conformidade_id
      and (public.fn_ci_can_manage() or nc.empresa_id = public.fn_ci_user_empresa_id())
  ));
create policy "ci_planos_write" on public.ci_planos_accao for all to authenticated
  using (public.fn_ci_can_manage()) with check (public.fn_ci_can_manage());

-- Riscos
create policy "ci_riscos_select" on public.ci_riscos for select to authenticated
  using (public.fn_ci_can_manage() or empresa_id = public.fn_ci_user_empresa_id());
create policy "ci_riscos_write" on public.ci_riscos for all to authenticated
  using (public.fn_ci_can_manage()) with check (public.fn_ci_can_manage());

-- Storage evidências CI
insert into storage.buckets (id, name, public)
values ('controlo-interno-evidencias', 'controlo-interno-evidencias', true)
on conflict (id) do nothing;

create policy "ci_storage_read" on storage.objects for select
  using (bucket_id = 'controlo-interno-evidencias');
create policy "ci_storage_write" on storage.objects for insert
  with check (bucket_id = 'controlo-interno-evidencias' and auth.role() = 'authenticated');
create policy "ci_storage_update" on storage.objects for update
  using (bucket_id = 'controlo-interno-evidencias');
create policy "ci_storage_delete" on storage.objects for delete
  using (bucket_id = 'controlo-interno-evidencias');

comment on table public.ci_auditorias is 'Planeamento e execução de auditorias — Controlo Interno.';

-- Leitura de logs institucionais para equipa de Controlo Interno (além de Admin)
drop policy if exists "intranet_audit_events_select_controlo_interno" on public.intranet_audit_events;
create policy "intranet_audit_events_select_controlo_interno"
  on public.intranet_audit_events for select to authenticated
  using (public.fn_ci_can_manage());
