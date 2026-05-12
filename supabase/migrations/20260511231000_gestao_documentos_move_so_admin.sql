-- Apenas perfil Admin pode mover documentos entre pastas ou alterar parent_id de pastas na árvore.
-- Revoga UPDATE em gestao_documentos_arquivos para simples leitores; PCA/Secretaria deixam de mudar pasta_id.

create or replace function public.gestao_documentos_utilizador_e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.perfil = 'Admin'
  );
$$;

comment on function public.gestao_documentos_utilizador_e_admin() is
  'Utilizador autenticado com perfil Admin; restringe mover ficheiros e reparentar pastas.';

drop policy if exists "gestao_arquivos: update" on public.gestao_documentos_arquivos;

create policy "gestao_arquivos: update"
  on public.gestao_documentos_arquivos for update
  using (public.gestao_documentos_pode_gerir())
  with check (public.gestao_documentos_pode_gerir());

create or replace function public.gestao_arquivos_restringe_update_nao_gerir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pasta_id is distinct from old.pasta_id
     and public.gestao_documentos_pode_gerir()
     and not public.gestao_documentos_utilizador_e_admin() then
    raise exception 'Apenas administradores podem mover documentos entre pastas.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.gestao_pastas_restringe_move_so_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is distinct from old.parent_id then
    if not public.gestao_documentos_utilizador_e_admin() then
      raise exception 'Apenas administradores podem mover pastas na árvore.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists gestao_pastas_restringe_move_so_admin on public.gestao_documentos_pastas;

create trigger gestao_pastas_restringe_move_so_admin
  before update on public.gestao_documentos_pastas
  for each row
  execute function public.gestao_pastas_restringe_move_so_admin();
