import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapRowsFromDb } from '@/lib/supabaseMappers';
import { formatKz, parseMonetaryAmount } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type FacturaRow = {
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

const COLORS = ['#d4a926', '#a57e26', '#10B981', '#F59E0B', '#64748B', '#8B5CF6', '#ef4444', '#06b6d4'];

function facturaValorNumber(f: FacturaRow): number {
  const raw = f.totalFactura;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return parseMonetaryAmount(raw);
  return 0;
}

function facturaDateKeyIso(f: FacturaRow): string {
  const s = (f.createdAt ?? f.ultimaActualizacao ?? '').trim();
  if (!s) return '';
  return s.slice(0, 10);
}

export default function ReceitaPage() {
  const navigate = useNavigate();
  const { empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FacturaRow[]>([]);
  const [search, setSearch] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const empresaActiva = useMemo(() => {
    if (currentEmpresaId === 'consolidado') return undefined;
    return empresas.find(e => e.id === currentEmpresaId);
  }, [currentEmpresaId, empresas]);

  const empresaLabel = useMemo(() => {
    if (currentEmpresaId === 'consolidado') return 'Grupo (consolidado)';
    return empresaActiva?.codigo ?? 'Empresa';
  }, [currentEmpresaId, empresaActiva]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isSupabaseConfigured() || !supabase) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        let q = supabase
          .from('factura')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(2000);
        if (currentEmpresaId !== 'consolidado') q = q.eq('empresa_id', currentEmpresaId);
        const { data, error } = await q;
        if (error) throw error;
        const mapped = mapRowsFromDb<FacturaRow>('factura', (data ?? []) as Record<string, unknown>[]);
        if (!cancelled) setRows(mapped);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [currentEmpresaId]);

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
      return matchSearch && matchDate;
    });
  }, [rows, search, dataInicio, dataFim]);

  const total = useMemo(() => filtered.reduce((s, f) => s + facturaValorNumber(f), 0), [filtered]);
  const count = filtered.length;
  const avg = useMemo(() => (count > 0 ? total / count : 0), [total, count]);

  const porMes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of filtered) {
      const d = facturaDateKeyIso(f);
      if (!d) continue;
      const ym = d.slice(0, 7); // YYYY-MM
      map[ym] = (map[ym] || 0) + facturaValorNumber(f);
    }
    return Object.entries(map)
      .map(([ym, valor]) => {
        const [y, m] = ym.split('-');
        return { ym, label: `${m}/${y}`, valor };
      })
      .sort((a, b) => a.ym.localeCompare(b.ym))
      .slice(-12);
  }, [filtered]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-header">Receita</h1>
          <p className="text-sm text-muted-foreground mt-1">Facturação (resumo, gráficos e lista).</p>
          <p className="text-xs text-muted-foreground mt-2">
            Empresa: <span className="font-mono">{empresaLabel}</span>
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/facturacao')}>
          Abrir Facturação
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar (cliente, NIF, nº, tipo)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[140px] h-9" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[140px] h-9" />
        <Button variant="outline" onClick={() => { setSearch(''); setDataInicio(''); setDataFim(''); }} disabled={!search && !dataInicio && !dataFim}>
          Limpar filtros
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight font-mono tabular-nums">{formatKz(total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">No período/filtros actuais</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Itens</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight font-mono tabular-nums">{count}</p>
          <p className="mt-1 text-xs text-muted-foreground">Facturas</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Média</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight font-mono tabular-nums">{formatKz(avg)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Por factura</p>
        </div>
      </div>

      {/* Gráficos */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border/80 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Receita por mês</p>
              <p className="text-xs text-muted-foreground">Últimos {Math.min(12, porMes.length)} meses</p>
            </div>
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porMes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => `${(Number(v) / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(v: number) => formatKz(Number(v))} contentStyle={{ borderRadius: 8 }} />
                  <Bar dataKey="valor" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Receita por tipo</p>
              <p className="text-xs text-muted-foreground">Top {Math.min(10, porTipo.length)}</p>
            </div>
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={porTipo}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke="transparent"
                  >
                    {porTipo.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatKz(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}

      {/* Lista */}
      <div className="rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/80 px-4 py-3 text-sm text-muted-foreground flex items-center justify-between">
          <span>{loading ? 'A carregar…' : `${filtered.length} factura(s)`}</span>
          {currentEmpresaId !== 'consolidado' ? (
            <span>
              filtro: <span className="font-mono">empresa_id={currentEmpresaId}</span>
            </span>
          ) : null}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-2 px-4 w-36">Nº</th>
                <th className="py-2 px-4 w-40">Série</th>
                <th className="py-2 px-4 w-40">Tipo</th>
                <th className="py-2 px-4">Cliente</th>
                <th className="py-2 px-4 w-40">NIF</th>
                <th className="py-2 px-4 w-44 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {pagination.slice.map(f => (
                <tr key={f.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {f.numFactura != null ? f.numFactura : f.idFactura ?? '—'}
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums text-muted-foreground">{f.serie ?? '—'}</td>
                  <td className="py-2 px-4">{f.tipo ?? '—'}</td>
                  <td className="py-2 px-4">{f.cliente ?? '—'}</td>
                  <td className="py-2 px-4 font-mono tabular-nums">{f.nif ?? '—'}</td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums">{formatKz(facturaValorNumber(f))}</td>
                </tr>
              ))}
              {pagination.slice.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-sm text-muted-foreground">
                    Sem facturas para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-border/60">
          {pagination.slice.map(f => (
            <div key={f.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {f.numFactura != null ? f.numFactura : f.idFactura ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{f.cliente ?? '—'}</p>
                </div>
                <p className="text-sm font-mono tabular-nums">{formatKz(facturaValorNumber(f))}</p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{(f.tipo ?? '—').trim() || '—'}</span>
                <span className="font-mono">{facturaDateKeyIso(f) || '—'}</span>
              </div>
            </div>
          ))}
          {pagination.slice.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sem facturas para mostrar.</div>
          ) : null}
        </div>

        <div className="p-3">
          <DataTablePagination {...pagination.paginationProps} />
        </div>
      </div>
    </div>
  );
}

