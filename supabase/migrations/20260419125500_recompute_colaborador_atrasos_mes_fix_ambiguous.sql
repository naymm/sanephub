-- PG 15+: variável `mes_ano` colidia com a coluna `mes_ano` em `ON CONFLICT (colaborador_id, mes_ano)`.
-- Idempotente: substitui a função criada em 20260419125000 (bases que já aplicaram 250 sem este fix).

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
  v_mes_ano text;
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

  v_mes_ano := to_char(p_ref_date, 'YYYY-MM');
  v_start := date_trunc('month', p_ref_date::timestamp)::date;
  v_end := (date_trunc('month', p_ref_date::timestamp) + interval '1 month - 1 day')::date;

  if coalesce(c.isencao_horario, false) then
    insert into public.colaborador_mes_atraso (colaborador_id, mes_ano, total_segundos_atraso, updated_at)
    values (p_colaborador_id, v_mes_ano, 0, now())
    on conflict (colaborador_id, mes_ano) do update set
      total_segundos_atraso = excluded.total_segundos_atraso,
      updated_at = now();
    return;
  end if;

  for v_day in
    select gs::date
    from generate_series(v_start, v_end, interval '1 day') gs
  loop
    select min(s.ts) into v_first
    from (
      select (b.data_hora at time zone 'Africa/Luanda') as ts
      from public.biometrico_registros b
      inner join public.colaboradores c2 on c2.id = p_colaborador_id
        and b.numero_mec is not null
        and trim(c2.numero_mec) <> ''
        and b.numero_mec::text = trim(c2.numero_mec)
        and (
          b.empresa is null
          or trim(b.empresa) = ''
          or exists (
            select 1
            from public.empresas e
            where e.id = c2.empresa_id
              and (
                lower(trim(coalesce(e.nome, ''))) = lower(trim(b.empresa))
                or lower(trim(coalesce(e.codigo, ''))) = lower(trim(b.empresa))
              )
          )
        )
      where (b.data_hora at time zone 'Africa/Luanda')::date = v_day
        and public.time_punch_is_clock_in_text(b.tipo::text)
      union all
      select tp.occurred_at as ts
      from public.time_punches tp
      where tp.colaborador_id = p_colaborador_id
        and (tp.occurred_at at time zone 'Africa/Luanda')::date = v_day
        and public.time_punch_is_clock_in_text(tp.kind::text)
    ) s
    where s.ts is not null;

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
  values (p_colaborador_id, v_mes_ano, total_delay_sec, now())
  on conflict (colaborador_id, mes_ano) do update set
    total_segundos_atraso = excluded.total_segundos_atraso,
    updated_at = now();

  select count(*)::int
  into v_have
  from public.faltas f
  where f.colaborador_id = p_colaborador_id
    and f.tipo = 'Por atrasos'
    and f.referencia_mes_atrasos = v_mes_ano;

  v_new := greatest(0, v_blocks - v_have);

  for i in 1..v_new loop
    insert into public.faltas (colaborador_id, data, tipo, motivo, registado_por, referencia_mes_atrasos)
    values (
      p_colaborador_id,
      p_ref_date,
      'Por atrasos',
      format(
        'Falta automática: acumulado de atrasos no mês %s atingiu pelo menos mais 8 h (após tolerância de 15 min).',
        v_mes_ano
      ),
      'Sistema',
      v_mes_ano
    );
  end loop;
end;
$body$;
