import type { Usuario, Colaborador, Ferias, Falta, ReciboSalario, Declaracao, Requisicao, CentroCusto, Projecto, Reuniao, Acta, Contrato, ProcessoJudicial, PrazoLegal, Notificacao, Correspondencia, DocumentoOficial, RiscoJuridico, Pagamento, PendenciaDocumental, Departamento } from '@/types';

export const DEPARTAMENTOS_SEED: Departamento[] = [
  { id: 1, nome: 'Direcção' },
  { id: 2, nome: 'Capital Humano' },
  { id: 3, nome: 'Finanças' },
  { id: 4, nome: 'Contabilidade' },
  { id: 5, nome: 'Secretaria Geral' },
  { id: 6, nome: 'Jurídico' },
  { id: 7, nome: 'Tecnologia' },
  { id: 8, nome: 'Administrativo' },
  { id: 9, nome: 'Logística' },
];

export const USUARIOS_SEED: Usuario[] = [
  { id: 1, nome: "António Fernandes", email: "antonio@sanep.ao", senha: "admin123", perfil: "Admin", cargo: "Director Geral", departamento: "Direcção", avatar: "AF", permissoes: ["TODOS_MODULOS", "CRUD_TOTAL"] },
  { id: 2, nome: "Maria Silva", email: "maria@sanep.ao", senha: "rh123", perfil: "RH", cargo: "Gestora de Recursos Humanos", departamento: "Capital Humano", avatar: "MS", permissoes: ["CAPITAL_HUMANO_TOTAL", "DASHBOARD_READ"] },
  { id: 3, nome: "João Costa", email: "joao@sanep.ao", senha: "fin123", perfil: "Financeiro", cargo: "Gestor Financeiro", departamento: "Finanças", avatar: "JC", permissoes: ["FINANCAS_TOTAL", "DASHBOARD_READ"] },
  { id: 4, nome: "Ana Rodrigues", email: "ana@sanep.ao", senha: "cont123", perfil: "Contabilidade", cargo: "Contabilista Sénior", departamento: "Contabilidade", avatar: "AR", permissoes: ["CONTABILIDADE_TOTAL", "FINANCAS_READ", "DASHBOARD_READ"] },
  { id: 5, nome: "Carlos Mendes", email: "carlos@sanep.ao", senha: "sec123", perfil: "Secretaria", cargo: "Secretário Geral", departamento: "Secretaria Geral", avatar: "CM", permissoes: ["SECRETARIA_TOTAL", "DASHBOARD_READ"] },
  { id: 6, nome: "Isabel Lopes", email: "isabel@sanep.ao", senha: "jur123", perfil: "Juridico", cargo: "Directora Jurídica", departamento: "Jurídico", avatar: "IL", permissoes: ["JURIDICO_TOTAL", "DASHBOARD_READ"] },
  { id: 7, nome: "Pedro Santos", email: "pedro@sanep.ao", senha: "colab123", perfil: "Colaborador", cargo: "Técnico de TI", departamento: "Tecnologia", avatar: "PS", permissoes: ["PORTAL_COLABORADOR"], colaboradorId: 7, modulos: ["portal-colaborador", "financas"] },
  { id: 8, nome: "Rosa Neto", email: "rosa@sanep.ao", senha: "colab456", perfil: "Colaborador", cargo: "Assistente Administrativa", departamento: "Secretaria Geral", avatar: "RN", permissoes: ["PORTAL_COLABORADOR"], colaboradorId: 8 },
];

