import { parseMonetaryAmount } from '@/utils/formatters';

export type FacturaRow = {
  id: number;
  empresaId?: number | null;
  idFactura?: string | null;
  numFactura?: number | null;
  tipo?: string | null;
  serie?: number | null;
  cliente?: string | null;
  nif?: string | null;
  totalFactura?: string | null;
  totalIva?: string | null;
  totaMerc?: string | null;
  ultimaActualizacao?: string | null;
  createdAt?: string | null;
};

export function facturaValorNumber(f: FacturaRow): number {
  return parseMonetaryFromDb(f.totalFactura);
}

/** Valor monetário vindo da BD (total_factura). */
export function parseMonetaryFromDb(raw?: string | number | null): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') return parseMonetaryAmount(raw);
  return 0;
}

/** Normaliza data da factura para YYYY-MM-DD (ISO ou dd/mm/aaaa). */
export function parseFacturaDataIso(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return '';

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return s.slice(0, 10);
}

/** Data de referência da factura: sempre `ultima_actualizacao` (filtros, gráficos, ordenação). */
export function facturaDateKeyIso(f: FacturaRow): string {
  return parseFacturaDataIso(f.ultimaActualizacao);
}

/** Chave YYYY-MM da data da factura (para filtro por mês). */
export function facturaMesKey(f: FacturaRow): string {
  const d = facturaDateKeyIso(f);
  return d.length >= 7 ? d.slice(0, 7) : '';
}

/** Extrai YYYY-MM de `ultima_actualizacao` (BD). */
export function parseFacturaMesFromUltimaActualizacao(ultimaActualizacao?: string | null): string {
  const d = parseFacturaDataIso(ultimaActualizacao);
  return d.length >= 7 ? d.slice(0, 7) : '';
}

/** Todos os meses (YYYY-MM) em que existe pelo menos uma factura, mais recente primeiro. */
export function buildMesesFacturacaoDisponiveis(mesesComFactura: Iterable<string>): string[] {
  const set = new Set<string>();
  for (const ym of mesesComFactura) {
    if (/^\d{4}-\d{2}$/.test(ym)) set.add(ym);
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

/** Etiqueta legível para valor YYYY-MM (ex.: «Maio 2025»). */
export function formatMesAnoYm(ym: string): string {
  const [y, m] = ym.split('-');
  const mi = Number.parseInt(m ?? '', 10);
  if (!y || !Number.isFinite(mi) || mi < 1 || mi > 12) return ym;
  return `${MESES_PT[mi - 1]} ${y}`;
}

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

/** Etiqueta curta para eixo do gráfico (ex.: «Mai/25»). */
export function formatMesCurtoYm(ym: string): string {
  const [y, m] = ym.split('-');
  const mi = Number.parseInt(m ?? '', 10);
  if (!y || !Number.isFinite(mi) || mi < 1 || mi > 12) return ym;
  return `${MESES_CURTO[mi - 1]}/${y.slice(-2)}`;
}

export type MesComparacaoChart = {
  ym: string;
  label: string;
  labelCurto: string;
  valor: number;
  facturas: number;
  variacaoPct: number | null;
  variacaoValor: number | null;
};

/** Dados para gráficos de comparação mês a mês (variação vs mês anterior). */
export function enrichComparacaoMeses(
  items: { ym: string; valor: number; facturas: number }[],
): MesComparacaoChart[] {
  return items.map((row, i, arr) => {
    const prev = i > 0 ? arr[i - 1] : null;
    const variacaoValor = prev != null ? row.valor - prev.valor : null;
    const variacaoPct =
      prev != null && prev.valor > 0 ? ((row.valor - prev.valor) / prev.valor) * 100 : null;
    return {
      ...row,
      label: formatMesAnoYm(row.ym),
      labelCurto: formatMesCurtoYm(row.ym),
      variacaoPct,
      variacaoValor,
    };
  });
}

export function fmtDataPt(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('pt-PT');
}

export function tituloReferencia(f: FacturaRow): string {
  const idf = (f.idFactura ?? '').trim();
  if (idf) return idf;
  const s = f.serie != null ? String(f.serie) : '';
  const n = f.numFactura != null ? String(f.numFactura) : '';
  if (s || n) return [s, n].filter(Boolean).join(' / ');
  return `ID ${f.id}`;
}
