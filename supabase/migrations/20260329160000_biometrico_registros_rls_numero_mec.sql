-- Substitui a política antiga baseada em colaborador_id pela comparação via numero_mec ↔ colaboradores.numero_mec.

alter table public.biometrico_registros enable row level security;

drop policy if exists "biometrico_registros_select_rh_tenant" on public.biometrico_registros;

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
