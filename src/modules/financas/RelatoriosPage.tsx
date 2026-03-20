import { useState, useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { formatKz, formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Download, FileText } from 'lucide-react';

const COLORS = ['#d4a926', '#a57e26', '#d4a926', '#10B981', '#F59E0B', '#64748B', '#8B5CF6'];

function exportCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const line = (arr: (string | number)[]) => arr.map(c => (typeof c === 'string' && c.includes(',') ? `"${c}"` : c)).join(',');
  const csv = [line(headers), ...rows.map(r => line(r))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosPage() {
  const { requisicoes, centrosCusto, projectos } = useData();
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [mesInicio, setMesInicio] = useState('1');
  const [mesFim, setMesFim] = useState('12');
  const [centroRef, setCentroRef] = useState<string>('todos');

  const anoNum = parseInt(ano, 10);
  const mesINum = parseInt(mesInicio, 10);
  const mesFNum = parseInt(mesFim, 10);

  const filteredReqs = useMemo(() => {
    return requisicoes.filter(r => {
      const [y, m] = r.data.split('-').map(Number);
      if (y !== anoNum) return false;
      if (mesINum > 1 || mesFNum < 12) {
        if (m < mesINum || m > mesFNum) return false;
      }
      if (centroRef !== 'todos' && r.centroCusto !== centroRef) return false;
      return true;
    });
  }, [requisicoes, anoNum, mesINum, mesFNum, centroRef]);
  const pagination = useClientSidePagination({ items: filteredReqs, pageSize: 25 });

  const totalGasto = useMemo(() => filteredReqs.reduce((s, r) => s + r.valor, 0), [filteredReqs]);
  const porStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filteredReqs.forEach(r => {
      map[r.status] = (map[r.status] || 0) + r.valor;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredReqs]);

  const porCentroCusto = useMemo(() => {
    const map: Record<string, number> = {};
    filteredReqs.forEach(r => {
      map[r.centroCusto] = (map[r.centroCusto] || 0) + r.valor;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredReqs]);

  const porMes = useMemo(() => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const arr = meses.map((label, i) => {
      const m = i + 1;
      const val = filteredReqs.filter(r => parseInt(r.data.split('-')[1], 10) === m).reduce((s, r) => s + r.valor, 0);
      return { mes: label, valor: val };
    });
    return arr.slice(mesINum - 1, mesFNum);
  }, [filteredReqs, mesINum, mesFNum]);

  const handleExportCSV = () => {
    const headers = ['Nº', 'Fornecedor', 'Descrição', 'Centro Custo', 'Valor', 'Data', 'Status'];
    const rows = filteredReqs.map(r => [r.num, r.fornecedor, r.descricao, r.centroCusto, r.valor, r.data, r.status]);
    exportCSV(headers, rows, `relatorio-requisicoes-${ano}-${mesInicio}-${mesFim}.csv`);
  };

  return (
    <div className="space-y-8">
      <h1 className="page-header">Relatórios Financeiros</h1>

      {/* Filtros */}
      <div className="bg-card rounded-xl border border-border/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h3 className="text-sm font-semibold text-foreground mb-4">Período e filtros</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Ano</Label>
            <Input type="number" min="2020" max="2030" value={ano} onChange={e => setAno(e.target.value)} className="w-24" />
          </div>
          <div className="space-y-2">
            <Label>Mês início</Label>
            <Select value={mesInicio} onValueChange={setMesInicio}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <SelectItem key={m} value={String(m)}>{['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mês fim</Label>
            <Select value={mesFim} onValueChange={setMesFim}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <SelectItem key={m} value={String(m)}>{['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Centro de Custo</Label>
            <Select value={centroRef} onValueChange={setCentroRef}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {centrosCusto.map(cc => (
                  <SelectItem key={cc.id} value={cc.codigo}>{cc.codigo} — {cc.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total de requisições</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{filteredReqs.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor total (período)</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{formatKz(totalGasto)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Média por requisição</p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            {filteredReqs.length ? formatKz(Math.round(totalGasto / filteredReqs.length)) : '—'}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-foreground mb-4">Despesas por mês</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porMes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatKz(v)} contentStyle={{ borderRadius: 8 }} />
              <Bar dataKey="valor" fill="#d4a926" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-xl border border-border/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-foreground mb-4">Despesas por centro de custo</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porCentroCusto} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={56} outerRadius={88} paddingAngle={2} stroke="transparent">
                {porCentroCusto.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatKz(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {porStatus.length > 0 && (
        <div className="bg-card rounded-xl border border-border/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-foreground mb-4">Valor por status</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porStatus} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
              <Tooltip formatter={(v: number) => formatKz(v)} />
              <Bar dataKey="value" fill="#a57e26" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela resumo requisições */}
      <div className="table-container">
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Requisições no período</h3>
          <Button variant="ghost" size="sm" onClick={handleExportCSV}><FileText className="h-4 w-4 mr-1" /> Exportar</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/80">
                <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Nº</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Fornecedor</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Centro Custo</th>
                <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Valor</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Data</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {pagination.slice.map(r => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 px-5 font-mono text-xs">{r.num}</td>
                  <td className="py-3 px-5">{r.fornecedor}</td>
                  <td className="py-3 px-5 text-muted-foreground">{r.centroCusto}</td>
                  <td className="py-3 px-5 text-right font-mono">{formatKz(r.valor)}</td>
                  <td className="py-3 px-5 text-muted-foreground">{formatDate(r.data)}</td>
                  <td className="py-3 px-5">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataTablePagination {...pagination.paginationProps} />
      </div>
    </div>
  );
}
