-- Categoria «computador»: campos técnicos opcionais no activo (marca, modelo, SO, CPU, disco, RAM).

alter table public.patrimonio_categorias
  add column if not exists comportamento_computador boolean not null default false;

update public.patrimonio_categorias
set comportamento_computador = true
where slug = 'computador';

comment on column public.patrimonio_categorias.comportamento_computador is
  'Se verdadeiro, o formulário de activo pede dados de computador (marca, modelo, SO, etc.).';

alter table public.patrimonio_activos
  add column if not exists computador_marca text,
  add column if not exists computador_modelo text,
  add column if not exists computador_sistema_operacional text,
  add column if not exists computador_processador text,
  add column if not exists computador_armazenamento_gb integer,
  add column if not exists computador_ram_gb integer;

alter table public.patrimonio_activos drop constraint if exists patrimonio_activos_computador_so_check;
alter table public.patrimonio_activos
  add constraint patrimonio_activos_computador_so_check check (
    computador_sistema_operacional is null
    or computador_sistema_operacional in ('windows_10', 'windows_11', 'mac_os', 'linux')
  );

alter table public.patrimonio_activos drop constraint if exists patrimonio_activos_computador_arm_check;
alter table public.patrimonio_activos
  add constraint patrimonio_activos_computador_arm_check check (
    computador_armazenamento_gb is null or computador_armazenamento_gb >= 0
  );

alter table public.patrimonio_activos drop constraint if exists patrimonio_activos_computador_ram_check;
alter table public.patrimonio_activos
  add constraint patrimonio_activos_computador_ram_check check (computador_ram_gb is null or computador_ram_gb >= 0);

comment on column public.patrimonio_activos.computador_sistema_operacional is
  'windows_10 | windows_11 | mac_os | linux; opcional.';