export const COLABORADORES_SEED: Colaborador[] = [
  { id: 1, nome: "António Fernandes", dataNascimento: "1975-03-15", genero: "M", estadoCivil: "Casado", bi: "000123456LA041", nif: "5417890123", niss: "1234567890", nacionalidade: "Angolana", endereco: "Rua da Missão, 45, Luanda", cargo: "Director Geral", departamento: "Direcção", dataAdmissao: "2010-01-15", tipoContrato: "Efectivo", salarioBase: 1500000, iban: "AO06004400006729033410175", emailCorporativo: "antonio@sanep.ao", telefonePrincipal: "+244 923 456 789", status: "Activo" },
  { id: 2, nome: "Maria Silva", dataNascimento: "1985-07-22", genero: "F", estadoCivil: "Solteira", bi: "000234567LA042", nif: "5417890124", niss: "1234567891", nacionalidade: "Angolana", endereco: "Av. 4 de Fevereiro, 120, Luanda", cargo: "Gestora de Recursos Humanos", departamento: "Capital Humano", dataAdmissao: "2015-06-01", tipoContrato: "Efectivo", salarioBase: 850000, iban: "AO06004400006729033410176", emailCorporativo: "maria@sanep.ao", telefonePrincipal: "+244 924 567 890", status: "Activo" },
  { id: 3, nome: "João Costa", dataNascimento: "1980-11-10", genero: "M", estadoCivil: "Casado", bi: "000345678LA043", nif: "5417890125", niss: "1234567892", nacionalidade: "Angolana", endereco: "Bairro Alvalade, Rua 12, Luanda", cargo: "Gestor Financeiro", departamento: "Finanças", dataAdmissao: "2013-03-10", tipoContrato: "Efectivo", salarioBase: 950000, iban: "AO06004400006729033410177", emailCorporativo: "joao@sanep.ao", telefonePrincipal: "+244 925 678 901", status: "Activo" },
  { id: 4, nome: "Ana Rodrigues", dataNascimento: "1988-02-28", genero: "F", estadoCivil: "Casada", bi: "000456789LA044", nif: "5417890126", niss: "1234567893", nacionalidade: "Angolana", endereco: "Morro Bento, Rua 5, Luanda", cargo: "Contabilista Sénior", departamento: "Contabilidade", dataAdmissao: "2016-09-15", tipoContrato: "Efectivo", salarioBase: 780000, iban: "AO06004400006729033410178", emailCorporativo: "ana@sanep.ao", telefonePrincipal: "+244 926 789 012", status: "Activo" },
  { id: 5, nome: "Carlos Mendes", dataNascimento: "1978-06-05", genero: "M", estadoCivil: "Divorciado", bi: "000567890LA045", nif: "5417890127", niss: "1234567894", nacionalidade: "Angolana", endereco: "Talatona, Condomínio Vida Pacífica, Luanda", cargo: "Secretário Geral", departamento: "Secretaria Geral", dataAdmissao: "2012-01-20", tipoContrato: "Efectivo", salarioBase: 900000, iban: "AO06004400006729033410179", emailCorporativo: "carlos@sanep.ao", telefonePrincipal: "+244 927 890 123", status: "Activo" },
  { id: 6, nome: "Isabel Lopes", dataNascimento: "1982-09-18", genero: "F", estadoCivil: "Casada", bi: "000678901LA046", nif: "5417890128", niss: "1234567895", nacionalidade: "Angolana", endereco: "Maianga, Rua Amílcar Cabral, Luanda", cargo: "Directora Jurídica", departamento: "Jurídico", dataAdmissao: "2014-04-01", tipoContrato: "Efectivo", salarioBase: 1100000, iban: "AO06004400006729033410180", emailCorporativo: "isabel@sanep.ao", telefonePrincipal: "+244 928 901 234", status: "Activo" },
  { id: 7, nome: "Pedro Santos", dataNascimento: "1992-12-03", genero: "M", estadoCivil: "Solteiro", bi: "000789012LA047", nif: "5417890129", niss: "1234567896", nacionalidade: "Angolana", endereco: "Viana, Zango 3, Luanda", cargo: "Técnico de TI", departamento: "Tecnologia", dataAdmissao: "2020-02-10", tipoContrato: "Prazo Certo", dataFimContrato: "2026-02-10", salarioBase: 450000, iban: "AO06004400006729033410181", emailCorporativo: "pedro@sanep.ao", telefonePrincipal: "+244 929 012 345", status: "Activo" },
  { id: 8, nome: "Rosa Neto", dataNascimento: "1995-04-25", genero: "F", estadoCivil: "Solteira", bi: "000890123LA048", nif: "5417890130", niss: "1234567897", nacionalidade: "Angolana", endereco: "Cacuaco, Rua Principal, Luanda", cargo: "Assistente Administrativa", departamento: "Secretaria Geral", dataAdmissao: "2021-08-01", tipoContrato: "Prazo Certo", dataFimContrato: "2026-08-01", salarioBase: 350000, iban: "AO06004400006729033410182", emailCorporativo: "rosa@sanep.ao", telefonePrincipal: "+244 930 123 456", status: "Activo" },
];

export const FERIAS_SEED: Ferias[] = [
  { id: 1, colaboradorId: 2, dataInicio: "2024-07-15", dataFim: "2024-08-05", dias: 22, status: "Aprovado", solicitadoEm: "2024-06-01" },
  { id: 2, colaboradorId: 3, dataInicio: "2024-12-20", dataFim: "2025-01-10", dias: 22, status: "Pendente", solicitadoEm: "2024-11-15" },
  { id: 3, colaboradorId: 7, dataInicio: "2024-09-01", dataFim: "2024-09-22", dias: 22, status: "Aprovado", solicitadoEm: "2024-07-20" },
  { id: 4, colaboradorId: 8, dataInicio: "2025-02-01", dataFim: "2025-02-22", dias: 22, status: "Pendente", solicitadoEm: "2025-01-05" },
  { id: 5, colaboradorId: 4, dataInicio: "2024-08-10", dataFim: "2024-09-01", dias: 22, status: "Rejeitado", motivo: "Período de fecho de contas", solicitadoEm: "2024-07-01" },
];

