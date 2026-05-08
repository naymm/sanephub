-- Eventos «deliverable_downloaded»: registar quando alguém descarrega um entregável.

do $$
begin
  -- O nome do constraint costuma ser produtividade_eventos_tipo_check, mas pode variar.
  alter table public.produtividade_eventos
    drop constraint if exists produtividade_eventos_tipo_check;
exception
  when undefined_table then
    -- tabela ainda não existe no ambiente; nada a fazer
    null;
end $$;

alter table public.produtividade_eventos
  add constraint produtividade_eventos_tipo_check check (
    tipo in (
      'created',
      'status_changed',
      'priority_changed',
      'deadline_changed',
      'deliverable_uploaded',
      'deliverable_downloaded',
      'deliverable_viewed',
      'comment_added'
    )
  );

