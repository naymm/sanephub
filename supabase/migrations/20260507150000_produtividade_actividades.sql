-- =============================================================================
-- Produtividade — Actividades + Entregáveis (RLS + Storage)
-- =============================================================================

-- 1) Tabelas
create table if not exists public.produtividade_actividades (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,

  tipo_actividade text not null check (tipo_actividade in ('Presencial', 'Online', 'Externa', 'Híbrida')),
  localizacao text check (localizacao in ('Na Empresa', 'Fora da Empresa')),

  titulo text not null,
  descricao text,
  comentario text not null,

  data_actividade date not null,
  prazo date not null,

  prioridade text not null check (prioridade in ('Baixa', 'Média', 'Alta', 'Urgente')),
  categoria text not null check (categoria in ('Administrativa', 'Financeira', 'RH', 'Operacional', 'Jurídica', 'Técnica', 'Outra')),

  possui_entregavel boolean not null default false,

  -- Estados (completo, incluindo Atrasada e Cancelada)
  status text not null default 'Pendente'
    check (status in ('Pendente', 'Em Progresso', 'Concluída', 'Atrasada', 'Cancelada')),

  -- Ordenação no Kanban por coluna
  kanban_order int not null default 0,

  concluida_em timestamptz,
  cancelada_em timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_produtividade_actividades_empresa on public.produtividade_actividades(empresa_id);
create index if not exists idx_produtividade_actividades_colaborador on public.produtividade_actividades(colaborador_id);
create index if not exists idx_produtividade_actividades_status on public.produtividade_actividades(status);
create index if not exists idx_produtividade_actividades_prazo on public.produtividade_actividades(prazo);

create table if not exists public.produtividade_entregaveis (
  id bigserial primary key,
  actividade_id bigint not null references public.produtividade_actividades(id) on delete cascade,
  storage_path text not null,
  nome_ficheiro text not null,
  mime_type text not null,
  tamanho_bytes bigint not null default 0,
  estado text not null default 'Pendente'
    check (estado in ('Pendente', 'Aprovado', 'Rejeitado')),
  uploaded_by_colaborador_id bigint references public.colaboradores(id) on delete set null,
  uploaded_at timestamptz default now(),
  reviewed_by_perfil_id bigint references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text
);

create index if not exists idx_produtividade_entregaveis_actividade on public.produtividade_entregaveis(actividade_id);

-- 2) Triggers utilitários
create or replace function public.fn_produtividade_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tr_produtividade_actividades_updated_at on public.produtividade_actividades;
create trigger tr_produtividade_actividades_updated_at
  before update on public.produtividade_actividades
  for each row execute procedure public.fn_produtividade_set_updated_at();

-- Regra “Atrasada” automática no write:
-- se o prazo já venceu e não está concluída/cancelada, grava como Atrasada.
create or replace function public.fn_produtividade_apply_overdue_status()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('Concluída', 'Cancelada') and new.prazo < current_date then
    new.status := 'Atrasada';
  end if;

  if new.status = 'Concluída' and new.concluida_em is null then
    new.concluida_em := now();
  end if;
  if new.status = 'Cancelada' and new.cancelada_em is null then
    new.cancelada_em := now();
  end if;

  -- consistência: localizacao só faz sentido se Presencial
  if new.tipo_actividade <> 'Presencial' then
    new.localizacao := null;
  end if;
  return new;
end $$;

drop trigger if exists tr_produtividade_actividades_overdue on public.produtividade_actividades;
create trigger tr_produtividade_actividades_overdue
  before insert or update on public.produtividade_actividades
  for each row execute procedure public.fn_produtividade_apply_overdue_status();

-- 3) RLS
alter table public.produtividade_actividades enable row level security;
alter table public.produtividade_entregaveis enable row level security;

-- Colaborador: vê apenas as próprias actividades.
-- Admin/Director: vê actividades da empresa.
create policy "produtividade_actividades: select own or team"
  on public.produtividade_actividades for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          public.produtividade_actividades.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and public.produtividade_actividades.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_actividades: insert own"
  on public.produtividade_actividades for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.colaborador_id is not null
        and public.produtividade_actividades.colaborador_id = p.colaborador_id
        and public.produtividade_actividades.empresa_id = p.empresa_id
    )
  );

create policy "produtividade_actividades: update own or team"
  on public.produtividade_actividades for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          public.produtividade_actividades.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and public.produtividade_actividades.empresa_id = p.empresa_id
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          public.produtividade_actividades.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and public.produtividade_actividades.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_actividades: delete own or team"
  on public.produtividade_actividades for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          public.produtividade_actividades.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and public.produtividade_actividades.empresa_id = p.empresa_id
          )
        )
    )
  );

-- Entregáveis: mesmas regras da actividade pai.
create policy "produtividade_entregaveis: select own or team"
  on public.produtividade_entregaveis for select
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p
        on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_entregaveis.actividade_id
        and (
          a.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_entregaveis: insert own or team"
  on public.produtividade_entregaveis for insert
  with check (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p
        on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_entregaveis.actividade_id
        and (
          a.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_entregaveis: update own or team"
  on public.produtividade_entregaveis for update
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p
        on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_entregaveis.actividade_id
        and (
          a.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p
        on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_entregaveis.actividade_id
        and (
          a.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_entregaveis: delete own or team"
  on public.produtividade_entregaveis for delete
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p
        on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_entregaveis.actividade_id
        and (
          a.colaborador_id = p.colaborador_id
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

-- 4) Storage bucket para entregáveis
insert into storage.buckets (id, name, public)
values ('produtividade-entregaveis', 'produtividade-entregaveis', true)
on conflict (id) do nothing;

create policy "produtividade_entregaveis_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'produtividade-entregaveis');

create policy "produtividade_entregaveis_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'produtividade-entregaveis');

create policy "produtividade_entregaveis_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'produtividade-entregaveis')
  with check (bucket_id = 'produtividade-entregaveis');

create policy "produtividade_entregaveis_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'produtividade-entregaveis');

