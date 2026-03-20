/**
 * Seed do banco de dados Supabase com dados de exemplo.
 * Requer: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (ou ambiente).
 *
 * Uso: npx tsx scripts/seed-db.ts
 *      npm run seed
 *
 * Opção --clear: apaga dados das tabelas antes de inserir (ordem inversa de dependências).
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { db } from '../src/lib/supabaseData';
import {
  EMPRESAS_SEED,
  DEPARTAMENTOS_SEED,
  COLABORADORES_SEED,
  CENTROS_CUSTO_SEED,
  PROJECTOS_SEED,
  REUNIOES_SEED,
  ACTAS_SEED,
  CONTRATOS_SEED,
  REQUISICOES_SEED,
  PAGAMENTOS_SEED,
  MOVIMENTOS_TESOURARIA_SEED,
  FERIAS_SEED,
  FALTAS_SEED,
  RECIBOS_SEED,
  DECLARACOES_SEED,
  PROCESSOS_SEED,
  PRAZOS_SEED,
  RISCOS_SEED,
  PROCESSOS_DISCIPLINARES_SEED,
  RESCISOES_CONTRATO_SEED,
  CORRESPONDENCIAS_SEED,
  DOCUMENTOS_OFICIAIS_SEED,
  PENDENCIAS_SEED,
  RELATORIOS_PLANEAMENTO_SEED,
  BANCOS_SEED,
} from '../src/data/seed';

function loadEnv(): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*([^#=]+)=(.*)$/);
        if (m) {
          const key = m[1].trim();
          const val = m[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  } catch {
    // ignore
  }
}

loadEnv();
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ficheiro .env');
  process.exit(1);
}

const supabase = createClient(url, key);
const clear = process.argv.includes('--clear');

async function clearTables(): Promise<void> {
  const tables = [
    'relatorios_planeamento', 'pendencias_documentais', 'documentos_oficiais', 'correspondencias',
    'rescisoes_contrato', 'processos_disciplinares', 'riscos_juridicos', 'prazos_legais', 'processos_judiciais',
    'declaracoes', 'recibos_salario', 'faltas', 'ferias', 'movimentos_tesouraria', 'contas_bancarias', 'bancos', 'pagamentos', 'requisicoes',
    'contratos', 'actas', 'reunioes', 'projectos', 'centros_custo', 'colaboradores', 'departamentos', 'empresas',
  ];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().gte('id', 0);
    if (error) {
      console.warn(`Aviso ao limpar ${table}:`, error.message);
    } else {
      console.log(`  Limpo: ${table}`);
    }
  }
}

function omitId<T extends { id?: number }>(row: T): Omit<T, 'id'> {
  const { id: _, ...rest } = row;
  return rest as Omit<T, 'id'>;
}

async function run(): Promise<void> {
  if (clear) {
    console.log('A limpar tabelas...');
    await clearTables();
  }

  console.log('A inserir dados de seed...');

  for (const row of EMPRESAS_SEED) {
    await db.empresas.insert(supabase, omitId(row));
  }
  console.log('  Empresas:', EMPRESAS_SEED.length);

  for (const row of BANCOS_SEED) {
    await db.bancos.insert(supabase, row);
  }
  console.log('  Bancos:', BANCOS_SEED.length);

  for (const row of DEPARTAMENTOS_SEED) {
    await db.departamentos.insert(supabase, omitId(row));
  }
  console.log('  Departamentos:', DEPARTAMENTOS_SEED.length);

  for (const row of COLABORADORES_SEED) {
    await db.colaboradores.insert(supabase, omitId(row));
  }
  console.log('  Colaboradores:', COLABORADORES_SEED.length);

  for (const row of CENTROS_CUSTO_SEED) {
    await db.centros_custo.insert(supabase, omitId(row));
  }
  console.log('  Centros de custo:', CENTROS_CUSTO_SEED.length);

  for (const row of PROJECTOS_SEED) {
    await db.projectos.insert(supabase, omitId(row));
  }
  console.log('  Projectos:', PROJECTOS_SEED.length);

  for (const row of REUNIOES_SEED) {
    await db.reunioes.insert(supabase, omitId(row));
  }
  console.log('  Reuniões:', REUNIOES_SEED.length);

  for (const row of ACTAS_SEED) {
    await db.actas.insert(supabase, omitId(row));
  }
  console.log('  Actas:', ACTAS_SEED.length);

  for (const row of CONTRATOS_SEED) {
    await db.contratos.insert(supabase, omitId(row));
  }
  console.log('  Contratos:', CONTRATOS_SEED.length);

  for (const row of REQUISICOES_SEED) {
    await db.requisicoes.insert(supabase, omitId(row));
  }
  console.log('  Requisições:', REQUISICOES_SEED.length);

  for (const row of PAGAMENTOS_SEED) {
    await db.pagamentos.insert(supabase, omitId(row));
  }
  console.log('  Pagamentos:', PAGAMENTOS_SEED.length);

  for (const row of MOVIMENTOS_TESOURARIA_SEED) {
    await db.movimentos_tesouraria.insert(supabase, omitId(row));
  }
  console.log('  Movimentos tesouraria:', MOVIMENTOS_TESOURARIA_SEED.length);

  for (const row of FERIAS_SEED) {
    await db.ferias.insert(supabase, omitId(row));
  }
  console.log('  Férias:', FERIAS_SEED.length);

  for (const row of FALTAS_SEED) {
    await db.faltas.insert(supabase, omitId(row));
  }
  console.log('  Faltas:', FALTAS_SEED.length);

  for (const row of RECIBOS_SEED) {
    await db.recibos_salario.insert(supabase, omitId(row));
  }
  console.log('  Recibos:', RECIBOS_SEED.length);

  for (const row of DECLARACOES_SEED) {
    await db.declaracoes.insert(supabase, omitId(row));
  }
  console.log('  Declarações:', DECLARACOES_SEED.length);

  for (const row of PROCESSOS_SEED) {
    await db.processos_judiciais.insert(supabase, omitId(row));
  }
  console.log('  Processos judiciais:', PROCESSOS_SEED.length);

  for (const row of PRAZOS_SEED) {
    await db.prazos_legais.insert(supabase, omitId(row));
  }
  console.log('  Prazos legais:', PRAZOS_SEED.length);

  for (const row of RISCOS_SEED) {
    await db.riscos_juridicos.insert(supabase, omitId(row));
  }
  console.log('  Riscos jurídicos:', RISCOS_SEED.length);

  for (const row of PROCESSOS_DISCIPLINARES_SEED) {
    await db.processos_disciplinares.insert(supabase, omitId(row));
  }
  console.log('  Processos disciplinares:', PROCESSOS_DISCIPLINARES_SEED.length);

  for (const row of RESCISOES_CONTRATO_SEED) {
    await db.rescisoes_contrato.insert(supabase, omitId(row));
  }
  console.log('  Rescisões contrato:', RESCISOES_CONTRATO_SEED.length);

  for (const row of CORRESPONDENCIAS_SEED) {
    await db.correspondencias.insert(supabase, omitId(row));
  }
  console.log('  Correspondências:', CORRESPONDENCIAS_SEED.length);

  for (const row of DOCUMENTOS_OFICIAIS_SEED) {
    await db.documentos_oficiais.insert(supabase, omitId(row));
  }
  console.log('  Documentos oficiais:', DOCUMENTOS_OFICIAIS_SEED.length);

  for (const row of PENDENCIAS_SEED) {
    await db.pendencias_documentais.insert(supabase, omitId(row));
  }
  console.log('  Pendências documentais:', PENDENCIAS_SEED.length);

  for (const row of RELATORIOS_PLANEAMENTO_SEED) {
    await db.relatorios_planeamento.insert(supabase, omitId(row));
  }
  console.log('  Relatórios planeamento:', RELATORIOS_PLANEAMENTO_SEED.length);

  console.log('Seed concluído com sucesso.');
}

run().catch((err) => {
  console.error('Erro ao executar seed:', err);
  process.exit(1);
});
