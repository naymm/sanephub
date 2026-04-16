-- =============================================================================
-- Módulo Património: activos, movimentações (histórico), verificação mensal
-- =============================================================================

create table if not exists public.patrimonio_activos (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete cascade,
  codigo text not null,
  nome text not null,
  categoria text not null
    check (categoria in ('computador', 'viatura', 'mobiliario', 'equipamento')),
  responsavel_colaborador_id bigint references public.colaboradores (id) on delete set null,
  estado text not null default 'disponivel'
    check (estado in ('disponivel', 'em_uso', 'inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patrimonio_activos_codigo_empresa unique (empresa_id, codigo),
  constraint patrimonio_activos_nome_len check (char_length(trim(nome)) >= 1)
);

create index if not exists idx_patrimonio_activos_empresa on public.patrimonio_activos (empresa_id);
create index if not exists idx_patrimonio_activos_responsavel on public.patrimonio_activos (responsavel_colaborador_id);
create index if not exists idx_patrimonio_activos_estado on public.patrimonio_activos (estado, empresa_id);

comment on table public.patrimonio_activos is 'Activos por empresa; responsável (colaborador) opcional.';

create table if not exists public.patrimonio_movimentos (
  id bigserial primary key,
  activo_id bigint not null references public.patrimonio_activos (id) on delete cascade,
  empresa_id bigint not null references public.empresas (id) on delete cascade,
  tipo text not null
    check (
      tipo in (
        'criacao',
        'atribuir_colaborador',
        'remover_colaborador',
        'transferir_empresa',
        'trocar_responsavel',
        'alterar_estado',
        'edicao_geral'
      )
    ),
  resumo text not null,
  detalhe jsonb not null default '{}'::jsonb,
  actor_perfil_id bigint references public.profiles (id) on delete set null,
  actor_nome text,
  created_at timestamptz not null default now()
);

create index if not exists idx_patrimonio_mov_activo on public.patrimonio_movimentos (activo_id, created_at desc);
create index if not exists idx_patrimonio_mov_empresa on public.patrimonio_movimentos (empresa_id);

comment on table public.patrimonio_movimentos is 'Histórico de alterações a activos (quem, o quê, quando).';

create table if not exists public.patrimonio_verificacoes (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete cascade,
  ano_mes text not null,
  titulo text not null default '',
  fechada boolean not null default false,
  created_by bigint references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint patrimonio_verif_empresa_mes unique (empresa_id, ano_mes)
);

create index if not exists idx_patrimonio_verif_empresa on public.patrimonio_verificacoes (empresa_id);

comment on table public.patrimonio_verificacoes is 'Campanha de verificação mensal por empresa (YYYY-MM).';

create table if not exists public.patrimonio_verificacao_itens (
  id bigserial primary key,
  verificacao_id bigint not null references public.patrimonio_verificacoes (id) on delete cascade,
  activo_id bigint not null references public.patrimonio_activos (id) on delete cascade,
  existe boolean,
  local_correcto boolean,
  responsavel_correcto boolean,
  observacoes text not null default '',
  updated_at timestamptz not null default now(),
  constraint patrimonio_verif_item_unique unique (verificacao_id, activo_id)
);

create index if not exists idx_patrimonio_verif_item_ver on public.patrimonio_verificacao_itens (verificacao_id);

comment on table public.patrimonio_verificacao_itens is 'Respostas por activo na verificação (existe, local, responsável).';

-- RLS (multi-tenant alinhado a notícias / relatórios)
alter table public.patrimonio_activos enable row level security;
alter table public.patrimonio_movimentos enable row level security;
alter table public.patrimonio_verificacoes enable row level security;
alter table public.patrimonio_verificacao_itens enable row level security;

create policy "patrimonio_activos: tenant select"
  on public.patrimonio_activos for select
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_activos.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_activos: tenant insert"
  on public.patrimonio_activos for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_activos.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_activos: tenant update"
  on public.patrimonio_activos for update
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_activos.empresa_id = p.empresa_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_activos.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_activos: tenant delete"
  on public.patrimonio_activos for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_activos.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_movimentos: tenant select"
  on public.patrimonio_movimentos for select
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_movimentos.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_movimentos: tenant insert"
  on public.patrimonio_movimentos for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_movimentos.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_movimentos: tenant update"
  on public.patrimonio_movimentos for update
  using (false);

create policy "patrimonio_movimentos: tenant delete"
  on public.patrimonio_movimentos for delete
  using (false);

create policy "patrimonio_verificacoes: tenant select"
  on public.patrimonio_verificacoes for select
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_verificacoes.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_verificacoes: tenant insert"
  on public.patrimonio_verificacoes for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_verificacoes.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_verificacoes: tenant update"
  on public.patrimonio_verificacoes for update
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_verificacoes.empresa_id = p.empresa_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_verificacoes.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_verificacoes: tenant delete"
  on public.patrimonio_verificacoes for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_verificacoes.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_verificacao_itens: tenant select"
  on public.patrimonio_verificacao_itens for select
  using (
    exists (
      select 1
      from public.patrimonio_verificacoes v
      join public.profiles p on p.auth_user_id = auth.uid()
      where v.id = public.patrimonio_verificacao_itens.verificacao_id
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and v.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_verificacao_itens: tenant insert"
  on public.patrimonio_verificacao_itens for insert
  with check (
    exists (
      select 1
      from public.patrimonio_verificacoes v
      join public.profiles p on p.auth_user_id = auth.uid()
      where v.id = public.patrimonio_verificacao_itens.verificacao_id
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and v.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_verificacao_itens: tenant update"
  on public.patrimonio_verificacao_itens for update
  using (
    exists (
      select 1
      from public.patrimonio_verificacoes v
      join public.profiles p on p.auth_user_id = auth.uid()
      where v.id = public.patrimonio_verificacao_itens.verificacao_id
        and v.fechada = false
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and v.empresa_id = p.empresa_id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.patrimonio_verificacoes v
      join public.profiles p on p.auth_user_id = auth.uid()
      where v.id = public.patrimonio_verificacao_itens.verificacao_id
        and v.fechada = false
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and v.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_verificacao_itens: tenant delete"
  on public.patrimonio_verificacao_itens for delete
  using (
    exists (
      select 1
      from public.patrimonio_verificacoes v
      join public.profiles p on p.auth_user_id = auth.uid()
      where v.id = public.patrimonio_verificacao_itens.verificacao_id
        and v.fechada = false
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and v.empresa_id = p.empresa_id)
        )
    )
  );