export const FALTAS_SEED: Falta[] = [
  { id: 1, colaboradorId: 7, data: "2024-10-14", tipo: "Justificada", motivo: "Consulta médica", registadoPor: "Maria Silva" },
  { id: 2, colaboradorId: 8, data: "2024-10-21", tipo: "Injustificada", motivo: "", registadoPor: "Maria Silva" },
  { id: 3, colaboradorId: 3, data: "2024-11-05", tipo: "Atestado Médico", motivo: "Gripe", registadoPor: "Maria Silva" },
  { id: 4, colaboradorId: 3, data: "2024-11-06", tipo: "Atestado Médico", motivo: "Gripe", registadoPor: "Maria Silva" },
  { id: 5, colaboradorId: 2, data: "2024-11-15", tipo: "Licença", motivo: "Licença nojo", registadoPor: "António Fernandes" },
  { id: 6, colaboradorId: 7, data: "2024-12-02", tipo: "Justificada", motivo: "Tratamento bancário", registadoPor: "Maria Silva" },
];

export const RECIBOS_SEED: ReciboSalario[] = [
  { id: 1, colaboradorId: 1, mesAno: "2024-11", vencimentoBase: 1500000, subsidioAlimentacao: 25000, subsidioTransporte: 20000, outrosSubsidios: 0, inss: 45000, irt: 225000, outrasDeducoes: 0, liquido: 1275000, status: "Pago" },
  { id: 2, colaboradorId: 2, mesAno: "2024-11", vencimentoBase: 850000, subsidioAlimentacao: 25000, subsidioTransporte: 20000, outrosSubsidios: 0, inss: 25500, irt: 105000, outrasDeducoes: 0, liquido: 764500, status: "Pago" },
  { id: 3, colaboradorId: 3, mesAno: "2024-11", vencimentoBase: 950000, subsidioAlimentacao: 25000, subsidioTransporte: 20000, outrosSubsidios: 0, inss: 28500, irt: 127500, outrasDeducoes: 0, liquido: 839000, status: "Pago" },
  { id: 4, colaboradorId: 7, mesAno: "2024-11", vencimentoBase: 450000, subsidioAlimentacao: 25000, subsidioTransporte: 20000, outrosSubsidios: 0, inss: 13500, irt: 37500, outrasDeducoes: 0, liquido: 444000, status: "Pago" },
];

export const DECLARACOES_SEED: Declaracao[] = [
  { id: 1, colaboradorId: 7, tipo: "Para Banco", descricao: "Crédito habitação", dataPedido: "2024-11-01", dataEmissao: "2024-11-05", status: "Entregue", emitidoPor: "Maria Silva" },
  { id: 2, colaboradorId: 3, tipo: "Rendimentos", dataPedido: "2024-11-10", status: "Emitida", dataEmissao: "2024-11-12", emitidoPor: "Maria Silva" },
  { id: 3, colaboradorId: 8, tipo: "Antiguidade", dataPedido: "2024-11-20", status: "Pendente" },
];

