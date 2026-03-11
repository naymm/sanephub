-- =============================================================================
-- GRUPO SANEP — Todas as tabelas do projecto com relacionamentos
-- Ordem: tabelas base primeiro, depois tabelas que referenciam outras
-- =============================================================================

-- 1. Empresas (tenant do grupo)
create table if not exists public.empresas (
  id bigserial primary key,
  codigo text not null,
  nome text not null,
  nif text,
  morada text,
  activo boolean not null default true,
  modulos_ativos text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(codigo)
);

-- 2. Departamentos (catálogo)
create table if not exists public.departamentos (
  id bigserial primary key,
  nome text not null,
  created_at timestamptz default now()
);

-- 3. Colaboradores (por empresa)
create table if not exists public.colaboradores (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  nome text not null,
  data_nascimento date not null,
  genero text not null check (genero in ('M', 'F', 'Outro')),
  estado_civil text not null default '',
  bi text not null default '',
  nif text not null default '',
  niss text not null default '',
  nacionalidade text not null default '',
  endereco text not null default '',
  cargo text not null default '',
  departamento text not null default '',
  data_admissao date not null,
  tipo_contrato text not null check (tipo_contrato in ('Efectivo', 'Prazo Certo', 'Prestação', 'Estágio')),
  data_fim_contrato date,
  salario_base numeric(18,2) not null default 0,
  iban text not null default '',
  email_corporativo text not null,
  email_pessoal text,
  telefone_principal text not null default '',
  telefone_alternativo text,
  contacto_emergencia_nome text,
  contacto_emergencia_telefone text,
  status text not null default 'Activo' check (status in ('Activo', 'Inactivo', 'Suspenso', 'Em férias')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_colaboradores_empresa on public.colaboradores(empresa_id);

-- 4. Centros de custo (por empresa)
create table if not exists public.centros_custo (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  codigo text not null,
  nome text not null,
  descricao text not null default '',
  responsavel text not null default '',
  orcamento_mensal numeric(18,2) not null default 0,
  orcamento_anual numeric(18,2) not null default 0,
  gasto_actual numeric(18,2) not null default 0,
  status text not null default 'Activo' check (status in ('Activo', 'Inactivo')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(empresa_id, codigo)
);
create index idx_centros_custo_empresa on public.centros_custo(empresa_id);

-- 5. Projectos (por empresa)
create table if not exists public.projectos (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  codigo text not null,
  nome text not null,
  descricao text not null default '',
  responsavel text not null default '',
  orcamento_total numeric(18,2) not null default 0,
  gasto numeric(18,2) not null default 0,
  data_inicio date not null,
  data_fim date not null,
  status text not null default 'Activo' check (status in ('Activo', 'Concluído', 'Suspenso', 'Cancelado')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(empresa_id, codigo)
);
create index idx_projectos_empresa on public.projectos(empresa_id);

-- 6. Reuniões (participantes como array de IDs de colaboradores)
create table if not exists public.reunioes (
  id bigserial primary key,
  titulo text not null,
  data date not null,
  hora text not null default '',
  local text not null default '',
  tipo text not null default 'Ordinária' check (tipo in ('Ordinária', 'Extraordinária', 'Informal', 'Comissão')),
  pauta text not null default '',
  participantes bigint[] default '{}',
  status text not null default 'Agendada' check (status in ('Agendada', 'Realizada', 'Cancelada', 'Adiada')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. Actas (ligadas a reuniões)
create table if not exists public.actas (
  id bigserial primary key,
  reuniao_id bigint not null references public.reunioes(id) on delete cascade,
  numero text not null,
  data date not null,
  titulo text not null,
  conteudo text not null default '',
  aprovada_por text,
  status text not null default 'Rascunho' check (status in ('Rascunho', 'Em Revisão', 'Aprovada', 'Publicada', 'Arquivada')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_actas_reuniao on public.actas(reuniao_id);

-- 8. Contratos (jurídico, por empresa)
create table if not exists public.contratos (
  id bigserial primary key,
  empresa_id bigint references public.empresas(id) on delete set null,
  numero text not null,
  tipo text not null default '',
  parte_a text not null default '',
  parte_b text not null default '',
  objecto text not null default '',
  valor numeric(18,2) not null default 0,
  moeda text not null default 'Kz',
  data_assinatura date not null,
  data_inicio date not null,
  data_fim date not null,
  advogado text not null default '',
  responsavel_juridico text,
  ficheiro_pdf text,
  alertar_antes_dias int,
  status text not null default 'Activo' check (status in ('Activo', 'A Renovar', 'Em Negociação', 'Suspenso', 'Rescindido', 'Expirado')),
  historico jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_contratos_empresa on public.contratos(empresa_id);
create unique index idx_contratos_numero_empresa on public.contratos(empresa_id, numero) where empresa_id is not null;

-- 9. Requisições (finanças, por empresa)
create table if not exists public.requisicoes (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  num text not null,
  fornecedor text not null,
  nif_fornecedor text,
  descricao text not null,
  quantidade int,
  valor_unitario numeric(18,2),
  valor numeric(18,2) not null,
  departamento text not null default '',
  centro_custo text not null default '',
  projecto text,
  data date not null,
  status text not null default 'Pendente' check (status in ('Pendente', 'Em Análise', 'Aprovado', 'Rejeitado', 'Pago', 'Enviado à Contabilidade')),
  proforma boolean not null default false,
  proforma_anexos text[],
  factura boolean not null default false,
  factura_final_anexos text[],
  comprovante boolean not null default false,
  enviado_contabilidade boolean not null default false,
  motivo_rejeicao text,
  aprovado_por text,
  data_pagamento date,
  observacoes text,
  requisitante_colaborador_id bigint references public.colaboradores(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(empresa_id, num)
);
create index idx_requisicoes_empresa on public.requisicoes(empresa_id);
create index idx_requisicoes_requisitante on public.requisicoes(requisitante_colaborador_id);

-- 10. Pagamentos (contabilidade, por requisição)
create table if not exists public.pagamentos (
  id bigserial primary key,
  requisicao_id bigint not null references public.requisicoes(id) on delete cascade,
  referencia text not null,
  beneficiario text not null,
  valor numeric(18,2) not null,
  data_pagamento date not null,
  metodo_pagamento text not null check (metodo_pagamento in ('Transferência', 'Cheque', 'Numerário', 'Outro')),
  conta_bancaria text,
  comprovante text,
  status text not null check (status in ('Recebido', 'Em conciliação', 'Conciliado', 'Devolvido')),
  registado_por text not null,
  registado_em timestamptz not null,
  observacoes text,
  created_at timestamptz default now()
);
create index idx_pagamentos_requisicao on public.pagamentos(requisicao_id);

-- 11. Movimentos de tesouraria (por empresa, opcionalmente centro_custo, projecto, requisição)
create table if not exists public.movimentos_tesouraria (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida')),
  referencia text not null,
  valor numeric(18,2) not null,
  data date not null,
  metodo_pagamento text not null check (metodo_pagamento in ('Transferência', 'Cheque', 'Numerário', 'MB', 'Outro')),
  descricao text not null default '',
  origem text,
  categoria_saida text check (categoria_saida in ('fornecedor', 'servicos', 'despesas_operacionais', 'impostos', 'salarios')),
  beneficiario text,
  centro_custo_id bigint references public.centros_custo(id) on delete set null,
  projecto_id bigint references public.projectos(id) on delete set null,
  comprovativo_anexos text[],
  requisicao_id bigint references public.requisicoes(id) on delete set null,
  registado_por text,
  registado_em timestamptz not null,
  observacoes text,
  created_at timestamptz default now()
);
create index idx_movimentos_tesouraria_empresa on public.movimentos_tesouraria(empresa_id);
create index idx_movimentos_tesouraria_data on public.movimentos_tesouraria(data);

-- 12. Férias (por colaborador)
create table if not exists public.ferias (
  id bigserial primary key,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  data_inicio date not null,
  data_fim date not null,
  dias int not null,
  status text not null default 'Pendente' check (status in ('Pendente', 'Aprovado', 'Rejeitado', 'Cancelado')),
  motivo text,
  solicitado_em date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_ferias_colaborador on public.ferias(colaborador_id);

-- 13. Faltas (por colaborador)
create table if not exists public.faltas (
  id bigserial primary key,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('Justificada', 'Injustificada', 'Atestado Médico', 'Licença')),
  motivo text not null default '',
  registado_por text not null,
  created_at timestamptz default now()
);
create index idx_faltas_colaborador on public.faltas(colaborador_id);

-- 14. Recibos de salário (por colaborador)
create table if not exists public.recibos_salario (
  id bigserial primary key,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  mes_ano text not null,
  vencimento_base numeric(18,2) not null default 0,
  subsidio_alimentacao numeric(18,2) not null default 0,
  subsidio_transporte numeric(18,2) not null default 0,
  outros_subsidios numeric(18,2) not null default 0,
  inss numeric(18,2) not null default 0,
  irt numeric(18,2) not null default 0,
  outras_deducoes numeric(18,2) not null default 0,
  liquido numeric(18,2) not null default 0,
  status text not null check (status in ('Emitido', 'Pago')),
  created_at timestamptz default now(),
  unique(colaborador_id, mes_ano)
);
create index idx_recibos_colaborador on public.recibos_salario(colaborador_id);

-- 15. Declarações (por colaborador)
create table if not exists public.declaracoes (
  id bigserial primary key,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  tipo text not null check (tipo in ('Para Banco', 'Embaixada', 'Rendimentos', 'Outro')),
  descricao text,
  banco text,
  pais_embaixada text,
  data_pedido date not null,
  data_emissao date,
  data_entrega date,
  status text not null default 'Pendente' check (status in ('Pendente', 'Emitida', 'Entregue')),
  emitido_por text,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_declaracoes_colaborador on public.declaracoes(colaborador_id);

-- 16. Processos judiciais (jurídico, por empresa)
create table if not exists public.processos_judiciais (
  id bigserial primary key,
  empresa_id bigint references public.empresas(id) on delete set null,
  numero text not null,
  tribunal text not null,
  tipo_accao text not null default '',
  autor text not null default '',
  reu text not null default '',
  valor_em_causa numeric(18,2) not null default 0,
  data_entrada date not null,
  proxima_audiencia date,
  status text not null default 'Em curso' check (status in ('Em curso', 'Suspenso', 'Encerrado', 'Ganho', 'Perdido', 'Acordo')),
  advogado text not null default '',
  descricao text not null default '',
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_processos_judiciais_empresa on public.processos_judiciais(empresa_id);

-- 17. Prazos legais (jurídico)
create table if not exists public.prazos_legais (
  id bigserial primary key,
  empresa_id bigint references public.empresas(id) on delete set null,
  titulo text not null,
  tipo text not null default '',
  descricao text not null default '',
  data_limite date not null,
  prioridade text not null default 'Média' check (prioridade in ('Baixa', 'Média', 'Alta', 'Crítica')),
  responsavel text not null default '',
  status text not null default 'Pendente' check (status in ('Pendente', 'Em Tratamento', 'Concluído', 'Vencido')),
  vinculo_processo text,
  vinculo_contrato text,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_prazos_legais_empresa on public.prazos_legais(empresa_id);
create index idx_prazos_legais_data on public.prazos_legais(data_limite);

-- 18. Riscos jurídicos
create table if not exists public.riscos_juridicos (
  id bigserial primary key,
  empresa_id bigint references public.empresas(id) on delete set null,
  codigo text not null,
  titulo text not null,
  descricao text not null default '',
  categoria text not null default '',
  probabilidade text not null default 'Média' check (probabilidade in ('Baixa', 'Média', 'Alta')),
  impacto text not null default 'Médio' check (impacto in ('Baixo', 'Médio', 'Alto')),
  nivel_risco text not null default 'Médio' check (nivel_risco in ('Baixo', 'Médio', 'Alto', 'Crítico')),
  plano_accao text not null default '',
  responsavel text not null default '',
  status text not null default 'Identificado' check (status in ('Identificado', 'Em monitorização', 'Mitigado', 'Materializado', 'Encerrado')),
  data_identificacao date,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_riscos_juridicos_empresa on public.riscos_juridicos(empresa_id);

-- 19. Processos disciplinares (por empresa e colaborador; JSONB para medidas e histórico)
create table if not exists public.processos_disciplinares (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  numero text not null,
  criado_em timestamptz not null,
  criado_por text not null,
  auto_ocorrencia_pdf text,
  auto_ocorrencia_descricao text not null default '',
  despacho_delegacao_pdf text,
  despacho_delegacao_data date,
  avaliacao_gravidade text check (avaliacao_gravidade in ('Leve', 'Média', 'Grave', 'Muito Grave')),
  parecer_juridico text,
  suspensao_preventiva_pdf text,
  suspensao_inicio date,
  suspensao_fim date,
  convocatoria_pdf text,
  convocatoria_data date,
  convocatoria_local text,
  convocatoria_motivo text,
  audiencia_data date,
  audiencia_acta_pdf text,
  relatorio_final_pdf text,
  relatorio_descricao text,
  relatorio_conclusao text,
  medidas_propostas jsonb not null default '[]',
  decisao_pca text check (decisao_pca in ('Aprova medida', 'Altera medida', 'Rejeita', 'Outra')),
  decisao_descricao text,
  decisao_pdf text,
  decisao_data date,
  comunicado_pdf text,
  comunicado_data date,
  status text not null default 'Em análise jurídica' check (status in ('Em análise jurídica', 'Suspensão preventiva', 'Em audiência', 'Relatório elaborado', 'Em decisão PCA', 'Comunicado emitido', 'Concluído')),
  encerrado_em date,
  historico jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(empresa_id, numero)
);
create index idx_processos_disciplinares_empresa on public.processos_disciplinares(empresa_id);
create index idx_processos_disciplinares_colaborador on public.processos_disciplinares(colaborador_id);

-- 20. Rescisões de contrato (por contrato e empresa)
create table if not exists public.rescisoes_contrato (
  id bigserial primary key,
  contrato_id bigint not null references public.contratos(id) on delete cascade,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  tipo text not null check (tipo in ('Resolução', 'Revogação', 'Caducidade')),
  motivo_detalhado text not null,
  data_rescisao date not null,
  documento_pdf text,
  criado_por text not null,
  criado_em timestamptz not null,
  created_at timestamptz default now()
);
create index idx_rescisoes_contrato_contrato on public.rescisoes_contrato(contrato_id);
create index idx_rescisoes_contrato_empresa on public.rescisoes_contrato(empresa_id);

-- 21. Correspondências (secretaria)
create table if not exists public.correspondencias (
  id bigserial primary key,
  tipo text not null check (tipo in ('Entrada', 'Saída')),
  remetente text not null default '',
  destinatario text not null default '',
  assunto text not null default '',
  referencia text not null default '',
  data date not null,
  prioridade text not null default 'Normal' check (prioridade in ('Normal', 'Urgente', 'Confidencial')),
  estado_resposta text not null default 'Pendente' check (estado_resposta in ('Pendente', 'Respondida', 'Não requer', 'Arquivada')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 22. Documentos oficiais (secretaria)
create table if not exists public.documentos_oficiais (
  id bigserial primary key,
  tipo text not null check (tipo in ('Deliberação', 'Despacho', 'Circular', 'Convocatória', 'Comunicado Interno')),
  numero text not null,
  titulo text not null,
  data date not null,
  autor text not null default '',
  status text not null default 'Rascunho' check (status in ('Rascunho', 'Em Revisão', 'Aprovado', 'Publicado', 'Arquivado')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 23. Notificações (id string/uuid)
create table if not exists public.notificacoes (
  id text primary key,
  tipo text not null check (tipo in ('info', 'alerta', 'urgente', 'sucesso')),
  titulo text not null,
  mensagem text not null,
  modulo_origem text not null default '',
  destinatario_perfil text[] default '{}',
  lida boolean not null default false,
  created_at timestamptz not null,
  link text
);
create index idx_notificacoes_lida on public.notificacoes(lida);

-- 24. Pendências documentais (referência polimórfica: entidade_tipo + entidade_id)
create table if not exists public.pendencias_documentais (
  id bigserial primary key,
  titulo text not null,
  tipo text not null check (tipo in ('Factura em falta', 'Comprovante em falta', 'Proforma em falta', 'Documento fiscal', 'Assinatura', 'Outro')),
  descricao text not null default '',
  entidade_ref text not null default '',
  entidade_tipo text not null check (entidade_tipo in ('Requisicao', 'Contrato', 'Processo', 'Outro')),
  entidade_id bigint not null,
  data_limite date,
  prioridade text not null check (prioridade in ('Baixa', 'Média', 'Alta', 'Urgente')),
  responsavel text not null default '',
  status text not null default 'Pendente' check (status in ('Pendente', 'Em tratamento', 'Regularizado', 'Vencido')),
  resolvido_em date,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 25. Relatórios mensais de planeamento (por empresa; arrays em JSONB)
create table if not exists public.relatorios_planeamento (
  id bigserial primary key,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  mes_ano text not null,
  status text not null default 'Rascunho' check (status in ('Rascunho', 'Submetido', 'Em análise', 'Consolidado')),
  actividades_comerciais text not null default '',
  principais_constrangimentos text not null default '',
  estrategias_receitas text not null default '',
  estrategias_custos text not null default '',
  ciclo_vida text not null default 'Crescimento' check (ciclo_vida in ('Startup', 'Crescimento', 'Maturidade', 'Declínio', 'Encerramento')),
  necessidades_investimento jsonb not null default '[]',
  stock_inicial jsonb not null default '[]',
  compras_periodo jsonb not null default '[]',
  stock_final jsonb not null default '[]',
  vendas_produtos jsonb not null default '[]',
  vendas_servicos jsonb not null default '[]',
  custo_mercadorias_vendidas jsonb not null default '[]',
  fornecimento_servicos_externos jsonb not null default '[]',
  gastos_pessoal jsonb not null default '[]',
  ebitda numeric(18,2),
  margem_bruta numeric(18,2),
  margem_ebitda numeric(18,2),
  saldos_bancarios jsonb not null default '[]',
  pendentes_pagamento jsonb not null default '[]',
  pendentes_recebimento jsonb not null default '[]',
  submetido_em timestamptz,
  submetido_por text,
  analisado_por text,
  analisado_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(empresa_id, mes_ano)
);
create index idx_relatorios_planeamento_empresa on public.relatorios_planeamento(empresa_id);

-- =============================================================================
-- FKs opcionais em profiles (referenciar empresas e colaboradores)
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'profiles'
    and constraint_name = 'fk_profiles_empresa'
  ) then
    alter table public.profiles
      add constraint fk_profiles_empresa
      foreign key (empresa_id) references public.empresas(id) on delete set null;
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'profiles'
    and constraint_name = 'fk_profiles_colaborador'
  ) then
    alter table public.profiles
      add constraint fk_profiles_colaborador
      foreign key (colaborador_id) references public.colaboradores(id) on delete set null;
  end if;
exception
  when undefined_table then null;
  when others then null;
end $$;

-- =============================================================================
-- Comentários
-- =============================================================================
comment on table public.empresas is 'Empresas do grupo (tenant).';
comment on table public.departamentos is 'Catálogo de departamentos.';
comment on table public.colaboradores is 'Colaboradores por empresa.';
comment on table public.centros_custo is 'Centros de custo por empresa.';
comment on table public.projectos is 'Projectos por empresa.';
comment on table public.reunioes is 'Reuniões agendadas.';
comment on table public.actas is 'Actas de reunião.';
comment on table public.contratos is 'Contratos jurídicos.';
comment on table public.requisicoes is 'Requisições de compra/serviço.';
comment on table public.pagamentos is 'Pagamentos (contabilidade).';
comment on table public.movimentos_tesouraria is 'Movimentos de tesouraria.';
comment on table public.ferias is 'Férias dos colaboradores.';
comment on table public.faltas is 'Faltas dos colaboradores.';
comment on table public.recibos_salario is 'Recibos de vencimento.';
comment on table public.declaracoes is 'Declarações (banco, rendimentos, etc.).';
comment on table public.processos_judiciais is 'Processos em tribunal.';
comment on table public.prazos_legais is 'Prazos processuais/legais.';
comment on table public.riscos_juridicos is 'Riscos jurídicos.';
comment on table public.processos_disciplinares is 'Processos disciplinares internos.';
comment on table public.rescisoes_contrato is 'Rescisões de contratos.';
comment on table public.correspondencias is 'Correspondência entrada/saída.';
comment on table public.documentos_oficiais is 'Documentos oficiais (deliberações, etc.).';
comment on table public.notificacoes is 'Notificações do sistema.';
comment on table public.pendencias_documentais is 'Pendências documentais.';
comment on table public.relatorios_planeamento is 'Relatórios mensais de planeamento.';
