import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { KpiCard } from '@/components/shared/KpiCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getGreeting, getCurrentDatePT, formatKz, formatDate, diasRestantes } from '@/utils/formatters';
import { Users, FileText, Scale, Calendar, Gavel, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#2563eb', '#0EA5E9', '#14B8A6', '#10B981', '#F59E0B', '#64748B', '#8B5CF6'];

export default function Dashboard() {
  const { user } = useAuth();
  const { colaboradores, requisicoes, contratos, reunioes, processos, prazos, centrosCusto } = useData();

  if (!user) return null;

  const activeColabs = colaboradores.filter(c => c.status === 'Activo').length;
  const pendingReqs = requisicoes.filter(r => r.status === 'Pendente' || r.status === 'Em Análise');
  const pendingReqValue = pendingReqs.reduce((s, r) => s + r.valor, 0);
  const expiringContracts = contratos.filter(c => {
    const d = diasRestantes(c.dataFim);
    return d >= 0 && d <= 90 && c.status !== 'Expirado' && c.status !== 'Rescindido';
  }).length;
  const scheduledMeetings = reunioes.filter(r => r.status === 'Agendada').length;
  const activeCases = processos.filter(p => p.status === 'Em curso').length;
  const criticalDeadlines = prazos.filter(p => p.status === 'Vencido' || (p.prioridade === 'Crítica' && p.status !== 'Concluído')).length;

  // Chart data
  const monthlyExpenses = [
    { mes: 'Jul', valor: 1850000 },
    { mes: 'Ago', valor: 2100000 },
    { mes: 'Set', valor: 1650000 },
    { mes: 'Out', valor: 2450000 },
    { mes: 'Nov', valor: 1920000 },
    { mes: 'Dez', valor: 2300000 },
  ];

  const ccExpenses = centrosCusto.map(cc => ({
    name: cc.nome,
    value: cc.gastoActual,
  }));

  const latestReqs = requisicoes.slice(0, 5);
  const nextMeetings = reunioes.filter(r => r.status === 'Agendada').slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Greeting — minimalista */}
      <div className="animate-fade-in">
        <h1 className="text-xl lg:text-2xl font-semibold text-foreground tracking-tight">
          {getGreeting()}, {user.nome.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 capitalize">{getCurrentDatePT()}</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Colaboradores Activos" value={activeColabs} icon={<Users className="h-5 w-5" />} />
        <KpiCard title="Requisições Pendentes" value={formatKz(pendingReqValue)} icon={<FileText className="h-5 w-5" />} description={`${pendingReqs.length} requisições`} />
        <KpiCard title="Contratos a Vencer" value={expiringContracts} icon={<Scale className="h-5 w-5" />} description="Próximos 90 dias" />
        <KpiCard title="Reuniões Agendadas" value={scheduledMeetings} icon={<Calendar className="h-5 w-5" />} />
        <KpiCard title="Processos em Curso" value={activeCases} icon={<Gavel className="h-5 w-5" />} />
        <KpiCard title="Prazos Críticos" value={criticalDeadlines} icon={<Clock className="h-5 w-5" />} className={criticalDeadlines > 0 ? "border-destructive/30" : ""} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Expenses Bar Chart */}
        <div className="bg-card rounded-xl border border-border/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-foreground mb-4">Despesas Mensais (últimos 6 meses)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyExpenses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatKz(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="valor" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expenses by CC - Pie Chart */}
        <div className="bg-card rounded-xl border border-border/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-foreground mb-4">Despesas por Centro de Custo</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={ccExpenses} cx="50%" cy="50%" innerRadius={56} outerRadius={88} paddingAngle={2} dataKey="value" nameKey="name" stroke="transparent">
                {ccExpenses.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatKz(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Requisitions */}
        <div className="table-container">
          <div className="px-5 py-4 border-b border-border/80">
            <h3 className="text-sm font-semibold text-foreground">Últimas Requisições</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/80">
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nº</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fornecedor</th>
                  <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {latestReqs.map(r => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-5 font-mono text-xs text-muted-foreground">{r.num}</td>
                    <td className="py-3 px-5">{r.fornecedor}</td>
                    <td className="py-3 px-5 text-right">{formatKz(r.valor)}</td>
                    <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Next Meetings + Alerts */}
        <div className="space-y-6">
          <div className="table-container">
            <div className="px-5 py-4 border-b border-border/80">
              <h3 className="text-sm font-semibold text-foreground">Próximas Reuniões</h3>
            </div>
            <div className="divide-y divide-border/50">
              {nextMeetings.length === 0 ? (
                <p className="py-5 px-5 text-sm text-muted-foreground">Sem reuniões agendadas</p>
              ) : (
                nextMeetings.map(r => (
                  <div key={r.id} className="py-3 px-5 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.titulo}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.data)} às {r.hora} — {r.local}</p>
                    </div>
                    <StatusBadge status={r.tipo} variant="gold" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Alerts */}
          <div className="table-container">
            <div className="px-5 py-4 border-b border-border/80">
              <h3 className="text-sm font-semibold text-foreground">Alertas</h3>
            </div>
            <div className="divide-y divide-border/50">
              {contratos.filter(c => c.status === 'A Renovar' || c.status === 'Expirado').map(c => (
                <div key={c.id} className="py-3 px-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.numero} — {c.parteB}</p>
                    <p className="text-xs text-muted-foreground">Vence: {formatDate(c.dataFim)}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
              {prazos.filter(p => p.status === 'Vencido').map(p => (
                <div key={p.id} className="py-3 px-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{p.titulo}</p>
                    <p className="text-xs text-muted-foreground">Prazo: {formatDate(p.dataLimite)}</p>
                  </div>
                  <StatusBadge status="VENCIDO" pulse />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
