-- Notificações dirigidas a um colaborador específico (ex.: declaração emitida no portal)
alter table public.notificacoes
  add column if not exists destinatario_colaborador_id bigint references public.colaboradores(id) on delete set null;

comment on column public.notificacoes.destinatario_colaborador_id is
  'Se preenchido, apenas esse colaborador (perfil Colaborador) vê a notificação no sininho; RH/Admin usam destinatario_perfil.';
