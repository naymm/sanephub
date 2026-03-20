-- =============================================================================
-- Finanças: catálogo de bancos (Admin), contas bancárias por empresa (Finanças),
-- e ligação à tesouraria (movimentos.conta_bancaria_id + actualização de saldo).
-- =============================================================================

-- 1) Bancos (catálogo global)
create table if not exists public.bancos (
  id bigserial primary key,
  nome text not null,
  codigo text,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_bancos_nome_lower on public.bancos (lower(trim(nome)));

comment on table public.bancos is 'Catálogo de bancos. CRUD apenas Admin.';

-- 2) Contas bancárias (empresa × banco × número; várias contas por empresa)
create table if not exists public.contas_bancarias (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  banco_id bigint not null references public.bancos(id) on delete restrict,
  numero_conta text not null,
  saldo_actual numeric(18,2) not null default 0,
  descricao text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (empresa_id, banco_id, numero_conta)
);

create index if not exists idx_contas_bancarias_empresa on public.contas_bancarias(empresa_id);
create index if not exists idx_contas_bancarias_banco on public.contas_bancarias(banco_id);

comment on table public.contas_bancarias is 'Contas por empresa e banco. Saldo actualizado por movimentos de tesouraria (trigger).';

-- 3) Movimentos: conta opcional
alter table public.movimentos_tesouraria
  add column if not exists conta_bancaria_id bigint references public.contas_bancarias(id) on delete set null;

create index if not exists idx_movimentos_tesouraria_conta on public.movimentos_tesouraria(conta_bancaria_id);

-- 4) Garantir que a conta pertence à mesma empresa que o movimento
create or replace function public.fn_movimentos_tesouraria_check_conta()
returns trigger
language plpgsql
as $$
begin
  if new.conta_bancaria_id is not null then
    if not exists (
      select 1
      from public.contas_bancarias c
      where c.id = new.conta_bancaria_id
        and c.empresa_id = new.empresa_id
    ) then
      raise exception 'conta_bancaria_id deve pertencer à mesma empresa do movimento';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_movimentos_tesouraria_check_conta on public.movimentos_tesouraria;
create trigger tr_movimentos_tesouraria_check_conta
  before insert or update of conta_bancaria_id, empresa_id
  on public.movimentos_tesouraria
  for each row
  execute procedure public.fn_movimentos_tesouraria_check_conta();

-- 5) Actualizar saldo da conta em INSERT/UPDATE/DELETE de movimentos (SECURITY DEFINER)
create or replace function public.fn_movimentos_tesouraria_atualiza_saldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta numeric;
begin
  if tg_op = 'DELETE' then
    if old.conta_bancaria_id is not null then
      delta := case when old.tipo = 'entrada' then -old.valor else old.valor end;
      update public.contas_bancarias
      set saldo_actual = saldo_actual + delta, updated_at = now()
      where id = old.conta_bancaria_id;
    end if;
    return old;
  elsif tg_op = 'INSERT' then
    if new.conta_bancaria_id is not null then
      delta := case when new.tipo = 'entrada' then new.valor else -new.valor end;
      update public.contas_bancarias
      set saldo_actual = saldo_actual + delta, updated_at = now()
      where id = new.conta_bancaria_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.conta_bancaria_id is not null then
      delta := case when old.tipo = 'entrada' then -old.valor else old.valor end;
      update public.contas_bancarias
      set saldo_actual = saldo_actual + delta, updated_at = now()
      where id = old.conta_bancaria_id;
    end if;
    if new.conta_bancaria_id is not null then
      delta := case when new.tipo = 'entrada' then new.valor else -new.valor end;
      update public.contas_bancarias
      set saldo_actual = saldo_actual + delta, updated_at = now()
      where id = new.conta_bancaria_id;
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_movimentos_tesouraria_saldo on public.movimentos_tesouraria;
create trigger tr_movimentos_tesouraria_saldo
  after insert or update or delete
  on public.movimentos_tesouraria
  for each row
  execute procedure public.fn_movimentos_tesouraria_atualiza_saldo();

-- 6) RLS — bancos
alter table public.bancos enable row level security;

create policy "bancos: authenticated select"
  on public.bancos for select
  using (auth.uid() is not null);

create policy "bancos: admin insert"
  on public.bancos for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil = 'Admin'
    )
  );

create policy "bancos: admin update"
  on public.bancos for update
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil = 'Admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil = 'Admin'
    )
  );

create policy "bancos: admin delete"
  on public.bancos for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.perfil = 'Admin'
    )
  );

-- 7) RLS — contas bancárias (leitura tenant; escrita Admin/PCA grupo ou Admin+Financeiro da empresa)
alter table public.contas_bancarias enable row level security;

create policy "contas_bancarias: tenant select"
  on public.contas_bancarias for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.contas_bancarias.empresa_id = p.empresa_id)
        )
    )
  );

create policy "contas_bancarias: financas insert"
  on public.contas_bancarias for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (
            p.perfil in ('Admin', 'Financeiro')
            and p.empresa_id is not null
            and public.contas_bancarias.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "contas_bancarias: financas update"
  on public.contas_bancarias for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (
            p.perfil in ('Admin', 'Financeiro')
            and p.empresa_id is not null
            and public.contas_bancarias.empresa_id = p.empresa_id
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
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (
            p.perfil in ('Admin', 'Financeiro')
            and p.empresa_id is not null
            and public.contas_bancarias.empresa_id = p.empresa_id
          )
        )
    )
  );

create policy "contas_bancarias: financas delete"
  on public.contas_bancarias for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (
            p.perfil in ('Admin', 'Financeiro')
            and p.empresa_id is not null
            and public.contas_bancarias.empresa_id = p.empresa_id
          )
        )
    )
  );
