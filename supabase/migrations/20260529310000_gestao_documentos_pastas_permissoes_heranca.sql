-- Herança de permissões: cada pasta/ficheiro exige acesso a toda a cadeia de pastas ancestrais.

create or replace function public.gestao_pasta_arvore_pode_ler(p_pasta_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive caminho as (
    select
      gp.id,
      gp.parent_id,
      gp.empresa_id,
      gp.modulos_acesso,
      gp.sectores_acesso,
      1 as depth
    from public.gestao_documentos_pastas gp
    where gp.id = p_pasta_id
    union all
    select
      p.id,
      p.parent_id,
      p.empresa_id,
      p.modulos_acesso,
      p.sectores_acesso,
      c.depth + 1
    from public.gestao_documentos_pastas p
    inner join caminho c on p.id = c.parent_id
    where c.depth < 64
  )
  select coalesce(
    (
      select bool_and(
        public.gestao_pasta_pode_ler(empresa_id, modulos_acesso, sectores_acesso)
      )
      from caminho
    ),
    false
  );
$$;

comment on function public.gestao_pasta_arvore_pode_ler(bigint) is
  'True se o utilizador pode ler a pasta e todas as suas ancestrais (herança de modulos_acesso / sectores_acesso).';

drop policy if exists "gestao_pastas: select tenant" on public.gestao_documentos_pastas;

create policy "gestao_pastas: select tenant"
  on public.gestao_documentos_pastas for select
  using (public.gestao_pasta_arvore_pode_ler(gestao_documentos_pastas.id));

drop policy if exists "gestao_arquivos: select" on public.gestao_documentos_arquivos;

create policy "gestao_arquivos: select"
  on public.gestao_documentos_arquivos for select
  using (
    public.gestao_documento_pode_ler(
      gestao_documentos_arquivos.empresa_id,
      gestao_documentos_arquivos.modulos_acesso,
      gestao_documentos_arquivos.sectores_acesso
    )
    and public.gestao_pasta_arvore_pode_ler(gestao_documentos_arquivos.pasta_id)
  );

drop policy if exists "gestao_audit: select" on public.gestao_documentos_auditoria;

create policy "gestao_audit: select"
  on public.gestao_documentos_auditoria for select
  using (
    public.gestao_documentos_pode_gerir()
    or exists (
      select 1
      from public.gestao_documentos_arquivos a
      where a.id = gestao_documentos_auditoria.arquivo_id
        and public.gestao_documento_pode_ler(a.empresa_id, a.modulos_acesso, a.sectores_acesso)
        and public.gestao_pasta_arvore_pode_ler(a.pasta_id)
    )
  );
