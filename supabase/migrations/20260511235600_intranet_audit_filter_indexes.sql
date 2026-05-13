-- Índices para filtros do painel de auditoria (Admin) sem varrer a tabela inteira.

create index if not exists idx_intranet_audit_actor_created
  on public.intranet_audit_events (actor_profile_id, created_at desc)
  where actor_profile_id is not null;

create index if not exists idx_intranet_audit_colab_created
  on public.intranet_audit_events (colaborador_id, created_at desc)
  where colaborador_id is not null;

create index if not exists idx_intranet_audit_category_created
  on public.intranet_audit_events (event_category, created_at desc);
