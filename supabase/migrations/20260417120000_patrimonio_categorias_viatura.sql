-- Categorias / subcategorias configuráveis por empresa; activos com categoria_id; campos opcionais de viatura.

create table if not exists public.patrimonio_categorias (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas (id) on delete cascade,
  nome text not null,
  slug text not null,
  ordem int not null default 0,
  comportamento_viatura boolean not null default false,
  created_at timestamptz not null default now(),
  constraint patrimonio_categorias_empresa_slug unique (empresa_id, slug),
  constraint patrimonio_categorias_nome_len check (char_length(trim(nome)) >= 1)
);

create index if not exists idx_patrimonio_categorias_empresa on public.patrimonio_categorias (empresa_id);

comment on table public.patrimonio_categorias is 'Tipos de activo por empresa; comportamento_viatura activa campos marca/modelo/cor/matrícula.';

create table if not exists public.patrimonio_subcategorias (
  id bigserial primary key,
  categoria_id bigint not null references public.patrimonio_categorias (id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  constraint patrimonio_subcategorias_cat_nome unique (categoria_id, nome),
  constraint patrimonio_subcategorias_nome_len check (char_length(trim(nome)) >= 1)
);

create index if not exists idx_patrimonio_subcategorias_categoria on public.patrimonio_subcategorias (categoria_id);

comment on table public.patrimonio_subcategorias is 'Subtipos opcionais por categoria de património.';

-- Activos: novas colunas + migração a partir de categoria (enum texto)
alter table public.patrimonio_activos
  add column if not exists categoria_id bigint references public.patrimonio_categorias (id),
  add column if not exists subcategoria_id bigint references public.patrimonio_subcategorias (id) on delete set null,
  add column if not exists viatura_marca text,
  add column if not exists viatura_modelo text,
  add column if not exists viatura_cor text,
  add column if not exists viatura_matricula text;

-- Semear categorias por empresa (idempotente por slug)
insert into public.patrimonio_categorias (empresa_id, nome, slug, ordem, comportamento_viatura)
select e.id, v.nome, v.slug, v.ordem, v.cv
from public.empresas e
cross join (
  values
    ('Computador', 'computador', 0, false),
    ('Viatura', 'viatura', 1, true),
    ('Mobiliário', 'mobiliario', 2, false),
    ('Equipamento', 'equipamento', 3, false)
) as v(nome, slug, ordem, cv)
on conflict (empresa_id, slug) do nothing;

-- Backfill categoria_id a partir da coluna legada categoria
update public.patrimonio_activos a
set categoria_id = c.id
from public.patrimonio_categorias c
where c.empresa_id = a.empresa_id
  and c.slug = a.categoria::text
  and a.categoria_id is null;

-- Activos sem match: primeira categoria da empresa (por ordem)
update public.patrimonio_activos a
set categoria_id = (
  select c2.id
  from public.patrimonio_categorias c2
  where c2.empresa_id = a.empresa_id
  order by c2.ordem, c2.id
  limit 1
)
where a.categoria_id is null;

alter table public.patrimonio_activos alter column categoria_id set not null;

alter table public.patrimonio_activos drop constraint if exists patrimonio_activos_categoria_check;
alter table public.patrimonio_activos drop column if exists categoria;

create index if not exists idx_patrimonio_activos_categoria on public.patrimonio_activos (categoria_id);

-- RLS categorias / subcategorias (alinhado a patrimonio_activos)
alter table public.patrimonio_categorias enable row level security;
alter table public.patrimonio_subcategorias enable row level security;

create policy "patrimonio_categorias: tenant select"
  on public.patrimonio_categorias for select
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_categorias.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_categorias: tenant insert"
  on public.patrimonio_categorias for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_categorias.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_categorias: tenant update"
  on public.patrimonio_categorias for update
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_categorias.empresa_id = p.empresa_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_categorias.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_categorias: tenant delete"
  on public.patrimonio_categorias for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and public.patrimonio_categorias.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_subcategorias: tenant select"
  on public.patrimonio_subcategorias for select
  using (
    exists (
      select 1 from public.patrimonio_categorias cat
      join public.profiles p on p.auth_user_id = auth.uid()
      where cat.id = public.patrimonio_subcategorias.categoria_id
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and cat.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_subcategorias: tenant insert"
  on public.patrimonio_subcategorias for insert
  with check (
    exists (
      select 1 from public.patrimonio_categorias cat
      join public.profiles p on p.auth_user_id = auth.uid()
      where cat.id = public.patrimonio_subcategorias.categoria_id
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and cat.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_subcategorias: tenant update"
  on public.patrimonio_subcategorias for update
  using (
    exists (
      select 1 from public.patrimonio_categorias cat
      join public.profiles p on p.auth_user_id = auth.uid()
      where cat.id = public.patrimonio_subcategorias.categoria_id
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and cat.empresa_id = p.empresa_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.patrimonio_categorias cat
      join public.profiles p on p.auth_user_id = auth.uid()
      where cat.id = public.patrimonio_subcategorias.categoria_id
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and cat.empresa_id = p.empresa_id)
        )
    )
  );

create policy "patrimonio_subcategorias: tenant delete"
  on public.patrimonio_subcategorias for delete
  using (
    exists (
      select 1 from public.patrimonio_categorias cat
      join public.profiles p on p.auth_user_id = auth.uid()
      where cat.id = public.patrimonio_subcategorias.categoria_id
        and (
          (p.perfil in ('Admin', 'PCA') and p.empresa_id is null)
          or (p.empresa_id is not null and cat.empresa_id = p.empresa_id)
        )
    )
  );
