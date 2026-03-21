-- Só é permitido enviar parabéns quando o destinatário faz anos *neste dia* (MM-DD),
-- alinhado ao fuso de Angola (ajuste timezone se necessário).

drop policy if exists "aniversario_parabens: colaborador insert" on public.aniversario_parabens;

create policy "aniversario_parabens: colaborador insert"
  on public.aniversario_parabens for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.colaborador_id is not null
        and p.colaborador_id = aniversario_parabens.autor_colaborador_id
    )
    and exists (
      select 1
      from public.colaboradores c_a
      inner join public.colaboradores c_d on c_d.id = aniversario_parabens.destinatario_colaborador_id
      where c_a.id = aniversario_parabens.autor_colaborador_id
        and c_a.empresa_id = c_d.empresa_id
        and c_a.empresa_id = aniversario_parabens.empresa_id
    )
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and p.empresa_id = aniversario_parabens.empresa_id)
        )
    )
    -- Destinatário com aniversário (mês/dia) igual a "hoje" no fuso Africa/Luanda
    and exists (
      select 1
      from public.colaboradores c
      where c.id = aniversario_parabens.destinatario_colaborador_id
        and c.data_nascimento is not null
        and to_char(c.data_nascimento::date, 'MM-DD')
          = to_char((timezone('Africa/Luanda', now()))::date, 'MM-DD')
    )
  );
