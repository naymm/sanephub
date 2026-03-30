import type { LinhaGestaoStockMateriaPrima, LinhaPlaneamento } from '@/types';
import { actualizarTotaisLinhas } from '@/utils/planeamentoCalculos';

function emptyLinha(): LinhaPlaneamento {
  return { descricao: '', quantidade: 0, precoUnitario: 0, total: 0 };
}

export function emptyGestaoStockMateriaRow(): LinhaGestaoStockMateriaPrima {
  return {
    descricao: '',
    qtdStockInicial: 0,
    precoUnitInicial: 0,
    qtdStockFinal: 0,
    precoUnitFinal: 0,
  };
}

/** Stock inicial + stock final: mesmo índice = mesma matéria-prima (descrição partilhada). */
export function unifiedMateriasStockFromLegacy(
  stockInicial: LinhaPlaneamento[],
  stockFinal: LinhaPlaneamento[],
): LinhaGestaoStockMateriaPrima[] {
  const n = Math.max(stockInicial.length, stockFinal.length, 0);
  const rows: LinhaGestaoStockMateriaPrima[] = [];
  for (let i = 0; i < n; i++) {
    const si = stockInicial[i] ?? emptyLinha();
    const sf = stockFinal[i] ?? emptyLinha();
    const desc = si.descricao || sf.descricao;
    rows.push({
      descricao: desc,
      qtdStockInicial: si.quantidade,
      precoUnitInicial: si.precoUnitario,
      qtdStockFinal: sf.quantidade,
      precoUnitFinal: sf.precoUnitario,
    });
  }
  return rows;
}

/** Actualiza só `stockInicial` e `stockFinal` (compras do período ficam inalteradas no formulário). */
export function legacyMateriasStockFromUnified(rows: LinhaGestaoStockMateriaPrima[]): {
  stockInicial: LinhaPlaneamento[];
  stockFinal: LinhaPlaneamento[];
} {
  const stockInicial = rows.map(r =>
    actualizarTotaisLinhas([
      {
        descricao: r.descricao,
        quantidade: r.qtdStockInicial,
        precoUnitario: r.precoUnitInicial,
        total: 0,
      },
    ])[0],
  );
  const stockFinal = rows.map(r =>
    actualizarTotaisLinhas([
      {
        descricao: r.descricao,
        quantidade: r.qtdStockFinal,
        precoUnitario: r.precoUnitFinal,
        total: 0,
      },
    ])[0],
  );
  return { stockInicial, stockFinal };
}
