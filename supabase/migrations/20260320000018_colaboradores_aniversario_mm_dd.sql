-- Aniversários: comparar só mês/dia (MM-DD); o ano em data_nascimento é o de nascimento, não o corrente.
-- Usado pela edge function birthdays (service_role).

create or replace function public.colaboradores_aniversario_no_mes_dia(
  p_mes smallint,
  p_dia smallint,
  p_empresa_id bigint default null
)
returns table (
  id bigint,
  nome text,
  data_nascimento date,
  empresa_id bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nome, c.data_nascimento, c.empresa_id
  from public.colaboradores c
  where c.data_nascimento is not null
    and extract(month from c.data_nascimento)::smallint = p_mes
    and extract(day from c.data_nascimento)::smallint = p_dia
    and (p_empresa_id is null or c.empresa_id = p_empresa_id)
  order by c.nome asc;
$$;

create or replace function public.colaboradores_aniversario_no_mes(
  p_mes smallint,
  p_empresa_id bigint default null
)
returns table (
  id bigint,
  nome text,
  data_nascimento date,
  empresa_id bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nome, c.data_nascimento, c.empresa_id
  from public.colaboradores c
  where c.data_nascimento is not null
    and extract(month from c.data_nascimento)::smallint = p_mes
    and (p_empresa_id is null or c.empresa_id = p_empresa_id)
  order by c.nome asc;
$$;

create or replace function public.colaboradores_com_data_nascimento(
  p_empresa_id bigint default null
)
returns table (
  id bigint,
  nome text,
  data_nascimento date,
  empresa_id bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nome, c.data_nascimento, c.empresa_id
  from public.colaboradores c
  where c.data_nascimento is not null
    and (p_empresa_id is null or c.empresa_id = p_empresa_id)
  order by c.nome asc;
$$;

revoke all on function public.colaboradores_aniversario_no_mes_dia(smallint, smallint, bigint) from public;
revoke all on function public.colaboradores_aniversario_no_mes(smallint, bigint) from public;
revoke all on function public.colaboradores_com_data_nascimento(bigint) from public;

grant execute on function public.colaboradores_aniversario_no_mes_dia(smallint, smallint, bigint) to service_role;
grant execute on function public.colaboradores_aniversario_no_mes(smallint, bigint) to service_role;
grant execute on function public.colaboradores_com_data_nascimento(bigint) to service_role;
