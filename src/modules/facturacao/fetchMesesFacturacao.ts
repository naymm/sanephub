import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildMesesFacturacaoDisponiveis,
  parseFacturaMesFromUltimaActualizacao,
  parseMonetaryFromDb,
} from '@/modules/facturacao/facturacaoShared';

const PAGE_SIZE = 1000;

export type MesComparacaoFacturacao = {
  ym: string;
  valor: number;
  facturas: number;
};

export type FacturacaoMesCatalog = {
  meses: string[];
  comparacao: MesComparacaoFacturacao[];
};

async function paginateFacturaDatasValores(
  supabase: SupabaseClient,
  currentEmpresaId: number | 'consolidado',
  onRow: (row: {
    ultima_actualizacao?: string | null;
    total_factura?: string | number | null;
  }) => void,
): Promise<void> {
  let offset = 0;

  for (;;) {
    let q = supabase
      .from('factura')
      .select('ultima_actualizacao, total_factura')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (currentEmpresaId !== 'consolidado') {
      q = q.eq('empresa_id', currentEmpresaId);
    }

    const { data, error } = await q;
    if (error) throw error;

    const batch = data ?? [];
    for (const row of batch) {
      onRow(
        row as {
          ultima_actualizacao?: string | null;
          total_factura?: string | number | null;
        },
      );
    }

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
}

/** Meses com facturação + totais por mês (consulta paginada completa). */
export async function fetchFacturacaoMesCatalog(
  supabase: SupabaseClient,
  currentEmpresaId: number | 'consolidado',
): Promise<FacturacaoMesCatalog> {
  const map = new Map<string, { valor: number; facturas: number }>();

  await paginateFacturaDatasValores(supabase, currentEmpresaId, row => {
    const ym = parseFacturaMesFromUltimaActualizacao(row.ultima_actualizacao);
    if (!ym) return;
    const cur = map.get(ym) ?? { valor: 0, facturas: 0 };
    cur.valor += parseMonetaryFromDb(row.total_factura);
    cur.facturas += 1;
    map.set(ym, cur);
  });

  const comparacao = [...map.entries()]
    .map(([ym, d]) => ({ ym, valor: d.valor, facturas: d.facturas }))
    .sort((a, b) => a.ym.localeCompare(b.ym));

  return {
    meses: buildMesesFacturacaoDisponiveis(map.keys()),
    comparacao,
  };
}

/** @deprecated Preferir fetchFacturacaoMesCatalog */
export async function fetchMesesFacturacaoDisponiveis(
  supabase: SupabaseClient,
  currentEmpresaId: number | 'consolidado',
): Promise<string[]> {
  const { meses } = await fetchFacturacaoMesCatalog(supabase, currentEmpresaId);
  return meses;
}