export const REQUISICOES_SEED: Requisicao[] = [
  { id: 1, num: "REQ-2024-0001", fornecedor: "TechSupply Lda", descricao: "Computadores portáteis x5", valor: 850000, centroCusto: "CC-002", departamento: "Tecnologia", data: "2024-09-15", status: "Enviado à Contabilidade", proforma: true, proformaAnexos: ["proforma_techsupply_2024.pdf"], factura: true, facturaFinalAnexos: ["factura_techsupply_final.pdf"], comprovante: true, enviadoContabilidade: true, requisitanteColaboradorId: 7 },
  { id: 2, num: "REQ-2024-0002", fornecedor: "Office Plus", descricao: "Material de escritório Q4", valor: 125000, centroCusto: "CC-001", departamento: "Administrativo", data: "2024-10-01", status: "Aprovado", proforma: true, proformaAnexos: ["OfficePlus_proforma_out2024.pdf"], factura: false, comprovante: false, enviadoContabilidade: false },
  { id: 3, num: "REQ-2024-0003", fornecedor: "CleanPro Lda", descricao: "Serviços de limpeza Nov/2024", valor: 200000, centroCusto: "CC-001", departamento: "Administrativo", data: "2024-10-20", status: "Pendente", proforma: true, factura: false, comprovante: false, enviadoContabilidade: false },
  { id: 4, num: "REQ-2024-0004", fornecedor: "AutoParts Angola", descricao: "Manutenção frota viaturas", valor: 450000, centroCusto: "CC-003", departamento: "Logística", data: "2024-11-01", status: "Em Análise", proforma: true, proformaAnexos: ["autoparts_proforma_nov.pdf", "detalhe_pecas.pdf"], factura: false, comprovante: false, enviadoContabilidade: false },
  { id: 5, num: "REQ-2024-0005", fornecedor: "PrintMax", descricao: "Serviços de impressão institucional", valor: 75000, centroCusto: "CC-001", departamento: "Administrativo", data: "2024-11-05", status: "Pago", proforma: true, factura: true, facturaFinalAnexos: ["printmax_factura_final.pdf"], comprovante: true, enviadoContabilidade: false },
  { id: 6, num: "REQ-2024-0006", fornecedor: "SegurNet Lda", descricao: "Renovação licenças antivírus", valor: 320000, centroCusto: "CC-002", departamento: "Tecnologia", data: "2024-11-10", status: "Rejeitado", proforma: true, factura: false, comprovante: false, enviadoContabilidade: false, motivoRejeicao: "Orçamento excedido para este mês", requisitanteColaboradorId: 7 },
  { id: 7, num: "REQ-2024-0007", fornecedor: "Catering XPTO", descricao: "Catering reunião de direcção", valor: 85000, centroCusto: "CC-001", departamento: "Administrativo", data: "2024-11-18", status: "Pendente", proforma: true, factura: false, comprovante: false, enviadoContabilidade: false, requisitanteColaboradorId: 8 },
  { id: 8, num: "REQ-2024-0008", fornecedor: "Consultoria RH Plus", descricao: "Formação equipa RH", valor: 600000, centroCusto: "CC-004", departamento: "Capital Humano", data: "2024-11-20", status: "Aprovado", proforma: true, proformaAnexos: ["RHPlus_proforma_formacao.pdf"], factura: true, facturaFinalAnexos: ["RHPlus_factura_final.pdf"], comprovante: false, enviadoContabilidade: false },
];

export const CENTROS_CUSTO_SEED: CentroCusto[] = [
  { id: 1, codigo: "CC-001", nome: "Administrativo", descricao: "Custos administrativos gerais", responsavel: "Carlos Mendes", orcamentoMensal: 500000, orcamentoAnual: 6000000, gastoActual: 410000, status: "Activo" },
  { id: 2, codigo: "CC-002", nome: "Tecnologia de Informação", descricao: "Infra-estrutura e software", responsavel: "Pedro Santos", orcamentoMensal: 800000, orcamentoAnual: 9600000, gastoActual: 1170000, status: "Activo" },
  { id: 3, codigo: "CC-003", nome: "Logística", descricao: "Transporte e distribuição", responsavel: "João Costa", orcamentoMensal: 1200000, orcamentoAnual: 14400000, gastoActual: 450000, status: "Activo" },
  { id: 4, codigo: "CC-004", nome: "Recursos Humanos", descricao: "Formação e desenvolvimento", responsavel: "Maria Silva", orcamentoMensal: 300000, orcamentoAnual: 3600000, gastoActual: 600000, status: "Activo" },
  { id: 5, codigo: "CC-005", nome: "Jurídico", descricao: "Serviços jurídicos e consultoria", responsavel: "Isabel Lopes", orcamentoMensal: 400000, orcamentoAnual: 4800000, gastoActual: 180000, status: "Activo" },
  { id: 6, codigo: "CC-006", nome: "Comercial", descricao: "Vendas e marketing", responsavel: "António Fernandes", orcamentoMensal: 600000, orcamentoAnual: 7200000, gastoActual: 350000, status: "Activo" },
  { id: 7, codigo: "CC-007", nome: "Operacional", descricao: "Operações core do grupo", responsavel: "António Fernandes", orcamentoMensal: 2000000, orcamentoAnual: 24000000, gastoActual: 1800000, status: "Activo" },
];

export const PROJECTOS_SEED: Projecto[] = [
  { id: 1, codigo: "PROJ-001", nome: "Modernização TI", descricao: "Actualização da infra-estrutura tecnológica", responsavel: "Pedro Santos", orcamentoTotal: 5000000, gasto: 850000, dataInicio: "2024-01-15", dataFim: "2025-06-30", status: "Activo" },
  { id: 2, codigo: "PROJ-002", nome: "Expansão Comercial Sul", descricao: "Abertura de escritórios no sul", responsavel: "António Fernandes", orcamentoTotal: 15000000, gasto: 3200000, dataInicio: "2024-03-01", dataFim: "2025-12-31", status: "Activo" },
  { id: 3, codigo: "PROJ-003", nome: "Formação Contínua 2024", descricao: "Programa de formação anual", responsavel: "Maria Silva", orcamentoTotal: 2000000, gasto: 1800000, dataInicio: "2024-01-01", dataFim: "2024-12-31", status: "Activo" },
];

