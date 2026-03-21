-- Permissões por pasta (módulos / sectores); vazio = sem restrição extra nesse eixo (igual aos ficheiros).

alter table public.gestao_documentos_pastas
  add column if not exists modulos_acesso text[] not null default '{}';

alter table public.gestao_documentos_pastas
  add column if not exists sectores_acesso text[] not null default '{}';

comment on column public.gestao_documentos_pastas.modulos_acesso is 'Vazio = qualquer perfil com acesso ao tenant pode ver a pasta (conforme políticas).';
comment on column public.gestao_documentos_pastas.sectores_acesso is 'Vazio = qualquer departamento.';

-- Mesma lógica que gestao_documento_pode_ler, mas para linhas de pasta.
create or replace function public.gestao_pasta_pode_ler(
  p_empresa_id bigint,
  p_modulos text[],
  p_sectores text[]
)
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
      and (
        (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
        or (
          p.empresa_id is not null
          and p.empresa_id = p_empresa_id
          and (
            p.perfil in ('Admin', 'PCA', 'Secretaria', 'Director')
            or (
              cardinality(coalesce(p_modulos, '{}')) = 0
              or coalesce(p.modulos, '{}') && coalesce(p_modulos, '{}')
              or (
                p.modulos is null
                and (
                  ('financas' = any (coalesce(p_modulos, '{}')) and p.perfil in ('Financeiro'))
                  or ('contabilidade' = any (coalesce(p_modulos, '{}')) and p.perfil in ('Contabilidade', 'Financeiro'))
                  or ('capital-humano' = any (coalesce(p_modulos, '{}')) and p.perfil in ('RH'))
                  or ('juridico' = any (coalesce(p_modulos, '{}')) and p.perfil in ('Juridico'))
                  or ('secretaria' = any (coalesce(p_modulos, '{}')) and p.perfil in ('Secretaria'))
                  or ('planeamento' = any (coalesce(p_modulos, '{}')) and p.perfil in ('Planeamento'))
                  or ('comunicacao-interna' = any (coalesce(p_modulos, '{}')) and p.perfil not in ('Colaborador'))
                  or ('conselho-administracao' = any (coalesce(p_modulos, '{}')) and p.perfil in ('PCA'))
                )
              )
            )
            and (
              cardinality(coalesce(p_sectores, '{}')) = 0
              or nullif(trim(p.departamento), '') is null
              or trim(p.departamento) = any (select unnest(coalesce(p_sectores, '{}')))
            )
          )
        )
      )
  );
$$;

drop policy if exists "gestao_pastas: select tenant" on public.gestao_documentos_pastas;

create policy "gestao_pastas: select tenant"
  on public.gestao_documentos_pastas for select
  using (
    public.gestao_pasta_pode_ler(
      gestao_documentos_pastas.empresa_id,
      gestao_documentos_pastas.modulos_acesso,
      gestao_documentos_pastas.sectores_acesso
    )
  );

drop policy if exists "gestao_arquivos: select" on public.gestao_documentos_arquivos;

create policy "gestao_arquivos: select"
  on public.gestao_documentos_arquivos for select
  using (
    public.gestao_documento_pode_ler(
      gestao_documentos_arquivos.empresa_id,
      gestao_documentos_arquivos.modulos_acesso,
      gestao_documentos_arquivos.sectores_acesso
    )
    and exists (
      select 1
      from public.gestao_documentos_pastas gp
      where gp.id = gestao_documentos_arquivos.pasta_id
        and public.gestao_pasta_pode_ler(gp.empresa_id, gp.modulos_acesso, gp.sectores_acesso)
    )
  );
