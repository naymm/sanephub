import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapRowsFromDb } from '@/lib/supabaseMappers';
import { formatKz } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText, Search } from 'lucide-react';
import { PdfPreviewDialog } from '@/components/PdfPreviewDialog';
import { pdfPreviewUrlFromGeneratedBlob, releasePdfPreviewUrl } from '@/utils/pdfPreviewPublicUrl';
import { generateFacturaPdfBlob, type FacturaLinhaPdf } from '@/utils/facturaPdf';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchFacturacaoMesCatalog,
  type MesComparacaoFacturacao,
} from '@/modules/facturacao/fetchMesesFacturacao';
import {
  type FacturaRow,
  type MesComparacaoChart,
  enrichComparacaoMeses,
  facturaDateKeyIso,
  facturaMesKey,
  facturaValorNumber,
  fmtDataPt,
  formatMesAnoYm,
  tituloReferencia,
} from '@/modules/facturacao/facturacaoShared';

type ProdutoRow = {
  id: number;
  idFactura?: string | null;
  numLinha?: number | null;
  codArtigo?: string | null;
  descricao?: string | null;
  quantidade?: string | null;
  preco?: string | null;
  totalLiquido?: string | null;
  totalIva?: string | null;
  taxaIva?: string | null;
};

const CHART_COLORS = ['#d4a926', '#a57e26', '#10B981', '#F59E0B', '#64748B', '#8B5CF6', '#ef4444', '#06b6d4'];

function ComparacaoMesTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: MesComparacaoChart }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{p.label}</p>
      <p className="font-mono tabular-nums mt-1">{formatKz(p.valor)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{p.facturas} factura(s)</p>
      {p.variacaoPct != null ? (
        <p
          className={`text-xs font-medium mt-1 ${p.variacaoPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {p.variacaoPct >= 0 ? '+' : ''}
          {p.variacaoPct.toFixed(1)}% vs mês anterior
          {p.variacaoValor != null ? ` (${p.variacaoValor >= 0 ? '+' : ''}${formatKz(p.variacaoValor)})` : ''}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">Primeiro mês do período</p>
      )}
    </div>
  );
}

export default function FacturacaoPage() {
  const { empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FacturaRow[]>([]);
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [comparacaoMeses, setComparacaoMeses] = useState<MesComparacaoFacturacao[]>([]);
  const [debugHint, setDebugHint] = useState('');
  const [search, setSearch] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [mesFilter, setMesFilter] = useState<string>('todos');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const empresaActiva = useMemo(() => {
    if (currentEmpresaId === 'consolidado') return undefined;
    return empresas.find(e => e.id === currentEmpresaId);
  }, [currentEmpresaId, empresas]);

  const empresaLabel = useMemo(() => {
    if (currentEmpresaId === 'consolidado') return 'Grupo (consolidado)';
    return empresaActiva?.nome ?? empresaActiva?.codigo ?? 'Empresa';
  }, [currentEmpresaId, empresaActiva]);

  const refetch = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setRows([]);
      setMesesDisponiveis([]);
      setComparacaoMeses([]);
      return;
    }
    setLoading(true);
    try {
      const [catalog, facturasRes] = await Promise.all([
        fetchFacturacaoMesCatalog(supabase, currentEmpresaId),
        (async () => {
          let q = supabase.from('factura').select('*').limit(2000);
          if (currentEmpresaId !== 'consolidado') {
            q = q.eq('empresa_id', currentEmpresaId);
          }
          return q;
        })(),
      ]);

      const { data, error } = facturasRes;
      if (error) throw error;
      const mapped = mapRowsFromDb<FacturaRow>('factura', (data ?? []) as Record<string, unknown>[]).sort(
        (a, b) => facturaDateKeyIso(b).localeCompare(facturaDateKeyIso(a)),
      );
      setRows(mapped);
      setMesesDisponiveis(catalog.meses);
      setComparacaoMeses(catalog.comparacao);
      setMesFilter(prev => (prev !== 'todos' && !meses.includes(prev) ? 'todos' : prev));
      setDebugHint('');

      if (currentEmpresaId !== 'consolidado' && mapped.length === 0) {
        const { data: mini, error: miniErr } = await supabase
          .from('factura')
          .select('empresa_id, id_factura, num_factura')
          .limit(60);
        if (!miniErr && Array.isArray(mini) && mini.length > 0) {
          const ids = [...new Set(mini.map((r: { empresa_id?: number | null }) => r.empresa_id).filter(v => v != null))].slice(
            0,
            8,
          ) as number[];
          const idsTxt = ids.length ? ids.join(', ') : '—';
          setDebugHint(
            `Sem facturas para empresa_id=${currentEmpresaId}. Existem facturas noutras empresas_id (ex.: ${idsTxt}). ` +
              `Verifique se o empresa_id do ERP coincide com o id da empresa no Hub.`,
          );
        }
      }
    } catch (e) {
      console.error('[facturacao] erro ao carregar facturas', e);
      const anyE = e as { message?: string; details?: string; hint?: string; code?: string };
      const parts = [
        anyE?.message,
        anyE?.code ? `code=${anyE.code}` : '',
        anyE?.details,
        anyE?.hint,
      ].filter(Boolean);
      toast.error(parts.length ? parts.join(' · ') : 'Erro ao carregar facturas');
      setRows([]);
      setMesesDisponiveis([]);
      setComparacaoMeses([]);
      setDebugHint('');
    } finally {
      setLoading(false);
    }
  }, [currentEmpresaId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const t = (r.tipo ?? '').trim();
      if (t) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt'));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      const matchSearch =
        !q ||
        `${r.idFactura ?? ''} ${r.numFactura ?? ''} ${r.cliente ?? ''} ${r.nif ?? ''} ${r.tipo ?? ''} ${r.serie ?? ''}`
          .toLowerCase()
          .includes(q);
      const d = facturaDateKeyIso(r);
      let matchDate = true;
      if (dataInicio) matchDate = matchDate && d >= dataInicio;
      if (dataFim) matchDate = matchDate && d <= dataFim;
      const matchMes = mesFilter === 'todos' || facturaMesKey(r) === mesFilter;
      const matchTipo = tipoFilter === 'todos' || (r.tipo ?? '').trim() === tipoFilter;
      return matchSearch && matchDate && matchMes && matchTipo;
    });
  }, [rows, search, dataInicio, dataFim, mesFilter, tipoFilter]);

  const totalFacturacao = useMemo(
    () => filtered.reduce((s, f) => s + facturaValorNumber(f), 0),
    [filtered],
  );
  const count = filtered.length;
  const media = count > 0 ? totalFacturacao / count : 0;

  const comparacaoChart = useMemo(() => enrichComparacaoMeses(comparacaoMeses), [comparacaoMeses]);

  const resumoComparacao = useMemo(() => {
    if (comparacaoChart.length === 0) return null;
    const ultimo = comparacaoChart[comparacaoChart.length - 1];
    const melhor = comparacaoChart.reduce((a, b) => (b.valor > a.valor ? b : a), comparacaoChart[0]);
    return { ultimo, melhor };
  }, [comparacaoChart]);

  const porTipo = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of filtered) {
      const k = (f.tipo ?? '—').trim() || '—';
      map[k] = (map[k] || 0) + facturaValorNumber(f);
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered]);

  const pagination = useClientSidePagination({
    items: filtered.slice().sort((a, b) => facturaDateKeyIso(b).localeCompare(facturaDateKeyIso(a))),
    pageSize: 25,
  });

  const limparFiltros = () => {
    setSearch('');
    setDataInicio('');
    setDataFim('');
    setMesFilter('todos');
    setTipoFilter('todos');
  };

  const temFiltros = !!(search || dataInicio || dataFim || mesFilter !== 'todos' || tipoFilter !== 'todos');

  const abrirPreviewPdf = useCallback(
    async (f: FacturaRow) => {
      if (!isSupabaseConfigured() || !supabase) {
        toast.error('Supabase não configurado.');
        return;
      }
      setPdfBusy(true);
      try {
        const idFact = (f.idFactura ?? '').trim();
        let linhasRaw: ProdutoRow[] = [];
        if (idFact) {
          const { data, error } = await supabase
            .from('produto')
            .select('*')
            .eq('id_factura', idFact)
            .order('num_linha', { ascending: true });
          if (error) throw error;
          linhasRaw = mapRowsFromDb<ProdutoRow>('produto', (data ?? []) as Record<string, unknown>[]);
        }

        const linhas: FacturaLinhaPdf[] = linhasRaw.map(p => ({
          codArtigo: (p.codArtigo ?? '').trim() || '—',
          descricao: (p.descricao ?? '').trim() || '—',
          quantidade: (p.quantidade ?? '').trim() || '—',
          un: 'UN',
          precoUnitario: (p.preco ?? '').trim() || '—',
          desconto: '0,00',
          iva: (p.totalIva ?? '').trim() || '0,00',
          valor: (p.totalLiquido ?? '').trim() || '—',
        }));

        const totMerc = (f.totaMerc ?? '').trim() || (f.totalFactura ?? '').trim() || '—';
        const totIva = (f.totalIva ?? '').trim() || '0,00';
        const totFac = (f.totalFactura ?? '').trim() || '—';

        const ivaNum = Number(String(totIva).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
        const motivo =
          Number.isFinite(ivaNum) && Math.abs(ivaNum) < 0.0001
            ? 'Transmissão de bens e serviço não sujeita'
            : null;

        const blob = await generateFacturaPdfBlob({
          emitente: {
            nome: empresaActiva?.nome?.trim() || 'Empresa',
            nif: empresaActiva?.nif ?? null,
            morada: empresaActiva?.morada ?? null,
            contactoLinha: null,
          },
          referenciaDocumento: tituloReferencia(f),
          tipoDocumento: f.tipo ?? 'Factura',
          cliente: {
            nome: (f.cliente ?? '').trim() || '—',
            morada: null,
            nif: f.nif ?? null,
          },
          dataEmissao: fmtDataPt(f.ultimaActualizacao),
          moeda: 'AKZ',
          cambio: '—',
          requisicao: null,
          descontoComercial: '0,00',
          descontoAdicional: '0,00',
          vencimento: f.ultimaActualizacao?.trim() ? f.ultimaActualizacao : null,
          condicaoPagamento: 'Factura 30 dias',
          linhas,
          totMercadoria: totMerc,
          totIva,
          totalFactura: totFac,
          motivoIsencaoIva: motivo,
          dadosBancarios: null,
        });

        const previewUrl = await pdfPreviewUrlFromGeneratedBlob(blob, 'factura');
        setPdfUrl(previewUrl);
        setPdfOpen(true);
      } catch (e) {
        console.error('[facturacao] preview pdf', e);
        toast.error(e instanceof Error ? e.message : 'Erro ao gerar PDF');
      } finally {
        setPdfBusy(false);
      }
    },
    [empresaActiva],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Facturação</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dashboard da facturação sincronizada (soma de <span className="font-mono">total_factura</span>; datas por{' '}
          <span className="font-mono">ultima_actualizacao</span>).
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Empresa: <span className="font-medium text-foreground">{empresaLabel}</span>
          {currentEmpresaId !== 'consolidado' ? (
            <>
              {' '}
              · <span className="font-mono">empresa_id={currentEmpresaId}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar (cliente, NIF, nº, tipo)…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Input
          type="date"
          value={dataInicio}
          onChange={e => setDataInicio(e.target.value)}
          className="w-[140px] h-9"
          aria-label="Data início"
        />
        <Input
          type="date"
          value={dataFim}
          onChange={e => setDataFim(e.target.value)}
          className="w-[140px] h-9"
          aria-label="Data fim"
        />
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {mesesDisponiveis.map(ym => (
              <SelectItem key={ym} value={ym}>
                {formatMesAnoYm(ym)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {tiposDisponiveis.map(t => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-9" onClick={limparFiltros} disabled={!temFiltros}>
          Limpar filtros
        </Button>
        <Button variant="outline" className="h-9" onClick={() => void refetch()} disabled={loading}>
          {loading ? 'A carregar…' : 'Actualizar'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total facturação</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatKz(totalFacturacao)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Soma de total_factura (filtros activos)</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Facturas</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight font-mono tabular-nums">{count}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {rows.length !== count ? `${count} de ${rows.length} carregadas` : 'No resultado filtrado'}
          </p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Média por factura</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight font-mono tabular-nums">{formatKz(media)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Total ÷ número de facturas</p>
        </div>
      </div>

      {comparacaoChart.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Comparação entre meses</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Totais de <span className="font-mono">total_factura</span> em todos os meses com facturação (empresa
                actual).
              </p>
            </div>
            {resumoComparacao ? (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>
                  Último mês ({resumoComparacao.ultimo.labelCurto}):{' '}
                  <strong className="text-foreground font-mono">{formatKz(resumoComparacao.ultimo.valor)}</strong>
                  {resumoComparacao.ultimo.variacaoPct != null ? (
                    <span
                      className={
                        resumoComparacao.ultimo.variacaoPct >= 0
                          ? 'text-emerald-600 dark:text-emerald-400 ml-1'
                          : 'text-red-600 dark:text-red-400 ml-1'
                      }
                    >
                      ({resumoComparacao.ultimo.variacaoPct >= 0 ? '+' : ''}
                      {resumoComparacao.ultimo.variacaoPct.toFixed(1)}%)
                    </span>
                  ) : null}
                </span>
                <span>
                  Melhor mês ({resumoComparacao.melhor.labelCurto}):{' '}
                  <strong className="text-foreground font-mono">{formatKz(resumoComparacao.melhor.valor)}</strong>
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-border/80 bg-card p-4 xl:col-span-2">
              <p className="text-sm font-medium text-foreground">Total por mês</p>
              <p className="text-xs text-muted-foreground mt-0.5">Barras = valor facturado · linha = variação % vs mês anterior</p>
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={comparacaoChart} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="labelCurto"
                      tick={{ fontSize: 10 }}
                      interval={comparacaoChart.length > 18 ? Math.floor(comparacaoChart.length / 12) : 0}
                      angle={comparacaoChart.length > 8 ? -35 : 0}
                      textAnchor={comparacaoChart.length > 8 ? 'end' : 'middle'}
                      height={comparacaoChart.length > 8 ? 56 : 28}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="valor"
                      tick={{ fontSize: 11 }}
                      tickFormatter={v => `${(Number(v) / 1000).toFixed(0)}k`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="pct"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      tickFormatter={v => `${Number(v).toFixed(0)}%`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ComparacaoMesTooltip />} />
                    <Legend />
                    <Bar
                      yAxisId="valor"
                      dataKey="valor"
                      name="Total facturado"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                    <Line
                      yAxisId="pct"
                      type="monotone"
                      dataKey="variacaoPct"
                      name="Var. vs mês anterior (%)"
                      stroke="#d4a926"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-card p-4">
              <p className="text-sm font-medium text-foreground">Evolução mensal</p>
              <p className="text-xs text-muted-foreground mt-0.5">Linha de totais ao longo do tempo</p>
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={comparacaoChart} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="labelCurto"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={v => `${(Number(v) / 1000).toFixed(0)}k`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ComparacaoMesTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      name="Total"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-card p-4">
              <p className="text-sm font-medium text-foreground">Ranking por mês</p>
              <p className="text-xs text-muted-foreground mt-0.5">Comparação directa (ordenado por valor)</p>
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={[...comparacaoChart].sort((a, b) => b.valor - a.valor).slice(0, 12)}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickFormatter={v => `${(Number(v) / 1000).toFixed(0)}k`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="labelCurto"
                      width={52}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ComparacaoMesTooltip />} />
                    <Bar dataKey="valor" name="Total" fill="#a57e26" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {filtered.length > 0 && porTipo.length > 0 ? (
        <div className="rounded-xl border border-border/80 bg-card p-4 max-w-xl">
          <p className="text-sm font-semibold text-foreground">Facturação por tipo</p>
          <p className="text-xs text-muted-foreground mt-0.5">Filtros activos · top {Math.min(10, porTipo.length)}</p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={porTipo}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="transparent"
                >
                  {porTipo.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatKz(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/80 px-4 py-3 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>{loading ? 'A carregar…' : `${filtered.length} factura(s)`}</span>
        </div>
        {debugHint ? (
          <div className="border-b bg-amber-50/60 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            {debugHint}
          </div>
        ) : null}

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[1060px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-2 px-4 w-28">Últ. actualização</th>
                <th className="py-2 px-4 w-32">Nº</th>
                <th className="py-2 px-4 w-28">Série</th>
                <th className="py-2 px-4 w-36">Tipo</th>
                <th className="py-2 px-4">Cliente</th>
                <th className="py-2 px-4 w-36">NIF</th>
                <th className="py-2 px-4 w-44 text-right">Total</th>
                <th className="py-2 px-4 w-28 text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {pagination.slice.map(f => (
                <tr key={f.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-4 font-mono text-xs tabular-nums text-muted-foreground">
                    {fmtDataPt(f.ultimaActualizacao)}
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {f.numFactura != null ? f.numFactura : f.idFactura ?? '—'}
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums text-muted-foreground">{f.serie ?? '—'}</td>
                  <td className="py-2 px-4">{f.tipo ?? '—'}</td>
                  <td className="py-2 px-4">{f.cliente ?? '—'}</td>
                  <td className="py-2 px-4 font-mono tabular-nums">{f.nif ?? '—'}</td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums font-medium">
                    {formatKz(facturaValorNumber(f))}
                  </td>
                  <td className="py-2 px-4 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      disabled={pdfBusy}
                      onClick={() => void abrirPreviewPdf(f)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                  </td>
                </tr>
              ))}
              {pagination.slice.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 px-4 text-center text-sm text-muted-foreground">
                    Sem facturas para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-border/60">
          {pagination.slice.map(f => (
            <div key={f.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold font-mono tabular-nums">
                    {f.numFactura != null ? f.numFactura : f.idFactura ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{f.cliente ?? '—'}</p>
                </div>
                <p className="text-sm font-mono tabular-nums shrink-0">{formatKz(facturaValorNumber(f))}</p>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{f.tipo ?? '—'}</span>
                <span>{fmtDataPt(f.ultimaActualizacao)}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full gap-1"
                disabled={pdfBusy}
                onClick={() => void abrirPreviewPdf(f)}
              >
                <FileText className="h-3.5 w-3.5" />
                Pré-visualizar PDF
              </Button>
            </div>
          ))}
          {pagination.slice.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sem facturas para mostrar.</div>
          ) : null}
        </div>

        <div className="p-3 border-t border-border/80">
          <DataTablePagination {...pagination.paginationProps} />
        </div>
      </div>

      <PdfPreviewDialog
        open={pdfOpen}
        onOpenChange={open => {
          setPdfOpen(open);
          if (!open) {
            setPdfUrl(prev => {
              releasePdfPreviewUrl(prev);
              return null;
            });
          }
        }}
        url={pdfUrl}
        iframeTitle="Pré-visualização da factura"
        loadingText={pdfBusy ? 'A gerar PDF…' : 'A abrir…'}
      />
    </div>
  );
}
