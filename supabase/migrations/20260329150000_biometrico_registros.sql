-- Marcações biométricas / ERP: `numero_mec` + `empresa` (nome ou vazio) alinhados a `colaboradores` / `empresas`.
-- Colunas extra (GPS, geofence) em migrações posteriores.

create table if not exists public.biometrico_registros (
  id bigserial primary key,
  numero_mec bigint not null,
  data_hora timestamp not null,
  tipo text not null,
  empresa text null,
  via text null
);

create index if not exists idx_biometrico_registros_numero_mec on public.biometrico_registros (numero_mec);
create index if not exists idx_biometrico_registros_data_hora on public.biometrico_registros (data_hora desc);

comment on table public.biometrico_registros is
  'Registos de ponto (biométrico ou ERP). `data_hora` = relógio local da marcação; `empresa` opcional (nome da empresa para RLS).';

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
