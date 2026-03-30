-- Leitura do acumulado mensal de atrasos para Capital Humano / Admin (âmbito empresa), alinhado a time_punches.

alter table public.colaborador_mes_atraso enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'colaborador_mes_atraso'
      and policyname = 'colaborador_mes_atraso_select_rh_tenant'
  ) then
    create policy "colaborador_mes_atraso_select_rh_tenant"
      on public.colaborador_mes_atraso
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles pst
          inner join public.colaboradores c on c.id = public.colaborador_mes_atraso.colaborador_id
          where pst.auth_user_id = auth.uid()
            and (
              (pst.perfil in ('Admin', 'PCA') and pst.empresa_id is null)
              or (
                pst.perfil in ('Admin', 'RH', 'PCA')
                and pst.empresa_id is not null
                and c.empresa_id = pst.empresa_id
              )
            )
        )
      );
  end if;
end $$;
