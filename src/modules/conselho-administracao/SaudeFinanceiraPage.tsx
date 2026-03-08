import { useData } from '@/context/DataContext';
import { formatKz } from '@/utils/formatters';
import { KpiCard } from '@/components/shared/KpiCard';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function SaudeFinanceiraPage() {
  const { centrosCusto, requisicoes, pagamentos } = useData();

  const totalOrcamentoAnual = centrosCusto.reduce((s, cc) => s + (cc.orcamentoAnual ?? 0), 0);
  const totalGasto = centrosCusto.reduce((s, cc) => s + cc.gastoActual, 0);
  const percentagemUso = totalOrcamentoAnual > 0 ? Math.round((totalGasto / totalOrcamentoAnual) * 100) : 0;
  const reqPendentes = requisicoes.filter(r => r.status === 'Pendente' || r.status === 'Em Análise');
  const valorPendente = reqPendentes.reduce((s, r) => s + r.valor, 0);
  const pagamentosRecentes = pagamentos.slice(0, 6);

  const ccComUso = centrosCusto.map(cc => {
    const orc = cc.orcamentoMensal ?? cc.orcamentoAnual ?? 1;
    const pct = orc > 0 ? Math.round((cc.gastoActual / orc) * 100) : 0;
    return { nome: cc.nome, gasto: cc.gastoActual, orcamento: orc, percentagem: Math.min(pct, 100) };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-header">Saúde Financeira</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitorização consolidada da situação financeira do Grupo. Apenas supervisão; execução nas áreas de Finanças e Contabilidade.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Orçamento Anual (CC)" value={formatKz(totalOrcamentoAnual)} icon={<DollarSign className="h-5 w-5" />} />
        <KpiCard title="Gasto Actual" value={formatKz(totalGasto)} icon={<BarChart3 className="h-5 w-5" />} />
        <KpiCard title="Uso do Orçamento" value={`${percentagemUso}%`} icon={percentagemUso > 80 ? <TrendingDown className="h-5 w-5 text-destructive" /> : <TrendingUp className="h-5 w-5" />} className={percentagemUso > 80 ? 'border-destructive/30' : ''} />
        <KpiCard title="Requisições Pendentes" value={formatKz(valorPendente)} icon={<AlertTriangle className="h-5 w-5" />} description={`${reqPendentes.length} requisições`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-foreground mb-4">Gasto vs Orçamento por Centro de Custo</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ccComUso.slice(0, 8)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} layout="vertical" barCategoryGap="12">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatKz(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="gasto" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Gasto" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-xl border border-border/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-foreground mb-4">Pagamentos Recentes (amostra)</h3>
          <ul className="space-y-3">
            {pagamentosRecentes.map(p => (
              <li key={p.id} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0">
                <span className="text-muted-foreground">{p.referencia ?? 'Pagamento'}</span>
                <span className="font-mono font-medium">{formatKz(p.valor)}</span>
              </li>
            ))}
          </ul>
          {pagamentosRecentes.length === 0 && <p className="text-sm text-muted-foreground">Sem pagamentos registados.</p>}
        </div>
      </div>
    </div>
  );
}
