-- Tabela `biometrico_registros`: o CREATE TABLE e colunas devem seguir **exactamente** o esquema que indicou.
-- Não versionamos aqui definição de colunas para não divergir da sua BD.
--
-- Antes de aplicar esta migração:
--   1) Crie a tabela no Supabase (SQL Editor) com o seu esquema, ou
--   2) Acrescente no **início** deste ficheiro (acima do `alter table`) o `create table public.biometrico_registros (...)` completo.
--
-- A política abaixo usa a coluna `numero_mec` em `biometrico_registros`, comparada com
-- `public.colaboradores.numero_mec` + `colaboradores.empresa_id` para isolamento por tenant
-- (sem `colaborador_id` na tabela biométrica).

alter table public.biometrico_registros enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'biometrico_registros'
      and policyname = 'biometrico_registros_select_rh_tenant'
  ) then
    create policy "biometrico_registros_select_rh_tenant"
      on public.biometrico_registros
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.auth_user_id = auth.uid()
            and (
              (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
              or (
                p.perfil in ('Admin', 'RH', 'PCA')
                and p.empresa_id is not null
                and public.biometrico_registros.numero_mec is not null
                and trim(public.biometrico_registros.numero_mec::text) <> ''
                and exists (
                  select 1
                  from public.colaboradores c
                  where c.numero_mec is not null
                    and trim(c.numero_mec::text) <> ''
                    and lower(trim(c.numero_mec::text)) = lower(trim(public.biometrico_registros.numero_mec::text))
                    and c.empresa_id = p.empresa_id
                )
              )
            )
        )
      );
  end if;
end $$;
