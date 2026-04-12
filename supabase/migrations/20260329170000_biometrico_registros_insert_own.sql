-- Marcação de ponto pelo ERP: a ligação do utilizador ao colaborador é pelo numero_mec (não por colaborador_id).
-- 1) Coluna em profiles para espelhar o nº mec. do colaborador (preencher / manter via app ou backfill abaixo).
-- 2) Política INSERT: o registo só entra se o mec. inserido bater com o do perfil e com um colaborador coerente.

alter table public.profiles
  add column if not exists numero_mec text;

comment on column public.profiles.numero_mec is
  'Número mecanográfico alinhado a colaboradores.numero_mec; usado em RLS de marcação de ponto (sem depender de colaborador_id).';

-- Sincronizar a partir da relação legada colaborador_id → colaboradores (uma vez / quando existir id).
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
