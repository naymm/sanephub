-- Ajusta seed fictício para ter empresa_id (evita aparecer como “global”).
-- Só aplica se existir empresa id=1 (bases novas na nuvem podem ainda não ter linhas em empresas).

update public.notificacoes n
set empresa_id = 1
where n.id in (
  '20260320000003-notif-fict-1',
  '20260320000003-notif-fict-2',
  '20260320000003-notif-fict-3'
)
and exists (select 1 from public.empresas e where e.id = 1);

