-- Marcações em `biometrico_registros` (`data_hora` = horário local Luanda; `numero_mec` bigint = mesmo valor em texto em `colaboradores.numero_mec`).
-- Requer migração `20260419125000_recompute_atrasos_biometrico_registros.sql` (deve correr antes deste ficheiro).
-- Opcional: tabela `time_punches` criada se não existir (legado); o recálculo usa biométrico e/ou `time_punches`.
--
-- Cenários (empresa `SEED-ASS-PONTO`, colaboradores `seed-assiduidade-cN@test.invalid`, nº mec. texto `910001`…`910005` = bigint na biométrica):
--   C1 — 6 entradas atrasadas (11:15 vs limite 08:15) → ~6×3 h = 18 h → 2 faltas «Por atrasos» em Abr/2026.
--   C2 — Mesmas marcações que C1 mas `isencao_horario = true` → acumulado 0, sem faltas automáticas.
--   C3 — Licença maternidade 01–30/04/2026 + entrada pontual + falta injustificada 16/04 (teste recibo).
--   C4 — Horário entrada 09:00 (limite 09:15) + 1 entrada tardia; faltas Justificada/Injustificada/Atestado/Licença;
--         `assiduidade_atrasos` (pendente + justificado).
--   C5 — Só entradas pontuais (08:05) → sem atraso contabilizado.
--
-- Limpeza: remove marcações seed (nº mec. 910001–910005), `time_punches` ligados aos colaboradores seed,
-- e colaboradores com e-mail `seed-assiduidade-*@test.invalid`.

-- ---------------------------------------------------------------------------
-- 1) Tabela `time_punches` (se ainda não existir no projecto)
-- ---------------------------------------------------------------------------
create table if not exists public.time_punches (
  id bigserial primary key,
  auth_user_id uuid not null default gen_random_uuid(),
  colaborador_id bigint references public.colaboradores (id) on delete cascade,
  empresa_id bigint references public.empresas (id) on delete set null,
  kind text not null default 'entrada',
  occurred_at timestamptz not null,
  verification_method text,
  face_verified boolean,
  face_confidence double precision,
  pin_verified boolean not null default true,
  selfie_storage_path text,
  location_lat double precision,
  location_lng double precision,
  location_accuracy_m double precision,
  geofence_id bigint,
  is_within_geofence boolean,
  status text not null default 'validado',
  client_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_time_punches_colaborador_occurred
  on public.time_punches (colaborador_id, occurred_at desc);

comment on table public.time_punches is
  'Marcações de ponto (entrada/saída). O trigger `time_punches_recompute_atrasos` recalcula atrasos e faltas «Por atrasos».';

-- ---------------------------------------------------------------------------
-- 2) Seed: empresa + 5 colaboradores + marcações + faltas + licenças + atrasos RH
-- ---------------------------------------------------------------------------
do $$
declare
  v_empresa_id bigint;
  v_empresa_nome text;
  v_codigo text := 'SEED-ASS-PONTO';
  c1 bigint;
  c2 bigint;
  c3 bigint;
  c4 bigint;
  c5 bigint;
  d date;
