import { diaCivilPontoBounds } from '@/lib/pontoFusoHorario';

/**
 * Limites do dia civil em **WAT (UTC+1)** — não o fuso do navegador.
 * Usado para saber se já houve entrada/saída «hoje» no relógio oficial do ponto.
 */
export function localDiaCivilBounds(): { startIso: string; endIso: string; dateKey: string } {
  return diaCivilPontoBounds();
}

export function chaveSessionEntradaHoje(numeroMec: string, dateKey: string): string {
  return `sanep_ponto_entrada_${numeroMec.trim().toLowerCase()}_${dateKey}`;
}

export function chaveSessionSaidaHoje(numeroMec: string, dateKey: string): string {
  return `sanep_ponto_saida_${numeroMec.trim().toLowerCase()}_${dateKey}`;
}

/** Heurística alinhada a `tipo`/`kind` em `biometrico_registros` e ao insert ERP (`Entrada`). */
export function rowPareceEntrada(row: { tipo?: unknown; kind?: unknown }): boolean {
  const t = `${row.tipo ?? ''} ${row.kind ?? ''}`.toLowerCase();
  if (!t.trim()) return false;
  if (/\bsa[ií]da\b/.test(t) || t.includes('clock_out') || t.includes('checkout') || t.includes('check-out'))
    return false;
  if (t.includes('entrada') || t.includes('clock_in') || t.includes('checkin') || t.includes('picagem'))
    return true;
  return false;
}

/** Alinhado a marcação de saída pelo ERP (`Saída`) e variantes. */
export function rowPareceSaida(row: { tipo?: unknown; kind?: unknown }): boolean {
  const t = `${row.tipo ?? ''} ${row.kind ?? ''}`.toLowerCase();
  if (!t.trim()) return false;
  if (/\bsa[ií]da\b/.test(t) || t.includes('clock_out') || t.includes('checkout') || t.includes('check-out'))
    return true;
  return false;
}
