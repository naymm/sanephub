import type { jsPDF } from 'jspdf';

export type JsPDFConstructor = new (opts?: Record<string, unknown>) => jsPDF;
export type JsPDFDoc = jsPDF;

/** Carrega `jspdf` apenas quando necessário (evita ~400KB no bundle inicial). */
export async function loadJsPDF(): Promise<JsPDFConstructor> {
  const mod = await import('jspdf');
  return (mod.jsPDF ?? mod.default) as JsPDFConstructor;
}

export type AutoTableFn = (
  doc: jsPDF,
  options: Record<string, unknown>,
) => void;

/** Carrega `jspdf` + `jspdf-autotable` em paralelo. */
export async function loadJsPDFWithAutoTable(): Promise<{
  jsPDF: JsPDFConstructor;
  autoTable: AutoTableFn;
}> {
  const [jspdfMod, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const jsPDF = (jspdfMod.jsPDF ?? jspdfMod.default) as JsPDFConstructor;
  const autoTable = (autoTableMod.default ?? autoTableMod.autoTable) as AutoTableFn;
  return { jsPDF, autoTable };
}