export const REUNIOES_SEED: Reuniao[] = [
  { id: 1, titulo: "Reunião de Direcção Q4", data: "2024-12-15", hora: "09:00", local: "Sala de Conferências A", tipo: "Ordinária", pauta: "1. Aprovação do plano estratégico 2025\n2. Revisão orçamental Q4\n3. Novos projectos", participantes: [1, 2, 3, 5, 6], status: "Agendada" },
  { id: 2, titulo: "Comissão de Ética", data: "2024-12-10", hora: "14:00", local: "Sala B", tipo: "Comissão", pauta: "1. Análise de denúncias\n2. Revisão do código de ética", participantes: [1, 6, 5], status: "Agendada" },
  { id: 3, titulo: "Kick-off Projecto Expansão", data: "2024-11-20", hora: "10:00", local: "Auditório", tipo: "Extraordinária", pauta: "1. Apresentação do projecto\n2. Cronograma\n3. Atribuição de responsabilidades", participantes: [1, 2, 3, 4, 5, 6, 7, 8], status: "Realizada" },
  { id: 4, titulo: "Reunião RH — Avaliação de Desempenho", data: "2025-01-10", hora: "09:30", local: "Sala C", tipo: "Ordinária", pauta: "1. Critérios de avaliação\n2. Calendário\n3. Formadores internos", participantes: [1, 2], status: "Agendada" },
  { id: 5, titulo: "Revisão Contratual Anual", data: "2025-01-20", hora: "11:00", local: "Sala de Conferências A", tipo: "Ordinária", pauta: "1. Contratos a renovar\n2. Novos fornecedores\n3. Renegociações", participantes: [1, 3, 6], status: "Agendada" },
];

export const ACTAS_SEED: Acta[] = [
  { id: 1, reuniaoId: 3, numero: "ACT-2024-001", data: "2024-11-20", titulo: "Acta — Kick-off Projecto Expansão", conteudo: "Reunião realizada no Auditório. Decisões: aprovação do cronograma; atribuição de responsabilidades ao Pedro Santos (TI), António Fernandes (Comercial).", aprovadaPor: "António Fernandes", status: "Publicada" },
  { id: 2, reuniaoId: 2, numero: "ACT-2024-002", data: "2024-12-10", titulo: "Acta — Comissão de Ética", conteudo: "Em elaboração.", aprovadaPor: undefined, status: "Rascunho" },
];

export const CONTRATOS_SEED: Contrato[] = [
  { id: 1, numero: "CONT-2023-0001", tipo: "Fornecimento", parteA: "Grupo SANEP", parteB: "TechSupply Lda", objecto: "Fornecimento de equipamento informático", valor: 12000000, moeda: "Kz", dataAssinatura: "2023-01-15", dataInicio: "2023-02-01", dataFim: "2026-01-31", advogado: "Isabel Lopes", status: "Activo" },
  { id: 2, numero: "CONT-2023-0002", tipo: "Prestação de Serviços", parteA: "Grupo SANEP", parteB: "CleanPro Lda", objecto: "Serviços de limpeza das instalações", valor: 2400000, moeda: "Kz", dataAssinatura: "2023-03-01", dataInicio: "2023-04-01", dataFim: "2025-03-31", advogado: "Isabel Lopes", status: "A Renovar" },
  { id: 3, numero: "CONT-2024-0003", tipo: "Arrendamento", parteA: "Grupo SANEP", parteB: "Imobiliária Luanda SA", objecto: "Arrendamento do escritório central", valor: 36000000, moeda: "Kz", dataAssinatura: "2024-01-01", dataInicio: "2024-01-01", dataFim: "2028-12-31", advogado: "Isabel Lopes", status: "Activo" },
  { id: 4, numero: "CONT-2024-0004", tipo: "Parceria", parteA: "Grupo SANEP", parteB: "Consultoria RH Plus", objecto: "Programa de formação e desenvolvimento", valor: 5000000, moeda: "Kz", dataAssinatura: "2024-06-01", dataInicio: "2024-07-01", dataFim: "2025-06-30", advogado: "Isabel Lopes", status: "Activo" },
  { id: 5, numero: "CONT-2022-0005", tipo: "Fornecimento", parteA: "Grupo SANEP", parteB: "SegurNet Lda", objecto: "Segurança informática e antivírus", valor: 3600000, moeda: "Kz", dataAssinatura: "2022-06-01", dataInicio: "2022-07-01", dataFim: "2025-06-30", advogado: "Isabel Lopes", status: "A Renovar" },
  { id: 6, numero: "CONT-2021-0006", tipo: "Prestação de Serviços", parteA: "Grupo SANEP", parteB: "Advocacia Global", objecto: "Assessoria jurídica externa", valor: 8000000, moeda: "Kz", dataAssinatura: "2021-01-01", dataInicio: "2021-01-01", dataFim: "2024-12-31", advogado: "Isabel Lopes", status: "Expirado" },
];

