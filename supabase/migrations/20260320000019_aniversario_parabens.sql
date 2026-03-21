-- Mensagens de parabéns entre colaboradores (aniversários).
-- O destinatário vê todas as mensagens onde é aniversariante; o tenant vê o mural na mesma empresa.

create table if not exists public.aniversario_parabens (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete cascade,
  destinatario_colaborador_id bigint not null references public.colaboradores (id) on delete cascade,
  autor_colaborador_id bigint not null references public.colaboradores (id) on delete cascade,
  mensagem text not null,
  created_at timestamptz not null default now(),
  constraint aniversario_parabens_mensagem_len check (char_length(trim(mensagem)) between 1 and 2000),
  constraint aniversario_parabens_no_self check (destinatario_colaborador_id <> autor_colaborador_id)
);

create index if not exists idx_aniversario_parabens_dest on public.aniversario_parabens (destinatario_colaborador_id);
create index if not exists idx_aniversario_parabens_empresa on public.aniversario_parabens (empresa_id);
create index if not exists idx_aniversario_parabens_created on public.aniversario_parabens (created_at desc);

comment on table public.aniversario_parabens is 'Parabéns deixados por colaboradores aos aniversariantes (mesma empresa).';

alter table public.aniversario_parabens enable row level security;

-- Leitura: membros do tenant (ou Admin/PCA de grupo sem empresa).
create policy "aniversario_parabens: tenant select"
  on public.aniversario_parabens for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and p.empresa_id = aniversario_parabens.empresa_id)
        )
    )
  );

-- Inserção: só como o próprio autor (colaborador ligado ao perfil) e mesma empresa que o destinatário.
create policy "aniversario_parabens: colaborador insert"
  on public.aniversario_parabens for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.colaborador_id is not null
        and p.colaborador_id = aniversario_parabens.autor_colaborador_id
    )
    and exists (
      select 1
      from public.colaboradores c_a
      inner join public.colaboradores c_d on c_d.id = aniversario_parabens.destinatario_colaborador_id
      where c_a.id = aniversario_parabens.autor_colaborador_id
        and c_a.empresa_id = c_d.empresa_id
        and c_a.empresa_id = aniversario_parabens.empresa_id
    )
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and p.empresa_id = aniversario_parabens.empresa_id)
        )
    )
  );

-- Remover apenas a própria mensagem.
create policy "aniversario_parabens: autor delete"
  on public.aniversario_parabens for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.colaborador_id is not null
        and p.colaborador_id = aniversario_parabens.autor_colaborador_id
    )
  );

-- Realtime (opcional)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'aniversario_parabens'
  ) then
    alter publication supabase_realtime add table public.aniversario_parabens;
  end if;
end $$;
