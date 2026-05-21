/** Score = probabilidade × impacto (1–5 cada). */
export function ciRiscoScore(probabilidade: number, impacto: number): number {
  return Math.max(1, Math.min(25, probabilidade * impacto));
}

export function ciRiscoNivel(score: number): 'Baixo' | 'Médio' | 'Alto' | 'Crítico' {
  if (score >= 20) return 'Crítico';
  if (score >= 12) return 'Alto';
  if (score >= 6) return 'Médio';
  return 'Baixo';
}

export function ciRiscoNivelClass(nivel: ReturnType<typeof ciRiscoNivel>): string {
  if (nivel === 'Crítico') return 'bg-red-600 text-white';
  if (nivel === 'Alto') return 'bg-orange-500 text-white';
  if (nivel === 'Médio') return 'bg-amber-400 text-amber-950';
  return 'bg-emerald-500/90 text-white';
}
