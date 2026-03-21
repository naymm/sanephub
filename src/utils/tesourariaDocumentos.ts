import type { MovimentoTesouraria } from '@/types';

/** Saída com proforma anexada mas sem factura final — mostrar alerta na lista. */
export function movimentoSaidaPrecisaFacturaFinal(
  m: Pick<MovimentoTesouraria, 'tipo' | 'proformaAnexos' | 'facturaFinalAnexos'>,
): boolean {
  if (m.tipo !== 'saida') return false;
  const temProforma = (m.proformaAnexos?.length ?? 0) > 0;
  const temFinal = (m.facturaFinalAnexos?.length ?? 0) > 0;
  return temProforma && !temFinal;
}