begin
  -- Empresa dedicada (codigo único)
  insert into public.empresas (codigo, nome, activo)
  values (v_codigo, 'SEED — Assiduidade e ponto', true)
  on conflict (codigo) do update set
    nome = excluded.nome,
    activo = true;

  select e.id into strict v_empresa_id
  from public.empresas e
  where e.codigo = v_codigo
  limit 1;

  select e.nome into strict v_empresa_nome from public.empresas e where e.id = v_empresa_id;

  -- Remover execuções anteriores deste seed
  delete from public.biometrico_registros
  where numero_mec in (910001, 910002, 910003, 910004, 910005);

  delete from public.time_punches
  where colaborador_id in (
    select c.id from public.colaboradores c
    where c.email_corporativo like 'seed-assiduidade-%@test.invalid'
  );
  delete from public.assiduidade_atrasos
  where colaborador_id in (
    select c.id from public.colaboradores c
    where c.email_corporativo like 'seed-assiduidade-%@test.invalid'
  );
  delete from public.assiduidade_licencas
  where colaborador_id in (
    select c.id from public.colaboradores c
    where c.email_corporativo like 'seed-assiduidade-%@test.invalid'
  );
  delete from public.faltas
  where colaborador_id in (
    select c.id from public.colaboradores c
    where c.email_corporativo like 'seed-assiduidade-%@test.invalid'
  );
  delete from public.colaborador_mes_atraso
  where colaborador_id in (
    select c.id from public.colaboradores c
    where c.email_corporativo like 'seed-assiduidade-%@test.invalid'
  );
  delete from public.colaboradores
  where email_corporativo like 'seed-assiduidade-%@test.invalid';

  -- ---------- Colaboradores ----------
  insert into public.colaboradores (
    empresa_id, nome, numero_mec, data_nascimento, genero, estado_civil, bi, nif, niss, nacionalidade,
    endereco, cargo, departamento, data_admissao, tipo_contrato, salario_base,
    subsidio_alimentacao, subsidio_transporte, outros_subsidios, subsidio_risco, subsidio_disponibilidade,
    iban, email_corporativo, telefone_principal, status,
    horario_entrada, horario_saida, isencao_horario
  ) values
    (
      v_empresa_id,
      '[SEED] Atrasos → 2× falta auto (8h)',
      '910001',
      '1990-01-15', 'M', 'Solteiro', 'BI-SEED-01', '500000001LA045', '11111111111', 'Angolana',
      'Luanda', 'Técnico SEED', 'RH', '2020-01-01', 'Efectivo', 450000,
      30000, 20000, 10000, 5000, 5000,
      'AO06000000000000000000000', 'seed-assiduidade-c1@test.invalid', '900000001', 'Activo',
      time '08:00:00', time '17:00:00', false
    ),
    (
      v_empresa_id,
      '[SEED] Isenção — atrasos não contam',
      '910002',
      '1991-02-15', 'F', 'Solteira', 'BI-SEED-02', '500000002LA045', '22222222222', 'Angolana',
      'Luanda', 'Técnico SEED', 'RH', '2020-01-01', 'Efectivo', 450000,
      30000, 20000, 0, 0, 0,
      'AO06000000000000000000001', 'seed-assiduidade-c2@test.invalid', '900000002', 'Activo',
      time '08:00:00', time '17:00:00', true
    ),
    (
      v_empresa_id,
      '[SEED] Licença maternidade (Abr/2026)',
      '910003',
      '1992-03-10', 'F', 'Casada', 'BI-SEED-03', '500000003LA045', '33333333333', 'Angolana',
      'Luanda', 'Técnico SEED', 'RH', '2019-06-01', 'Efectivo', 600000,
      35000, 25000, 15000, 8000, 8000,
      'AO06000000000000000000002', 'seed-assiduidade-c3@test.invalid', '900000003', 'Activo',
      time '08:00:00', time '17:00:00', false
    ),
    (
      v_empresa_id,
      '[SEED] Faltas variadas + atrasos RH',
      '910004',
      '1993-04-20', 'M', 'Solteiro', 'BI-SEED-04', '500000004LA045', '44444444444', 'Angolana',
      'Luanda', 'Técnico SEED', 'RH', '2021-03-01', 'Efectivo', 520000,
      32000, 22000, 12000, 6000, 6000,
      'AO06000000000000000000003', 'seed-assiduidade-c4@test.invalid', '900000004', 'Activo',
      time '09:00:00', time '18:00:00', false
    ),
    (
      v_empresa_id,
      '[SEED] Pontual — sem atraso',
      '910005',
      '1994-05-05', 'M', 'Solteiro', 'BI-SEED-05', '500000005LA045', '55555555555', 'Angolana',
      'Luanda', 'Técnico SEED', 'RH', '2022-01-10', 'Efectivo', 400000,
      30000, 20000, 0, 0, 0,
      'AO06000000000000000000004', 'seed-assiduidade-c5@test.invalid', '900000005', 'Activo',
      time '08:00:00', time '17:00:00', false
    );

  select id into strict c1 from public.colaboradores where email_corporativo = 'seed-assiduidade-c1@test.invalid';
  select id into strict c2 from public.colaboradores where email_corporativo = 'seed-assiduidade-c2@test.invalid';
  select id into strict c3 from public.colaboradores where email_corporativo = 'seed-assiduidade-c3@test.invalid';
  select id into strict c4 from public.colaboradores where email_corporativo = 'seed-assiduidade-c4@test.invalid';
  select id into strict c5 from public.colaboradores where email_corporativo = 'seed-assiduidade-c5@test.invalid';

  -- ---------- C1 + C2: mesmas 6 entradas atrasadas (11:15 local; limite 08:15) = 3h/dia ----------
  foreach d in array array[
    date '2026-04-07',
    date '2026-04-08',
    date '2026-04-09',
    date '2026-04-10',
    date '2026-04-13',
    date '2026-04-14'
  ]
  loop
    insert into public.biometrico_registros (numero_mec, data_hora, tipo, empresa, via)
    values
      (910001::bigint, (d + time '11:15:00')::timestamp, 'entrada', v_empresa_nome, 'seed'),
      (910002::bigint, (d + time '11:15:00')::timestamp, 'entrada', v_empresa_nome, 'seed');

    insert into public.biometrico_registros (numero_mec, data_hora, tipo, empresa, via)
    values (910001::bigint, (d + time '17:30:00')::timestamp, 'saida', v_empresa_nome, 'seed');
  end loop;

  -- ---------- C3: entrada pontual num dia + falta injustificada (fora da licença) ----------
  insert into public.biometrico_registros (numero_mec, data_hora, tipo, empresa, via)
  values (910003::bigint, timestamp '2026-04-05 08:05:00', 'entrada', v_empresa_nome, 'seed');

  insert into public.faltas (colaborador_id, data, tipo, motivo, registado_por)
  values (
    c3,
    '2026-04-16',
    'Injustificada',
    '[SEED] Falta no meio do mês de maternidade (teste de recibo)',
    'SEED'
  );

  insert into public.assiduidade_licencas (colaborador_id, empresa_id, tipo, data_inicio, data_fim, observacoes)
  values (
    c3,
    v_empresa_id,
    'maternidade',
    '2026-04-01',
    '2026-04-30',
    '[SEED] Licença de maternidade Abril/2026'
  );

  -- ---------- C4: horário 09:00 + 15min → limite 09:15; entrada 12:15 = 3h atraso ----------
  insert into public.biometrico_registros (numero_mec, data_hora, tipo, empresa, via)
  values (910004::bigint, timestamp '2026-04-15 12:15:00', 'entrada', v_empresa_nome, 'seed');

  insert into public.faltas (colaborador_id, data, tipo, motivo, registado_por, referencia_mes_atrasos)
  values
    (c4, '2026-04-02', 'Justificada', '[SEED] Justificada — só subsídios', 'SEED', null),
    (c4, '2026-04-03', 'Injustificada', '[SEED] Injustificada — base + subsídios', 'SEED', null),
    (c4, '2026-04-04', 'Atestado Médico', '[SEED] Atestado — como justificada nos subsídios', 'SEED', null),
    (c4, '2026-04-05', 'Licença', '[SEED] Licença (tipo falta) — como justificada nos subsídios', 'SEED', null);

  insert into public.assiduidade_atrasos (
    colaborador_id, empresa_id, data_ref, minutos_atraso, justificado, justificacao, justificado_em, registado_por
  ) values
    (c4, v_empresa_id, '2026-04-20', 40, false, '', null, 'SEED'),
    (
      c4,
      v_empresa_id,
      '2026-04-21',
      25,
      true,
      '[SEED] Justificado no mesmo dia (cenário RH)',
      make_timestamptz(2026, 4, 21, 16, 0, 0, 'Africa/Luanda'),
      'SEED'
    );

  -- ---------- C5: três dias pontuais (08:05) ----------
  foreach d in array array[date '2026-04-01', date '2026-04-02', date '2026-04-03']
  loop
    insert into public.biometrico_registros (numero_mec, data_hora, tipo, empresa, via)
    values (910005::bigint, (d + time '08:05:00')::timestamp, 'entrada', v_empresa_nome, 'seed');
  end loop;

  -- Garantir recálculo final do mês Abril/2026 para todos (útil se o trigger já tiver corrido)
  perform public.recompute_colaborador_atrasos_mes(c1, '2026-04-10'::date);
  perform public.recompute_colaborador_atrasos_mes(c2, '2026-04-10'::date);
  perform public.recompute_colaborador_atrasos_mes(c3, '2026-04-10'::date);
  perform public.recompute_colaborador_atrasos_mes(c4, '2026-04-15'::date);
  perform public.recompute_colaborador_atrasos_mes(c5, '2026-04-02'::date);
end $$;
