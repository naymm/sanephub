-- =============================================================================
-- Produtividade — storage RLS para bucket produtividade-entregaveis
-- Corrige 403 «new row violates row-level security policy» no upload de entregáveis.
-- Path da app: empresa-{id}/colab-{id}/act-{id}/{ficheiro}
-- =============================================================================

create or replace function public.fn_produtividade_entregavel_storage_path_ok(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_act_id bigint;
  v_path_colab bigint;
  v_my_colab bigint;
  v_perfil text;
begin
  if p_name is null or btrim(p_name) = '' then
    return false;
  end if;

  if p_name !~ '^empresa-[0-9]+/colab-[0-9]+/act-[0-9]+/.+' then
    return false;
  end if;

  v_act_id := (regexp_match(p_name, '^empresa-[0-9]+/colab-[0-9]+/act-([0-9]+)/'))[1]::bigint;
  v_path_colab := (regexp_match(p_name, '^empresa-[0-9]+/colab-([0-9]+)/act-[0-9]+/'))[1]::bigint;

  if v_act_id is null or v_path_colab is null then
    return false;
  end if;

  perform set_config('row_security', 'off', true);

  if not public.fn_produtividade_can_access_actividade(v_act_id) then
    return false;
  end if;

  select p.colaborador_id, p.perfil
  into v_my_colab, v_perfil
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
  limit 1;

  if v_perfil in ('Admin', 'PCA') then
    return true;
  end if;

  if v_my_colab is null then
    return false;
  end if;

  return v_path_colab = v_my_colab;
end $$;

comment on function public.fn_produtividade_entregavel_storage_path_ok(text) is
  'Valida path de objecto no bucket produtividade-entregaveis (acesso à actividade + colaborador do path).';

revoke all on function public.fn_produtividade_entregavel_storage_path_ok(text) from public, anon;
grant execute on function public.fn_produtividade_entregavel_storage_path_ok(text) to authenticated;

insert into storage.buckets (id, name, public)
values ('produtividade-entregaveis', 'produtividade-entregaveis', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "produtividade_entregaveis_authenticated_read" on storage.objects;
drop policy if exists "produtividade_entregaveis_authenticated_insert" on storage.objects;
drop policy if exists "produtividade_entregaveis_authenticated_update" on storage.objects;
drop policy if exists "produtividade_entregaveis_authenticated_delete" on storage.objects;
drop policy if exists "produtividade_entregaveis_storage_select" on storage.objects;
drop policy if exists "produtividade_entregaveis_storage_insert" on storage.objects;
drop policy if exists "produtividade_entregaveis_storage_update" on storage.objects;
drop policy if exists "produtividade_entregaveis_storage_delete" on storage.objects;

create policy "produtividade_entregaveis_storage_select"
  on storage.objects for select
  using (bucket_id = 'produtividade-entregaveis');

create policy "produtividade_entregaveis_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'produtividade-entregaveis'
    and public.fn_produtividade_entregavel_storage_path_ok(name)
  );

create policy "produtividade_entregaveis_storage_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'produtividade-entregaveis'
    and public.fn_produtividade_entregavel_storage_path_ok(name)
  )
  with check (
    bucket_id = 'produtividade-entregaveis'
    and public.fn_produtividade_entregavel_storage_path_ok(name)
  );

create policy "produtividade_entregaveis_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'produtividade-entregaveis'
    and public.fn_produtividade_entregavel_storage_path_ok(name)
  );
