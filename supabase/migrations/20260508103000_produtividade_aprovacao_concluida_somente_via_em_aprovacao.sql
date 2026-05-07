-- Reforço: com requer_aprovacao, nunca gravar «Concluída» directamente sem antes estar em «Em aprovação»
-- (independente de aprovador_colaborador_id, alinhado ao CHECK da tabela).

create or replace function public.fn_produtividade_enforce_aprovacao_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil text;
  v_empresa_id bigint;
  v_colab_id bigint;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status is distinct from new.status and new.status = 'Em aprovação' then
    if not coalesce(new.requer_aprovacao, false) or new.aprovador_colaborador_id is null then
      raise exception 'Para passar para «Em aprovação» é necessário exigir aprovação e seleccionar o aprovador.';
    end if;
  end if;

  if old.status = 'Em aprovação' and new.status is distinct from old.status then
    select perfil, empresa_id, colaborador_id
      into v_perfil, v_empresa_id, v_colab_id
    from public.fn_produtividade_current_profile();

    if (
      v_colab_id is not null
      and old.aprovador_colaborador_id is not null
      and v_colab_id = old.aprovador_colaborador_id
    )
    or (
      v_perfil in ('Admin', 'PCA', 'Director')
      and v_empresa_id is not null
      and v_empresa_id = new.empresa_id
    ) then
      null;
    else
      raise exception 'Só o aprovador designado (ou gestão da empresa) pode alterar o estado desde «Em aprovação».';
    end if;
  end if;

  if new.status = 'Concluída'
     and old.status is distinct from new.status
     and coalesce(new.requer_aprovacao, false)
     and old.status <> 'Em aprovação'
  then
    raise exception 'Esta actividade deve ser primeiro submetida para aprovação (estado «Em aprovação»).';
  end if;

  return new;
end $$;
