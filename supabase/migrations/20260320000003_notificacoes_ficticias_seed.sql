-- Seed de 3 notificações fictícias para testes/validação do UI.
-- Insere na tabela base `public.notificacoes` (id é text e tem PK).

insert into public.notificacoes (
  id,
  tipo,
  titulo,
  mensagem,
  modulo_origem,
  destinatario_perfil,
  lida,
  created_at,
  link
)
values
  (
    '20260320000003-notif-fict-1',
    'info',
    'Notícia publicada (fictícia)',
    'Foi publicada uma notícia fictícia para validar o feed e o sininho de notificações.',
    'comunicacao-interna',
    array['Admin', 'PCA']::text[],
    false,
    now() - interval '3 hours',
    '/comunicacao-interna/noticias/1'
  ),
  (
    '20260320000003-notif-fict-2',
    'alerta',
    'Evento a começar (fictício)',
    'Existe um evento fictício agendado. Use isto para testar lembretes antes do início.',
    'comunicacao-interna',
    array['Admin', 'Planeamento', 'Director', 'RH']::text[],
    false,
    now() - interval '1 hours',
    '/comunicacao-interna/eventos/1'
  ),
  (
    '20260320000003-notif-fict-3',
    'sucesso',
    'Aniversariante do dia (fictício)',
    'Feliz aniversário! Notificação fictícia para validação do destaque “Aniversariante do dia”.',
    'comunicacao-interna',
    array['Admin', 'PCA', 'Colaborador']::text[],
    false,
    now() - interval '30 minutes',
    '/comunicacao-interna/aniversarios'
  )
on conflict (id) do nothing;