export const PROCESSOS_SEED: ProcessoJudicial[] = [
  { id: 1, numero: "PROC-2023-0456", tribunal: "Tribunal Provincial de Luanda", tipoAccao: "Laboral", autor: "Ex-Colaborador Silva", reu: "Grupo SANEP", valorEmCausa: 5000000, dataEntrada: "2023-06-15", proximaAudiencia: "2025-02-20", status: "Em curso", advogado: "Isabel Lopes", descricao: "Reclamação de indemnização por despedimento" },
  { id: 2, numero: "PROC-2024-0123", tribunal: "Tribunal Comercial de Luanda", tipoAccao: "Comercial", autor: "Grupo SANEP", reu: "Fornecedor XYZ", valorEmCausa: 8500000, dataEntrada: "2024-02-10", proximaAudiencia: "2025-03-15", status: "Em curso", advogado: "Isabel Lopes", descricao: "Incumprimento contratual de fornecimento" },
  { id: 3, numero: "PROC-2024-0789", tribunal: "Tribunal Fiscal", tipoAccao: "Fiscal", autor: "AGT", reu: "Grupo SANEP", valorEmCausa: 15000000, dataEntrada: "2024-08-01", status: "Suspenso", advogado: "Isabel Lopes", descricao: "Contestação de liquidação adicional de IRT" },
  { id: 4, numero: "PROC-2022-0234", tribunal: "Tribunal Provincial de Luanda", tipoAccao: "Cível", autor: "Grupo SANEP", reu: "Construtora ABC", valorEmCausa: 25000000, dataEntrada: "2022-11-05", status: "Acordo", advogado: "Isabel Lopes", descricao: "Danos em obras de construção do armazém" },
];

export const PRAZOS_SEED: PrazoLegal[] = [
  { id: 1, titulo: "Resposta à contestação — Proc. Laboral", tipo: "Judicial", descricao: "Apresentar tréplica ao tribunal", dataLimite: "2025-01-15", prioridade: "Crítica", responsavel: "Isabel Lopes", status: "Vencido", vinculoProcesso: "PROC-2023-0456" },
  { id: 2, titulo: "Recurso — Proc. Fiscal AGT", tipo: "Fiscal", descricao: "Interpor recurso da decisão de liquidação", dataLimite: "2025-03-01", prioridade: "Alta", responsavel: "Isabel Lopes", status: "Pendente", vinculoProcesso: "PROC-2024-0789" },
  { id: 3, titulo: "Renovação contrato CleanPro", tipo: "Contratual", descricao: "Negociar e assinar renovação", dataLimite: "2025-03-15", prioridade: "Média", responsavel: "Isabel Lopes", status: "Em Tratamento", vinculoContrato: "CONT-2023-0002" },
  { id: 4, titulo: "Entrega de relatório anual AGT", tipo: "Fiscal", descricao: "Entrega da declaração anual de rendimentos", dataLimite: "2025-03-31", prioridade: "Alta", responsavel: "Ana Rodrigues", status: "Pendente" },
  { id: 5, titulo: "Audiência — Proc. Comercial", tipo: "Judicial", descricao: "Preparar alegações para audiência", dataLimite: "2025-03-15", prioridade: "Crítica", responsavel: "Isabel Lopes", status: "Em Tratamento", vinculoProcesso: "PROC-2024-0123" },
  { id: 6, titulo: "Renovação licenças software", tipo: "Contratual", descricao: "Renovar contratos de licenciamento", dataLimite: "2025-06-30", prioridade: "Média", responsavel: "Pedro Santos", status: "Pendente", vinculoContrato: "CONT-2022-0005" },
  { id: 7, titulo: "Vencimento prazo — recurso laboral", tipo: "Judicial", descricao: "Prazo para resposta ao recurso", dataLimite: "2025-02-10", prioridade: "Crítica", responsavel: "Isabel Lopes", status: "Vencido", vinculoProcesso: "PROC-2023-0456" },
  { id: 8, titulo: "Registo de marca comercial", tipo: "Administrativo", descricao: "Conclusão do processo de registo", dataLimite: "2025-05-01", prioridade: "Baixa", responsavel: "Isabel Lopes", status: "Pendente" },
];

