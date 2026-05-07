-- Produtividade: aprovação de conclusão (estado «Em aprovação», aprovador designado).

-- Novos campos
alter table public.produtividade_actividades
  add column if not exists requer_aprovacao boolean not null default false,
  add column if not exists aprovador_colaborador_id bigint references public.colaboradores(id) on delete set null;

alter table public.produtividade_actividades
  drop constraint if exists produtividade_actividades_aprovacao_designado_chk;

alter table public.produtividade_actividades
  add constraint produtividade_actividades_aprovacao_designado_chk
  check (not requer_aprovacao or aprovador_colaborador_id is not null);

alter table public.produtividade_actividades
  drop constraint if exists produtividade_actividades_status_check;

alter table public.produtividade_actividades
  add constraint produtividade_actividades_status_check check (
    status in (
      'Pendente',
      'Em Progresso',
      'Concluída',
      'Atrasada',
      'Cancelada',
      'Em aprovação'
    )
  );

create index if not exists idx_produtividade_actividades_aprovador_pending
  on public.produtividade_actividades(aprovador_colaborador_id)
  where status = 'Em aprovação';

-- Não sobrescrever «Em aprovação» com «Atrasada» quando o prazo passou (continua pendente de aprovação).
create or replace function public.fn_produtividade_apply_overdue_status()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('Concluída', 'Cancelada', 'Em aprovação') and new.prazo < current_date then
    new.status := 'Atrasada';
  end if;

  if new.status = 'Concluída' and new.concluida_em is null then
    new.concluida_em := now();
  end if;
  if new.status = 'Cancelada' and new.cancelada_em is null then
    new.cancelada_em := now();
  end if;

  if new.tipo_actividade <> 'Presencial' then
    new.localizacao := null;
  end if;
  return new;
end $$;

create or replace function public.fn_produtividade_enforce_aprovacao_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil text;
  v_empresa_id bigint;
  v_colab_id bigint;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status is distinct from new.status and new.status = 'Em aprovação' then
    if not coalesce(new.requer_aprovacao, false) or new.aprovador_colaborador_id is null then
      raise exception 'Para passar para «Em aprovação» é necessário exigir aprovação e seleccionar o aprovador.';
    end if;
  end if;

  if old.status = 'Em aprovação' and new.status is distinct from old.status then
    select perfil, empresa_id, colaborador_id
      into v_perfil, v_empresa_id, v_colab_id
    from public.fn_produtividade_current_profile();

    if (
      v_colab_id is not null
      and old.aprovador_colaborador_id is not null
      and v_colab_id = old.aprovador_colaborador_id
    )
    or (
      v_perfil in ('Admin', 'PCA', 'Director')
      and v_empresa_id is not null
      and v_empresa_id = new.empresa_id
    ) then
      null;
    else
      raise exception 'Só o aprovador designado (ou gestão da empresa) pode alterar o estado desde «Em aprovação».';
    end if;
  end if;

  if new.status = 'Concluída'
     and old.status is distinct from new.status
     and coalesce(new.requer_aprovacao, false)
     and old.status <> 'Em aprovação'
  then
    raise exception 'Esta actividade deve ser primeiro submetida para aprovação (estado «Em aprovação»).';
  end if;

  return new;
end $$;

drop trigger if exists tr_produtividade_actividades_aprovacao on public.produtividade_actividades;
create trigger tr_produtividade_actividades_aprovacao
  before update on public.produtividade_actividades
  for each row execute procedure public.fn_produtividade_enforce_aprovacao_rules();

-- Acesso: aprovador vê actividades onde está pendente validação.
create or replace function public.fn_produtividade_can_access_actividade(p_actividade_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_perfil text;
  v_empresa_id bigint;
  v_colab_id bigint;
  v_my_cargo text;
  v_my_empresa_id bigint;
  v_my_dept text;
begin
  if auth.uid() is null then
    return false;
  end if;

  perform set_config('row_security', 'off', true);

  select perfil, empresa_id, colaborador_id
  into v_perfil, v_empresa_id, v_colab_id
  from public.fn_produtividade_current_profile();

  if v_colab_id is null and v_perfil is null then
    return false;
  end if;

  if v_perfil in ('Admin', 'Director', 'PCA') and v_empresa_id is not null then
    return exists (
      select 1
      from public.produtividade_actividades a
      where a.id = p_actividade_id
        and a.empresa_id = v_empresa_id
      limit 1
    );
  end if;

  if v_colab_id is not null then
    if exists (
      select 1
      from public.produtividade_actividades a
      where a.id = p_actividade_id
        and (
          a.colaborador_id = v_colab_id
          or exists (
            select 1
            from public.produtividade_participantes pp
            where pp.actividade_id = a.id
              and pp.colaborador_id = v_colab_id
            limit 1
          )
        )
      limit 1
    ) then
      return true;
    end if;

    if exists (
      select 1
      from public.produtividade_actividades a
      where a.id = p_actividade_id
        and a.aprovador_colaborador_id = v_colab_id
        and a.status = 'Em aprovação'
      limit 1
    ) then
      return true;
    end if;

    select c.cargo, c.empresa_id, trim(coalesce(c.departamento, ''))
    into v_my_cargo, v_my_empresa_id, v_my_dept
    from public.colaboradores c
    where c.id = v_colab_id
    limit 1;

    if v_my_empresa_id is not null
      and v_my_cargo is not null
      and (
        lower(v_my_cargo) like '%director%'
        or lower(v_my_cargo) like '%diretor%'
        or lower(v_my_cargo) like '%coordenador%'
      )
    then
      if v_my_empresa_id = 1 then
        if v_my_dept = '' then
          return false;
        end if;

        return exists (
          select 1
          from public.produtividade_actividades a
          where a.id = p_actividade_id
            and a.empresa_id = v_my_empresa_id
            and (
              exists (
                select 1
                from public.colaboradores c_own
                where c_own.id = a.colaborador_id
                  and lower(trim(coalesce(c_own.departamento, ''))) = lower(trim(v_my_dept))
                limit 1
              )
              or exists (
                select 1
                from public.produtividade_participantes pp
                join public.colaboradores c_pt on c_pt.id = pp.colaborador_id
                where pp.actividade_id = a.id
                  and lower(trim(coalesce(c_pt.departamento, ''))) = lower(trim(v_my_dept))
                limit 1
              )
            )
          limit 1
        );
      end if;

      return exists (
        select 1
        from public.produtividade_actividades a
        where a.id = p_actividade_id
          and a.empresa_id = v_my_empresa_id
        limit 1
      );
    end if;
  end if;

  return false;
end $$;

revoke all on function public.fn_produtividade_can_access_actividade(bigint) from public;
grant execute on function public.fn_produtividade_can_access_actividade(bigint) to authenticated;
