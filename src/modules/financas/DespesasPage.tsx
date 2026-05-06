import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { formatDate, formatKz } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Search } from 'lucide-react';
import type { Requisicao } from '@/types';

const COLORS = ['#d4a926', '#a57e26', '#10B981', '#F59E0B', '#64748B', '#8B5CF6', '#ef4444', '#06b6d4'];

function useCountUp(target: number, opts?: { durationMs?: number; decimals?: number }): number {
  const durationMs = Math.max(150, Math.min(1200, opts?.durationMs ?? 650));
  const decimals = Math.max(0, Math.min(4, opts?.decimals ?? 0));

  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!Number.isFinite(target)) return;
    if (reduceMotion || durationMs <= 0) {
      setValue(target);
      return;
    }

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const from = fromRef.current;
    const to = target;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      const factor = Math.pow(10, decimals);
      const rounded = Math.round(next * factor) / factor;
      setValue(rounded);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        fromRef.current = to;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [target, durationMs, decimals]);

  return value;
}

export default function DespesasPage() {
  const navigate = useNavigate();
  const { requisicoes, centrosCusto } = useData();
  const [search, setSearch] = useState('');
  const [centroFilter, setCentroFilter] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const despesasAll = useMemo(() => requisicoes.filter(r => r.status === 'Pago'), [requisicoes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return despesasAll.filter(r => {
      const matchSearch =
        !q ||
        r.num.toLowerCase().includes(q) ||
        r.fornecedor.toLowerCase().includes(q) ||
        r.descricao.toLowerCase().includes(q);
      const matchCentro = centroFilter === 'todos' || r.centroCusto === centroFilter;
      let matchDate = true;
      if (dataInicio) matchDate = matchDate && r.data >= dataInicio;
      if (dataFim) matchDate = matchDate && r.data <= dataFim;
      return matchSearch && matchCentro && matchDate;
    });
  }, [despesasAll, search, centroFilter, dataInicio, dataFim]);

  const total = useMemo(() => filtered.reduce((s, r) => s + r.valor, 0), [filtered]);
  const count = filtered.length;
  const avg = useMemo(() => (count > 0 ? total / count : 0), [total, count]);

  const porCentroCusto = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) map[r.centroCusto] = (map[r.centroCusto] || 0) + r.valor;
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered]);

  const porMes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) {
      const key = String(r.data).slice(0, 7); // YYYY-MM
      map[key] = (map[key] || 0) + r.valor;
    }
    return Object.entries(map)
      .map(([ym, valor]) => {
        const [y, m] = ym.split('-');
        return { ym, label: `${m}/${y}`, valor };
      })
      .sort((a, b) => a.ym.localeCompare(b.ym))
      .slice(-12);
  }, [filtered]);

  const byCentro = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.centroCusto, (m.get(r.centroCusto) ?? 0) + r.valor);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filtered]);

  const pagination = useClientSidePagination({
    items: filtered.slice().sort((a, b) => b.data.localeCompare(a.data)),
    pageSize: 25,
  });

  const totalAnimated = useCountUp(total, { durationMs: 650, decimals: 2 });
  const countAnimated = useCountUp(count, { durationMs: 450, decimals: 0 });
  const avgAnimated = useCountUp(avg, { durationMs: 650, decimals: 2 });

  const centroLabel = (codigo: string) => centrosCusto.find(cc => cc.codigo === codigo)?.nome;

  const goToRequisicao = (r: Requisicao) => {
    // Sem rota de detalhe dedicada; reencaminhamos para a lista para consulta/gestão.
    navigate('/financas/requisicoes');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-header">Despesas</h1>
          <p className="text-sm text-muted-foreground mt-1">Requisições pagas (resumo e lista).</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/financas/requisicoes')}>
          Abrir Requisições
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar (nº, fornecedor, descrição)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={centroFilter} onValueChange={setCentroFilter}>
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue placeholder="Centro de custo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {centrosCusto.map(cc => (
              <SelectItem key={cc.id} value={cc.codigo}>
                {cc.codigo} — {cc.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dataInicio}
          onChange={e => setDataInicio(e.target.value)}
          className="w-[140px] h-9"
          placeholder="De"
        />
        <Input
          type="date"
          value={dataFim}
          onChange={e => setDataFim(e.target.value)}
          className="w-[140px] h-9"
          placeholder="Até"
        />
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight font-mono tabular-nums">{formatKz(totalAnimated)}</p>
          <p className="mt-1 text-xs text-muted-foreground">No período/filtros actuais</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Itens</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight font-mono tabular-nums">{Math.round(countAnimated)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Requisições pagas</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Média</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight font-mono tabular-nums">{formatKz(avgAnimated)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Por requisição paga</p>
        </div>
      </div>



      {byCentro.length > 0 ? (
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Top centros de custo</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byCentro.map(([codigo, valor]) => (
              <div key={codigo} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {codigo}
                  <span className="text-muted-foreground font-normal"> — {centroLabel(codigo) ?? '—'}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{formatKz(valor)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Gráficos */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border/80 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Despesas por mês</p>
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
                  <Bar dataKey="valor" fill="#d4a926" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Despesas por centro de custo</p>
              <p className="text-xs text-muted-foreground">Top {Math.min(10, porCentroCusto.length)}</p>
            </div>
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={porCentroCusto}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke="transparent"
                  >
                    {porCentroCusto.map((_, i) => (
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
      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nº</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fornecedor</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Centro</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(r => (
              <tr
                key={r.id}
                className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => goToRequisicao(r)}
              >
                <td className="py-3 px-5 font-mono text-xs">{r.num}</td>
                <td className="py-3 px-5 font-medium">{r.fornecedor}</td>
                <td className="py-3 px-5 text-muted-foreground max-w-72 truncate">{r.descricao}</td>
                <td className="py-3 px-5 text-muted-foreground">{r.centroCusto}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.valor)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(r.data)}</td>
                <td className="py-3 px-5">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {pagination.slice.map(r => (
          <button
            key={r.id}
            type="button"
            onClick={() => goToRequisicao(r)}
            className="w-full rounded-xl border border-border/80 bg-card p-4 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{r.num}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{r.fornecedor}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{r.descricao}</p>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="font-mono">{formatKz(r.valor)}</span>
              <span>{formatDate(r.data)}</span>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Sem despesas para mostrar.</p>
      ) : null}

      <DataTablePagination {...pagination.paginationProps} />
    </div>
  );
}

