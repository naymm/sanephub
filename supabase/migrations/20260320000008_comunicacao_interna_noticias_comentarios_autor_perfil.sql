-- Adiciona autor_perfil_id ao schema de comentários para permitir notificar
-- quem escreveu quando alguém responder.

alter table public.noticias_comentarios
  add column if not exists autor_perfil_id bigint references public.profiles(id) on delete cascade;

-- Preencher (para dados antigos) quando existe autor_colaborador_id.
update public.noticias_comentarios c
set autor_perfil_id = p.id
from public.profiles p
where c.autor_perfil_id is null
  and c.autor_colaborador_id is not null
  and p.colaborador_id = c.autor_colaborador_id
  and p.perfil = 'Colaborador';

