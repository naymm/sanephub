-- Ajusta seed fictício para ter empresa_id (evita aparecer como “global”).

update public.notificacoes
set empresa_id = 1
where id in (
  '20260320000003-notif-fict-1',
  '20260320000003-notif-fict-2',
  '20260320000003-notif-fict-3'
);

