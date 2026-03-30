-- Horário de trabalho e isenção por colaborador; acumulado de atrasos no mês;
-- falta automática tipo «Por atrasos» quando o total de atrasos no mês ≥ 8h (tolerância 15min já incluída no cálculo).

-- ---------- Colaborador: horário e isenção ----------
alter table public.colaboradores
  add column if not exists horario_entrada time not null default time '08:00:00';

alter table public.colaboradores
  add column if not exists horario_saida time not null default time '17:00:00';

alter table public.colaboradores
  add column if not exists isencao_horario boolean not null default false;

comment on column public.colaboradores.horario_entrada is 'Hora normal de entrada (referência para tolerância de 15min antes de contar atraso).';
comment on column public.colaboradores.horario_saida is 'Fim do horário contratual (referência; marcação de saída na app de ponto).';
comment on column public.colaboradores.isencao_horario is 'Se verdadeiro, atrasos não se acumulam e não geram faltas automáticas.';

-- ---------- Faltas: novo tipo e referência de mês ----------
alter table public.faltas
  add column if not exists referencia_mes_atrasos text null;

comment on column public.faltas.referencia_mes_atrasos is 'YYYY-MM para faltas geradas automaticamente por acumulado de atrasos.';

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'faltas'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%Justificada%'
      and pg_get_constraintdef(c.oid) like '%Licença%'
  loop
    execute format('alter table public.faltas drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.faltas
  add constraint faltas_tipo_check
  check (
    tipo in (
      'Justificada',
      'Injustificada',
      'Atestado Médico',
      'Licença',
      'Por atrasos'
    )
  );

-- ---------- Acumulado mensal (para relatórios / consistência) ----------
create table if not exists public.colaborador_mes_atraso (
  id bigserial primary key,
  colaborador_id bigint not null references public.colaboradores (id) on delete cascade,
  mes_ano text not null,
  total_segundos_atraso integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint colaborador_mes_atraso_colaborador_mes unique (colaborador_id, mes_ano)
);

create index if not exists colaborador_mes_atraso_mes_idx on public.colaborador_mes_atraso (mes_ano);

comment on table public.colaborador_mes_atraso is 'Total de segundos de atraso (após tolerância) por colaborador e mês; actualizado ao registar pontos.';

-- ---------- Função: detectar marcação de entrada (kind cast para texto) ----------
create or replace function public.time_punch_is_clock_in_text(kind text)
returns boolean
language sql
immutable
as $fn$
  select lower(coalesce(kind, '')) in ('in', 'entrada', 'clock_in', 'check_in')
     or lower(kind) like 'entrada%';
$fn$;

-- ---------- Recalcular atrasos do mês e gerar faltas ----------
create or replace function public.recompute_colaborador_atrasos_mes(
  p_colaborador_id bigint,
  p_ref_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  c record;
  mes_ano text;
  v_day date;
  v_first timestamptz;
  v_expected timestamptz;
  day_delay_sec integer;
  total_delay_sec integer := 0;
  v_blocks int;
  v_have int;
  v_new int;
  i int;
  v_start date;
  v_end date;
begin
  if p_colaborador_id is null or p_ref_date is null then
    return;
  end if;

  select
    id,
    coalesce(horario_entrada, time '08:00:00') as horario_entrada,
    isencao_horario
  into c
  from public.colaboradores
  where id = p_colaborador_id;

  if not found then
    return;
  end if;

  mes_ano := to_char(p_ref_date, 'YYYY-MM');
  v_start := date_trunc('month', p_ref_date::timestamp)::date;
  v_end := (date_trunc('month', p_ref_date::timestamp) + interval '1 month - 1 day')::date;

  if coalesce(c.isencao_horario, false) then
    insert into public.colaborador_mes_atraso (colaborador_id, mes_ano, total_segundos_atraso, updated_at)
    values (p_colaborador_id, mes_ano, 0, now())
    on conflict (colaborador_id, mes_ano) do update set
      total_segundos_atraso = excluded.total_segundos_atraso,
      updated_at = now();
    return;
  end if;

  for v_day in
    select gs::date
    from generate_series(v_start, v_end, interval '1 day') gs
  loop
    select min(tp.occurred_at)
    into v_first
    from public.time_punches tp
    where tp.colaborador_id = p_colaborador_id
      and (tp.occurred_at at time zone 'Africa/Luanda')::date = v_day
      and public.time_punch_is_clock_in_text(tp.kind::text);

    if v_first is null then
      continue;
    end if;

    v_expected :=
      (v_day::timestamp + (c.horario_entrada + interval '15 minutes'))
      at time zone 'Africa/Luanda';

    if v_first > v_expected then
      day_delay_sec := least(86400, greatest(0, floor(extract(epoch from (v_first - v_expected)))::integer));
      total_delay_sec := total_delay_sec + day_delay_sec;
    end if;
  end loop;

  v_blocks := total_delay_sec / 28800;

  insert into public.colaborador_mes_atraso (colaborador_id, mes_ano, total_segundos_atraso, updated_at)
  values (p_colaborador_id, mes_ano, total_delay_sec, now())
  on conflict (colaborador_id, mes_ano) do update set
    total_segundos_atraso = excluded.total_segundos_atraso,
    updated_at = now();

  select count(*)::int
  into v_have
  from public.faltas f
  where f.colaborador_id = p_colaborador_id
    and f.tipo = 'Por atrasos'
    and f.referencia_mes_atrasos = mes_ano;

  v_new := greatest(0, v_blocks - v_have);

  for i in 1..v_new loop
    insert into public.faltas (colaborador_id, data, tipo, motivo, registado_por, referencia_mes_atrasos)
    values (
      p_colaborador_id,
      p_ref_date,
      'Por atrasos',
      format(
        'Falta automática: acumulado de atrasos no mês %s atingiu pelo menos mais 8 h (após tolerância de 15 min).',
        mes_ano
      ),
      'Sistema',
      mes_ano
    );
  end loop;
end;
$body$;

-- ---------- Trigger ----------
create or replace function public.trg_time_punches_recompute_atrasos()
returns trigger
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_day date;
begin
  if new.colaborador_id is null then
    return new;
  end if;

  v_day := (new.occurred_at at time zone 'Africa/Luanda')::date;
  perform public.recompute_colaborador_atrasos_mes(new.colaborador_id, v_day);
  return new;
end;
$body$;

drop trigger if exists time_punches_recompute_atrasos on public.time_punches;

create trigger time_punches_recompute_atrasos
  after insert or update of occurred_at, kind, colaborador_id
  on public.time_punches
  for each row
  execute function public.trg_time_punches_recompute_atrasos();

-- Recalcular um mês após migração (ajuste id e data dentro do mês):
-- select public.recompute_colaborador_atrasos_mes(<colaborador_id>, '<qualquer-dia-do-mês>'::date);
