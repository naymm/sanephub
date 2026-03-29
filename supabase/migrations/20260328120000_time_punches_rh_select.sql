-- Leitura de marcações de ponto por Capital Humano / Admin no âmbito da empresa.
-- A tabela `time_punches` já existe no projecto; esta migração só adiciona política de SELECT.

alter table public.time_punches enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'time_punches'
      and policyname = 'time_punches_select_rh_tenant'
  ) then
    create policy "time_punches_select_rh_tenant"
      on public.time_punches
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
                and (
                  public.time_punches.empresa_id = p.empresa_id
                  or exists (
                    select 1
                    from public.colaboradores c
                    where c.id = public.time_punches.colaborador_id
                      and c.empresa_id = p.empresa_id
                  )
                )
              )
            )
        )
      );
  end if;
end $$;
