-- Atrasos e faltas «Por atrasos» passam a considerar marcações em `biometrico_registros`
-- (`data_hora` sem TZ = relógio local Luanda; `numero_mec` bigint alinhado a `colaboradores.numero_mec` em texto).
-- Mantém compatibilidade com `time_punches` (união: usa a primeira entrada mais cedo do dia entre as duas fontes).

create index if not exists idx_biometrico_registros_numero_mec_data_hora
  on public.biometrico_registros (numero_mec, data_hora);

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

create or replace function public.trg_biometrico_registros_recompute_atrasos()
returns trigger
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_day date;
  v_cid bigint;
begin
  if new.numero_mec is null then
    return new;
  end if;

  v_day := (new.data_hora at time zone 'Africa/Luanda')::date;

  select c.id
  into v_cid
  from public.colaboradores c
  inner join public.empresas e on e.id = c.empresa_id
  where trim(c.numero_mec) <> ''
    and new.numero_mec::text = trim(c.numero_mec)
    and (
      new.empresa is null
      or trim(new.empresa) = ''
      or lower(trim(coalesce(e.nome, ''))) = lower(trim(new.empresa))
      or lower(trim(coalesce(e.codigo, ''))) = lower(trim(new.empresa))
    )
  order by c.id
  limit 1;

  if v_cid is not null then
    perform public.recompute_colaborador_atrasos_mes(v_cid, v_day);
  end if;

  return new;
end;
$body$;

drop trigger if exists biometrico_registros_recompute_atrasos on public.biometrico_registros;

create trigger biometrico_registros_recompute_atrasos
  after insert or update of data_hora, tipo, numero_mec, empresa
  on public.biometrico_registros
  for each row
  execute function public.trg_biometrico_registros_recompute_atrasos();

comment on function public.trg_biometrico_registros_recompute_atrasos() is
  'Recalcula atrasos mensais e faltas «Por atrasos» após marcação biométrica (nº mec. + empresa).';
