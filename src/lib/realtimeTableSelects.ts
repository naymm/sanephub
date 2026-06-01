import type { RealtimeSyncTable } from '@/lib/dataTableSyncPolicy';

/** Projections PostgREST por tabela (evita `select=*` em listas grandes). */
const SELECT_BY_TABLE: Partial<Record<RealtimeSyncTable, string>> = {
  empresas: 'id, codigo, nome, nif, morada, activo, modulos_ativos, facturacao_activa, zona_facturacao',
  departamentos: 'id, nome',
  colaboradores:
    'id, empresa_id, numero_mec, nome, data_nascimento, genero, estado_civil, bi, nif, niss, nacionalidade, nivel_academico, foto_perfil_url, endereco, cargo, departamento, data_admissao, tipo_contrato, data_fim_contrato, salario_base, is_avencado, retencao_percent, subsidio_alimentacao, subsidio_transporte, outros_subsidios, subsidio_natal, abono_familia, subsidio_turno, subsidio_disponibilidade, subsidio_risco, subsidio_atavio, subsidio_representacao, iban, email_corporativo, email_pessoal, telefone_principal, telefone_alternativo, contacto_emergencia_nome, contacto_emergencia_telefone, status, horario_entrada, horario_saida, isencao_horario',
  ferias: 'id, colaborador_id, data_inicio, data_fim, dias, status, observacoes',
  faltas: 'id, colaborador_id, data, tipo, dias, observacoes',
  recibos_salario:
    'id, colaborador_id, mes_ano, vencimento_base, subsidio_alimentacao, subsidio_transporte, outros_subsidios, desconto_faltas, dias_falta_desconto, inss, irt, retencao, outras_deducoes, liquido, status',
  declaracoes: 'id, colaborador_id, tipo, descricao, data_pedido, status, data_emissao, pais_embaixada, banco',
  noticias: 'id, empresa_id, titulo, resumo, conteudo, imagem_url, galeria_urls, autor_perfil_id, publicado_em, activo',
  eventos: 'id, empresa_id, titulo, descricao, data_inicio, data_fim, local, imagem_url, alertar_antes_horas',
  comunicados: 'id, empresa_id, titulo, conteudo, data_publicacao, autor_perfil_id',
  requisicoes:
    'id, empresa_id, requisitante_colaborador_id, descricao, quantidade, valor_unitario, valor, status, centro_custo_id, projecto_id, data_pedido',
  centros_custo: 'id, empresa_id, nome, codigo, orcamento_mensal, orcamento_anual, gasto_actual',
  projectos: 'id, empresa_id, nome, codigo, orcamento_total, gasto, centro_custo_id, data_inicio, data_fim, status',
  reunioes: 'id, empresa_id, titulo, data, local, tipo, presidida_por, participantes_ids, participantes_nomes',
  actas: 'id, reuniao_id, titulo, data, conteudo, presidida_por, participantes_ids, participantes_nomes',
  contratos:
    'id, empresa_id, titulo, tipo, contraparte, valor, data_inicio, data_fim, status, alertar_antes_dias, contraparte_colaborador_id',
  processos_judiciais: 'id, empresa_id, titulo, numero, tribunal, valor_em_causa, status, data_abertura',
  prazos_legais: 'id, empresa_id, titulo, data_limite, tipo, status, processo_id',
  correspondencias: 'id, empresa_id, remetente, destinatario, assunto, data, tipo, status',
  documentos_oficiais: 'id, empresa_id, colaborador_id, titulo, tipo, data_ref, ficheiro_url, storage_path',
  riscos_juridicos: 'id, empresa_id, titulo, descricao, probabilidade, impacto, mitigacao, status',
  pagamentos: 'id, requisicao_id, valor, data, metodo, referencia',
  pendencias_documentais: 'id, entidade_tipo, entidade_id, descricao, data_limite, status',
  movimentos_tesouraria:
    'id, empresa_id, tipo, valor, data, descricao, centro_custo_id, projecto_id, requisicao_id, conta_bancaria_id',
  bancos: 'id, nome, codigo, swift',
  contas_bancarias: 'id, empresa_id, banco_id, numero, iban, saldo_actual, activo',
  relatorios_planeamento:
    'id, empresa_id, mes_ano, ebitda, margem_bruta, margem_ebitda, juros_financeiros, depreciacao_amortizacoes, impostos_lucro, resultado_liquido',
  processos_disciplinares: 'id, empresa_id, colaborador_id, titulo, status, data_abertura, data_fecho',
  rescisoes_contrato: 'id, empresa_id, contrato_id, colaborador_id, data, motivo, valor',
  geofences: 'id, empresa_id, nome, center_lat, center_lng, radius_meters, activo',
  colaborador_geofences: 'id, colaborador_id, geofence_id, empresa_id',
};

export const NOTIFICACOES_SELECT =
  'id, titulo, mensagem, link, destinatario_perfil, destinatario_colaborador_id, empresa_id, lida, created_at';

export const COLABORADORES_LIST_SELECT =
  'id, empresa_id, numero_mec, nome, cargo, departamento, status, foto_perfil_url, salario_base, is_avencado, retencao_percent, subsidio_alimentacao, subsidio_transporte, outros_subsidios, subsidio_natal, abono_familia, subsidio_turno, subsidio_disponibilidade, subsidio_risco, subsidio_atavio, subsidio_representacao';

export const COLABORADORES_DETAIL_SELECT = SELECT_BY_TABLE.colaboradores ?? 'id';

export function getRealtimeTableSelect(table: RealtimeSyncTable): string {
  return SELECT_BY_TABLE[table] ?? '*';
}
