-- Plano de auditorias: natureza (Orgânica / Direccionada), prazo, área direccionada
-- Inspecções às empresas do grupo

alter table public.ci_auditorias
  add column if not exists natureza text,
  add column if not exists prazo date,
  add column if not exists area_direccionada text not null default '';

update public.ci_auditorias
set natureza = 'Orgânica'
where natureza is null;

alter table public.ci_auditorias
  alter column natureza set default 'Orgânica',
  alter column natureza set not null;

alter table public.ci_auditorias drop constraint if exists ci_auditorias_natureza_check;
alter table public.ci_auditorias
  add constraint ci_auditorias_natureza_check
  check (natureza in ('Orgânica', 'Direccionada'));

alter table public.ci_auditorias drop constraint if exists ci_auditorias_tipo_check;
alter table public.ci_auditorias alter column tipo drop not null;
alter table public.ci_auditorias alter column tipo set default 'Operacional';

create index if not exists idx_ci_auditorias_prazo on public.ci_auditorias (prazo);
create index if not exists idx_ci_auditorias_natureza on public.ci_auditorias (natureza);

-- Inspecções
create sequence if not exists ci_inspecao_codigo_seq;

create table if not exists public.ci_inspecoes (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete restrict,
  codigo text not null unique,
  natureza text not null default 'Orgânica' check (natureza in ('Orgânica', 'Direccionada')),
  area_departamento text not null default '',
  area_direccionada text not null default '',
  data_inspecao date,
  prazo date,
  titulo text not null default '',
  descricao text not null default '',
  estado text not null default 'Planeada' check (estado in (
    'Planeada', 'Em curso', 'Concluída', 'Cancelada'
  )),
  inspetor_colaborador_id bigint references public.colaboradores (id) on delete set null,
  observacoes text not null default '',
  created_by_profile_id bigint references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_inspecoes_empresa on public.ci_inspecoes (empresa_id);
create index if not exists idx_ci_inspecoes_estado on public.ci_inspecoes (estado);
create index if not exists idx_ci_inspecoes_prazo on public.ci_inspecoes (prazo);

create or replace function public.ci_inspecoes_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.codigo is null or new.codigo = '' then
    new.codigo := public.ci_next_codigo('CI-INS', 'public.ci_inspecao_codigo_seq'::regclass);
  end if;
  return new;
end;
$$;

drop trigger if exists tr_ci_inspecoes_codigo on public.ci_inspecoes;
create trigger tr_ci_inspecoes_codigo before insert on public.ci_inspecoes
  for each row execute procedure public.ci_inspecoes_before_insert();

drop trigger if exists tr_ci_inspecoes_updated on public.ci_inspecoes;
create trigger tr_ci_inspecoes_updated before update on public.ci_inspecoes
  for each row execute procedure public.ci_set_updated_at();

drop trigger if exists tr_ci_audit_ci_inspecoes on public.ci_inspecoes;
create trigger tr_ci_audit_ci_inspecoes after insert or update or delete on public.ci_inspecoes
  for each row execute procedure public.ci_audit_row_trigger();

alter table public.ci_inspecoes enable row level security;

drop policy if exists "ci_inspecoes_select" on public.ci_inspecoes;
create policy "ci_inspecoes_select" on public.ci_inspecoes for select to authenticated
  using (public.fn_ci_can_manage() or empresa_id = public.fn_ci_user_empresa_id());

drop policy if exists "ci_inspecoes_write" on public.ci_inspecoes;
create policy "ci_inspecoes_write" on public.ci_inspecoes for all to authenticated
  using (public.fn_ci_can_manage())
  with check (public.fn_ci_can_manage());

comment on table public.ci_inspecoes is 'Inspecções realizadas nas empresas — Controlo Interno.';
