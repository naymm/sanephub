-- Backfill para dados antigos (quando possível)
update public.noticias_comentarios c
set autor_perfil = p.perfil
from public.profiles p
where c.autor_perfil is null
  and c.autor_perfil_id is not null
  and p.id = c.autor_perfil_id;