export const CORRESPONDENCIAS_SEED: Correspondencia[] = [
  { id: 1, tipo: "Entrada", remetente: "Ministério das Finanças", destinatario: "Grupo SANEP", assunto: "Notificação fiscal — exercício 2023", referencia: "OF-MF-2024-1234", data: "2024-10-05", prioridade: "Urgente", estadoResposta: "Respondida" },
  { id: 2, tipo: "Saída", remetente: "Grupo SANEP", destinatario: "Tribunal Provincial de Luanda", assunto: "Contestação — Proc. Laboral", referencia: "OF-SANEP-2024-0089", data: "2024-10-15", prioridade: "Normal", estadoResposta: "Não requer" },
  { id: 3, tipo: "Entrada", remetente: "AGT", destinatario: "Grupo SANEP", assunto: "Solicitação de documentação fiscal", referencia: "AGT-2024-5678", data: "2024-11-01", prioridade: "Urgente", estadoResposta: "Pendente" },
  { id: 4, tipo: "Saída", remetente: "Grupo SANEP", destinatario: "CleanPro Lda", assunto: "Proposta de renovação contratual", referencia: "OF-SANEP-2024-0102", data: "2024-11-10", prioridade: "Normal", estadoResposta: "Pendente" },
  { id: 5, tipo: "Entrada", remetente: "Banco BFA", destinatario: "Grupo SANEP", assunto: "Confirmação de linha de crédito", referencia: "BFA-2024-3456", data: "2024-11-15", prioridade: "Confidencial", estadoResposta: "Arquivada" },
];

export const DOCUMENTOS_OFICIAIS_SEED: DocumentoOficial[] = [
  { id: 1, tipo: "Deliberação", numero: "DEL-2024-0001", titulo: "Aprovação do orçamento 2025", data: "2024-11-20", autor: "António Fernandes", status: "Publicado" },
  { id: 2, tipo: "Circular", numero: "CIRC-2024-0003", titulo: "Horário de funcionamento — período festivo", data: "2024-12-01", autor: "Carlos Mendes", status: "Publicado" },
  { id: 3, tipo: "Despacho", numero: "DES-2024-0005", titulo: "Nomeação da comissão de avaliação", data: "2024-10-15", autor: "António Fernandes", status: "Aprovado" },
  { id: 4, tipo: "Comunicado Interno", numero: "COM-2024-0008", titulo: "Manutenção programada dos sistemas", data: "2024-11-25", autor: "Pedro Santos", status: "Publicado" },
  { id: 5, tipo: "Despacho", numero: "DES-2023-0012", titulo: "Despacho interno — processo 2023", data: "2023-09-10", autor: "Carlos Mendes", status: "Arquivado" },
];

export const RISCOS_SEED: RiscoJuridico[] = [
  { id: 1, codigo: "RISC-2024-0001", titulo: "Processo laboral — risco de condenação", descricao: "Possibilidade de condenação no processo laboral por despedimento ilícito", categoria: "Laboral", probabilidade: "Média", impacto: "Alto", nivelRisco: "Alto", planoAccao: "Reforçar defesa jurídica; considerar acordo extrajudicial", responsavel: "Isabel Lopes", status: "Em monitorização" },
  { id: 2, codigo: "RISC-2024-0002", titulo: "Liquidação fiscal adicional", descricao: "AGT poderá impor liquidação adicional sobre exercícios anteriores", categoria: "Fiscal", probabilidade: "Alta", impacto: "Alto", nivelRisco: "Crítico", planoAccao: "Preparar recurso; reunir documentação comprovativa", responsavel: "Isabel Lopes", status: "Em monitorização" },
  { id: 3, codigo: "RISC-2024-0003", titulo: "Incumprimento contratual — fornecedor TI", descricao: "Fornecedor pode não cumprir prazos de entrega", categoria: "Contratual", probabilidade: "Baixa", impacto: "Médio", nivelRisco: "Baixo", planoAccao: "Monitorizar prazos; identificar fornecedor alternativo", responsavel: "Isabel Lopes", status: "Identificado" },
  { id: 4, codigo: "RISC-2024-0004", titulo: "Alteração regulamentar laboral", descricao: "Nova legislação pode alterar custos com pessoal", categoria: "Regulatório", probabilidade: "Média", impacto: "Médio", nivelRisco: "Médio", planoAccao: "Acompanhar desenvolvimentos legislativos", responsavel: "Isabel Lopes", status: "Identificado" },
  { id: 5, codigo: "RISC-2024-0005", titulo: "Exposição reputacional — processo comercial", descricao: "Publicidade negativa relacionada com litígio comercial", categoria: "Reputacional", probabilidade: "Baixa", impacto: "Alto", nivelRisco: "Médio", planoAccao: "Preparar comunicação de crise; manter confidencialidade", responsavel: "Isabel Lopes", status: "Identificado" },
];

