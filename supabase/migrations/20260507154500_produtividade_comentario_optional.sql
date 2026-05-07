-- =============================================================================
-- Produtividade — Comentário opcional
-- =============================================================================

alter table public.produtividade_actividades
  alter column comentario drop not null;

