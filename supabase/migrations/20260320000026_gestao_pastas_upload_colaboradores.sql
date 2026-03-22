-- Permitir que os mesmos perfis que podem carregar documentos também criem pastas.
-- Alargar "carregar" a Director, Planeamento e Colaborador (com empresa).

create or replace function public.gestao_documentos_pode_carregar()
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
        p.perfil = 'Admin'
        or (p.perfil = 'PCA' and p.empresa_id is null)
        or (
          p.perfil in (
            'PCA',
            'Secretaria',
            'Financeiro',
            'Juridico',
            'RH',
            'Contabilidade',
            'Director',
            'Planeamento',
            'Colaborador'
          )
          and p.empresa_id is not null
        )
      )
  );
$$;

comment on function public.gestao_documentos_pode_carregar() is
  'Upload storage + insert em gestao_documentos_arquivos: Admin/PCA global ou perfis operacionais com empresa.';

drop policy if exists "gestao_pastas: insert" on public.gestao_documentos_pastas;

create policy "gestao_pastas: insert"
  on public.gestao_documentos_pastas for insert
  with check (
    (
      public.gestao_documentos_pode_gerir()
      or public.gestao_documentos_pode_carregar()
    )
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id = gestao_documentos_pastas.empresa_id)
        )
    )
  );
