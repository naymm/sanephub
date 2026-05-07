-- =============================================================================
-- Produtividade — Participantes/atribuição de actividades (tarefas partilhadas)
-- =============================================================================

create table if not exists public.produtividade_participantes (
  id bigserial primary key,
  actividade_id bigint not null references public.produtividade_actividades(id) on delete cascade,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  role text not null default 'assignee' check (role in ('owner', 'assignee')),
  created_at timestamptz not null default now(),
  unique(actividade_id, colaborador_id)
);

create index if not exists idx_produtividade_participantes_actividade on public.produtividade_participantes(actividade_id);
create index if not exists idx_produtividade_participantes_colaborador on public.produtividade_participantes(colaborador_id);

alter table public.produtividade_participantes enable row level security;

-- Select: quem já tem acesso à actividade (owner/assignee) ou Admin/Director da empresa.
create policy "produtividade_participantes: select own or team"
  on public.produtividade_participantes for select
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_participantes.actividade_id
        and (
          exists (
            select 1 from public.produtividade_participantes pp
            where pp.actividade_id = a.id
              and pp.colaborador_id = p.colaborador_id
          )
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

-- Insert: owner (criador) pode adicionar participantes na sua actividade; Admin/Director pode adicionar na empresa.
create policy "produtividade_participantes: insert by owner or team"
  on public.produtividade_participantes for insert
  with check (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_participantes.actividade_id
        and (
          (a.colaborador_id = p.colaborador_id)
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

-- Delete: só owner ou Admin/Director da empresa.
create policy "produtividade_participantes: delete by owner or team"
  on public.produtividade_participantes for delete
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_participantes.actividade_id
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

-- Trigger: ao criar uma actividade, inserir automaticamente o owner como participante.
create or replace function public.fn_produtividade_add_owner_participant()
returns trigger
language plpgsql
as $$
begin
  insert into public.produtividade_participantes(actividade_id, colaborador_id, role)
  values (new.id, new.colaborador_id, 'owner')
  on conflict (actividade_id, colaborador_id) do nothing;
  return new;
end $$;

drop trigger if exists tr_produtividade_owner_participant on public.produtividade_actividades;
create trigger tr_produtividade_owner_participant
  after insert on public.produtividade_actividades
  for each row
  execute procedure public.fn_produtividade_add_owner_participant();

-- Recriar políticas da actividade e dependentes para usar participantes (tarefas partilhadas)
drop policy if exists "produtividade_actividades: select own or team" on public.produtividade_actividades;
drop policy if exists "produtividade_actividades: update own or team" on public.produtividade_actividades;
drop policy if exists "produtividade_actividades: delete own or team" on public.produtividade_actividades;

create policy "produtividade_actividades: select participants or team"
  on public.produtividade_actividades for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          exists (
            select 1
            from public.produtividade_participantes pp
            where pp.actividade_id = public.produtividade_actividades.id
              and pp.colaborador_id = p.colaborador_id
          )
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and public.produtividade_actividades.empresa_id = p.empresa_id
          )
        )
    )
  );

-- Update: qualquer participante pode actualizar status, etc. Admin/Director também.
create policy "produtividade_actividades: update participants or team"
  on public.produtividade_actividades for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          exists (
            select 1
            from public.produtividade_participantes pp
            where pp.actividade_id = public.produtividade_actividades.id
              and pp.colaborador_id = p.colaborador_id
          )
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
          exists (
            select 1
            from public.produtividade_participantes pp
            where pp.actividade_id = public.produtividade_actividades.id
              and pp.colaborador_id = p.colaborador_id
          )
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and public.produtividade_actividades.empresa_id = p.empresa_id
          )
        )
    )
  );

-- Delete: apenas owner (colaborador_id) ou Admin/Director.
create policy "produtividade_actividades: delete owner or team"
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

-- Entregáveis / Eventos / Comentários: alinhar à regra de participantes
drop policy if exists "produtividade_entregaveis: select own or team" on public.produtividade_entregaveis;
drop policy if exists "produtividade_entregaveis: insert own or team" on public.produtividade_entregaveis;
drop policy if exists "produtividade_entregaveis: update own or team" on public.produtividade_entregaveis;
drop policy if exists "produtividade_entregaveis: delete own or team" on public.produtividade_entregaveis;

create policy "produtividade_entregaveis: select participants or team"
  on public.produtividade_entregaveis for select
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_entregaveis.actividade_id
        and (
          exists (
            select 1 from public.produtividade_participantes pp
            where pp.actividade_id = a.id and pp.colaborador_id = p.colaborador_id
          )
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_entregaveis: insert participants or team"
  on public.produtividade_entregaveis for insert
  with check (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_entregaveis.actividade_id
        and (
          exists (
            select 1 from public.produtividade_participantes pp
            where pp.actividade_id = a.id and pp.colaborador_id = p.colaborador_id
          )
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_entregaveis: update participants or team"
  on public.produtividade_entregaveis for update
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_entregaveis.actividade_id
        and (
          exists (
            select 1 from public.produtividade_participantes pp
            where pp.actividade_id = a.id and pp.colaborador_id = p.colaborador_id
          )
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
      join public.profiles p on p.auth_user_id = auth.uid()
      where a.id = public.produtividade_entregaveis.actividade_id
        and (
          exists (
            select 1 from public.produtividade_participantes pp
            where pp.actividade_id = a.id and pp.colaborador_id = p.colaborador_id
          )
          or (
            p.perfil in ('Admin', 'Director')
            and p.empresa_id is not null
            and a.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "produtividade_entregaveis: delete participants or team"
  on public.produtividade_entregaveis for delete
  using (
    exists (
      select 1
      from public.produtividade_actividades a
      join public.profiles p on p.auth_user_id = auth.uid()
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

