import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { KpiCard } from '@/components/shared/KpiCard';
import { getGreeting, getCurrentDatePT, formatKz } from '@/utils/formatters';
import { Users, FileText, Scale, TrendingUp, Building2, BarChart3 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ConselhoDashboardPage() {
  const { user } = useAuth();
  const { colaboradores, requisicoes, centrosCusto, contratos, reunioes } = useData();

  if (!user) return null;

  const activeColabs = colaboradores.filter(c => c.status === 'Activo').length;
  const pendingReqs = requisicoes.filter(r => r.status === 'Pendente' || r.status === 'Em Análise');
  const totalOrcamento = centrosCusto.reduce((s, cc) => s + (cc.orcamentoAnual ?? 0), 0);
  const totalGasto = centrosCusto.reduce((s, cc) => s + cc.gastoActual, 0);
  const contratosActivos = contratos.filter(c => c.status === 'Vigente' || c.status === 'Em execução').length;
  const reunioesAgendadas = reunioes.filter(r => r.status === 'Agendada').length;

  const ccResumo = centrosCusto.slice(0, 6).map(cc => ({
    nome: cc.nome,
    gasto: cc.gastoActual,
    orcamento: cc.orcamentoMensal ?? 0,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-header">Painel do Conselho de Administração</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {getGreeting()}, {user.nome.split(' ')[0]}. {getCurrentDatePT()}.
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-2xl">
          Visibilidade estratégica consolidada do Grupo. Este painel é exclusivo para supervisão; a execução operacional permanece nos módulos respectivos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Colaboradores Activos" value={activeColabs} icon={<Users className="h-5 w-5" />} />
        <KpiCard title="Requisições Pendentes" value={pendingReqs.length} icon={<FileText className="h-5 w-5" />} description={formatKz(pendingReqs.reduce((s, r) => s + r.valor, 0))} />
        <KpiCard title="Contratos Vigentes" value={contratosActivos} icon={<Scale className="h-5 w-5" />} />
        <KpiCard title="Reuniões Agendadas" value={reunioesAgendadas} icon={<BarChart3 className="h-5 w-5" />} />
        <KpiCard title="Orçamento Anual (CC)" value={formatKz(totalOrcamento)} icon={<TrendingUp className="h-5 w-5" />} />
        <KpiCard title="Gasto Actual (CC)" value={formatKz(totalGasto)} icon={<Building2 className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-foreground mb-4">Gasto por Centro de Custo (amostra)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ccResumo} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatKz(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="gasto" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Gasto" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-xl border border-border/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-foreground mb-4">Acesso Rápido</h3>
          <div className="space-y-2">
            <NavLink to="/conselho-administracao/decisoes" className="block rounded-lg border border-border/80 p-3 hover:bg-muted/50 transition-colors text-sm font-medium">
              Decisões Institucionais
            </NavLink>
            <NavLink to="/conselho-administracao/assinatura-actos" className="block rounded-lg border border-border/80 p-3 hover:bg-muted/50 transition-colors text-sm font-medium">
              Assinatura Digital de Actos
            </NavLink>
            <NavLink to="/conselho-administracao/saude-financeira" className="block rounded-lg border border-border/80 p-3 hover:bg-muted/50 transition-colors text-sm font-medium">
              Saúde Financeira
            </NavLink>
            <NavLink to="/conselho-administracao/actividade" className="block rounded-lg border border-border/80 p-3 hover:bg-muted/50 transition-colors text-sm font-medium">
              Actividade Organizacional
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}