export const PAGAMENTOS_SEED: Pagamento[] = [
  { id: 1, requisicaoId: 1, referencia: "PAG-2024-0001", beneficiario: "TechSupply Lda", valor: 850000, dataPagamento: "2024-10-05", metodoPagamento: "Transferência", contaBancaria: "BFA - Conta Corrente", status: "Conciliado", registadoPor: "Ana Rodrigues", registadoEm: "2024-10-05T14:00:00" },
  { id: 2, requisicaoId: 5, referencia: "PAG-2024-0002", beneficiario: "PrintMax", valor: 75000, dataPagamento: "2024-11-12", metodoPagamento: "Transferência", status: "Conciliado", registadoPor: "Ana Rodrigues", registadoEm: "2024-11-12T10:30:00" },
  { id: 3, requisicaoId: 2, referencia: "PAG-2024-0003", beneficiario: "Office Plus", valor: 125000, dataPagamento: "2024-11-20", metodoPagamento: "Transferência", status: "Em conciliação", registadoPor: "João Costa", registadoEm: "2024-11-20T09:00:00" },
];

export const PENDENCIAS_SEED: PendenciaDocumental[] = [
  { id: 1, titulo: "Factura REQ-2024-0002", tipo: "Factura em falta", descricao: "Aguardar factura do fornecedor Office Plus", entidadeRef: "REQ-2024-0002", entidadeTipo: "Requisicao", entidadeId: 2, dataLimite: "2024-12-15", prioridade: "Média", responsavel: "João Costa", status: "Em tratamento" },
  { id: 2, titulo: "Comprovante REQ-2024-0003", tipo: "Comprovante em falta", descricao: "Comprovante de pagamento CleanPro Nov/2024", entidadeRef: "REQ-2024-0003", entidadeTipo: "Requisicao", entidadeId: 3, prioridade: "Baixa", responsavel: "João Costa", status: "Pendente" },
  { id: 3, titulo: "Documento fiscal CONT-2023-0002", tipo: "Documento fiscal", descricao: "Certidão fiscal actualizada CleanPro para renovação", entidadeRef: "CONT-2023-0002", entidadeTipo: "Contrato", entidadeId: 2, dataLimite: "2025-02-28", prioridade: "Alta", responsavel: "Isabel Lopes", status: "Pendente" },
  { id: 4, titulo: "Proforma REQ-2024-0004", tipo: "Proforma em falta", descricao: "Proforma actualizada AutoParts Angola", entidadeRef: "REQ-2024-0004", entidadeTipo: "Requisicao", entidadeId: 4, prioridade: "Média", responsavel: "João Costa", status: "Em tratamento" },
  { id: 5, titulo: "Assinatura Deliberação 2025", tipo: "Assinatura", descricao: "Assinatura do DG na deliberação orçamental", entidadeRef: "DEL-2024-0001", entidadeTipo: "Outro", entidadeId: 0, dataLimite: "2024-12-10", prioridade: "Urgente", responsavel: "Carlos Mendes", status: "Regularizado", resolvidoEm: "2024-12-02" },
];

export const NOTIFICACOES_SEED: Notificacao[] = [
  { id: "n1", tipo: "info", titulo: "Requisição enviada", mensagem: "REQ-2024-0001 foi enviada para contabilidade", moduloOrigem: "financas", destinatarioPerfil: ["Contabilidade", "Admin"], lida: false, createdAt: "2024-11-20T10:00:00", link: "/financas/requisicoes" },
  { id: "n2", tipo: "alerta", titulo: "Contrato a vencer", mensagem: "Contrato CONT-2023-0002 (CleanPro) vence em 90 dias", moduloOrigem: "juridico", destinatarioPerfil: ["Juridico", "Admin"], lida: false, createdAt: "2024-11-25T09:00:00", link: "/juridico/contratos" },
  { id: "n3", tipo: "urgente", titulo: "Prazo legal vencido", mensagem: "Prazo de resposta à contestação já ultrapassou a data limite", moduloOrigem: "juridico", destinatarioPerfil: ["Juridico", "Admin"], lida: false, createdAt: "2024-11-26T08:00:00", link: "/juridico/prazos" },
  { id: "n4", tipo: "sucesso", titulo: "Férias aprovadas", mensagem: "As férias de Maria Silva foram aprovadas (Jul-Ago 2024)", moduloOrigem: "rh", destinatarioPerfil: ["RH", "Admin"], lida: true, createdAt: "2024-06-15T14:00:00", link: "/capital-humano/ferias" },
  { id: "n5", tipo: "info", titulo: "Reunião agendada", mensagem: "Reunião de Direcção Q4 agendada para 15/12", moduloOrigem: "secretaria", destinatarioPerfil: ["Admin", "RH", "Financeiro", "Secretaria", "Juridico"], lida: false, createdAt: "2024-12-01T10:00:00", link: "/secretaria/reunioes" },
  { id: "n6", tipo: "alerta", titulo: "Férias pendentes", mensagem: "2 pedidos de férias aguardam aprovação", moduloOrigem: "rh", destinatarioPerfil: ["RH", "Admin"], lida: false, createdAt: "2024-12-02T08:30:00", link: "/capital-humano/ferias" },
];
