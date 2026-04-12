-- Idempotente: use se já tinha aplicado uma versão antiga de 20260329170000 sem `profiles.numero_mec`
-- ou política INSERT ainda baseada em colaborador_id. Em instalações novas, 20260329170000 já cobre isto.

alter table public.profiles
  add column if not exists numero_mec text;

update public.profiles p
set numero_mec = trim(c.numero_mec::text)
from public.colaboradores c
where c.id = p.colaborador_id
  and c.numero_mec is not null
  and trim(c.numero_mec::text) <> '';

drop policy if exists "biometrico_registros_insert_own_numero_mec" on public.biometrico_registros;

create policy "biometrico_registros_insert_own_numero_mec"
  on public.biometrico_registros
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      inner join public.colaboradores c
        on lower(trim(c.numero_mec::text)) = lower(trim(p.numero_mec::text))
      where p.auth_user_id = auth.uid()
        and p.numero_mec is not null
        and trim(p.numero_mec::text) <> ''
        and c.numero_mec is not null
        and trim(c.numero_mec::text) <> ''
        and lower(trim(biometrico_registros.numero_mec::text)) = lower(trim(p.numero_mec::text))
        and (
          trim(coalesce(biometrico_registros.empresa::text, '')) = ''
          or exists (
            select 1
            from public.empresas e
            where e.id = c.empresa_id
              and lower(trim(biometrico_registros.empresa::text)) = lower(trim(e.nome::text))
          )
        )
        and (p.empresa_id is null or p.empresa_id is not distinct from c.empresa_id)
    )
  );
