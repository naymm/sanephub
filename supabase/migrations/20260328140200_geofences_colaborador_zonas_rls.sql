-- Liga colaboradores às zonas (geofences) permitidas para marcação de ponto.
-- Políticas RLS alinhadas ao Capital Humano (Admin/RH/PCA) por empresa; leitura de geofences para colaboradores da mesma empresa (app de ponto).
-- Versão 20260328140200: evita colisão de versão com 20260328140000_contratos_contraparte_campos.sql no histórico Supabase.

create table if not exists public.geofences (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete cascade,
  nome text not null default '',
  center_lat double precision not null default 0,
  center_lng double precision not null default 0,
  radius_meters double precision not null default 100,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_geofences_empresa_id on public.geofences using btree (empresa_id);

comment on table public.geofences is 'Zonas de marcação de ponto (círculo centro + raio) por empresa.';

create table if not exists public.colaborador_geofences (
  id bigserial not null,
  colaborador_id bigint not null,
  geofence_id bigint not null,
  created_at timestamp with time zone not null default now(),
  constraint colaborador_geofences_pkey primary key (id),
  constraint colaborador_geofences_colaborador_id_fkey foreign key (colaborador_id) references public.colaboradores (id) on delete cascade,
  constraint colaborador_geofences_geofence_id_fkey foreign key (geofence_id) references public.geofences (id) on delete cascade,
  constraint colaborador_geofences_colaborador_geofence_unique unique (colaborador_id, geofence_id)
) tablespace pg_default;

create index if not exists colaborador_geofences_colaborador_idx on public.colaborador_geofences using btree (colaborador_id);
create index if not exists colaborador_geofences_geofence_idx on public.colaborador_geofences using btree (geofence_id);

alter table public.geofences enable row level security;
alter table public.colaborador_geofences enable row level security;

-- ---------- geofences ----------
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'geofences' and policyname = 'geofences_select_rh_tenant'
  ) then
    create policy "geofences_select_rh_tenant"
      on public.geofences
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
                and public.geofences.empresa_id = p.empresa_id
              )
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'geofences' and policyname = 'geofences_select_colaborador_empresa'
  ) then
    create policy "geofences_select_colaborador_empresa"
      on public.geofences
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          join public.colaboradores c on c.id = p.colaborador_id
          where p.auth_user_id = auth.uid()
            and p.colaborador_id is not null
            and c.empresa_id = public.geofences.empresa_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'geofences' and policyname = 'geofences_insert_rh_tenant'
  ) then
    create policy "geofences_insert_rh_tenant"
      on public.geofences
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.profiles p
          where p.auth_user_id = auth.uid()
            and (
              (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
              or (
                p.perfil in ('Admin', 'RH', 'PCA')
                and p.empresa_id is not null
                and public.geofences.empresa_id = p.empresa_id
              )
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'geofences' and policyname = 'geofences_update_rh_tenant'
  ) then
    create policy "geofences_update_rh_tenant"
      on public.geofences
      for update
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
                and public.geofences.empresa_id = p.empresa_id
              )
            )
        )
      )
      with check (
        exists (
          select 1
          from public.profiles p
          where p.auth_user_id = auth.uid()
            and (
              (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
              or (
                p.perfil in ('Admin', 'RH', 'PCA')
                and p.empresa_id is not null
                and public.geofences.empresa_id = p.empresa_id
              )
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'geofences' and policyname = 'geofences_delete_rh_tenant'
  ) then
    create policy "geofences_delete_rh_tenant"
      on public.geofences
      for delete
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
                and public.geofences.empresa_id = p.empresa_id
              )
            )
        )
      );
  end if;
end $$;

-- ---------- colaborador_geofences ----------
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'colaborador_geofences' and policyname = 'colaborador_geofences_select_rh_tenant'
  ) then
    create policy "colaborador_geofences_select_rh_tenant"
      on public.colaborador_geofences
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          join public.colaboradores c on c.id = public.colaborador_geofences.colaborador_id
          where p.auth_user_id = auth.uid()
            and (
              (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
              or (
                p.perfil in ('Admin', 'RH', 'PCA')
                and p.empresa_id is not null
                and c.empresa_id = p.empresa_id
              )
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'colaborador_geofences' and policyname = 'colaborador_geofences_insert_rh_tenant'
  ) then
    create policy "colaborador_geofences_insert_rh_tenant"
      on public.colaborador_geofences
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.profiles p
          join public.colaboradores c on c.id = public.colaborador_geofences.colaborador_id
          join public.geofences g on g.id = public.colaborador_geofences.geofence_id
          where p.auth_user_id = auth.uid()
            and g.empresa_id = c.empresa_id
            and (
              (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
              or (
                p.perfil in ('Admin', 'RH', 'PCA')
                and p.empresa_id is not null
                and c.empresa_id = p.empresa_id
              )
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'colaborador_geofences' and policyname = 'colaborador_geofences_delete_rh_tenant'
  ) then
    create policy "colaborador_geofences_delete_rh_tenant"
      on public.colaborador_geofences
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          join public.colaboradores c on c.id = public.colaborador_geofences.colaborador_id
          where p.auth_user_id = auth.uid()
            and (
              (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
              or (
                p.perfil in ('Admin', 'RH', 'PCA')
                and p.empresa_id is not null
                and c.empresa_id = p.empresa_id
              )
            )
        )
      );
  end if;
end $$;
