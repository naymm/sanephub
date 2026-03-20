-- Guarda o perfil do autor no comentário para evitar dependência de SELECT em `profiles`
-- (que tem RLS apenas para o próprio utilizador).

alter table public.noticias_comentarios
  add column if not exists autor_perfil text;

-- Backfill para dados antigos (quando possível)
update public.noticias_comentarios c
set autor_perfil = p.perfil
from public.profiles p
where c.autor_perfil is null
  and c.autor_perfil_id is not null
  and p.id = c.autor_perfil_id;

