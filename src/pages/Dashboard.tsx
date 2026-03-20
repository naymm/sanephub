import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { KpiCard } from '@/components/shared/KpiCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getCurrentDatePT, formatKz, formatDate, diasRestantes, getGreeting } from '@/utils/formatters';
import { UsersRound, ShieldCheck, TrendingUp, Receipt, Search, Calendar as LucideCalendar, Clock, AlertTriangle, FileText, Download } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as UiCalendar } from '@/components/ui/calendar';
import { hasModuleAccess } from '@/context/AuthContext';

const COLORS = ['#2563eb', '#0EA5E9', '#14B8A6', '#10B981', '#F59E0B', '#64748B', '#8B5CF6'];

export default function Dashboard() {
  const { user } = useAuth();
  const { colaboradores, requisicoes, contratos, reunioes, processos, prazos, centrosCusto, pagamentos, documentosOficiais } = useData();
  const navigate = useNavigate();
  const [docQuery, setDocQuery] = useState('');

  if (!user) return null;

  const activeClients = colaboradores.filter(c => c.status === 'Activo').length;

  const receita = pagamentos
    .filter(p => p.status !== 'Devolvido')
    .reduce((s, p) => s + p.valor, 0);

  const despesas = requisicoes
    .filter(r => r.status === 'Pago')
    .reduce((s, r) => s + r.valor, 0);

  const retencao = contratos.filter(c => {
    if (c.status === 'Expirado' || c.status === 'Rescindido') return false;
    const d = diasRestantes(c.dataFim);
    return d > 90;
  }).length;

  // Mantemos métricas originais para listas/alertas e gráficos
  const pendingReqs = requisicoes.filter(r => r.status === 'Pendente' || r.status === 'Em Análise');
  const pendingReqValue = pendingReqs.reduce((s, r) => s + r.valor, 0);
  const expiringContracts = contratos.filter(c => {
    const d = diasRestantes(c.dataFim);
    return d >= 0 && d <= 90 && c.status !== 'Expirado' && c.status !== 'Rescindido';
  }).length;
  const scheduledMeetings = reunioes.filter(r => r.status === 'Agendada').length;
  const activeCases = processos.filter(p => p.status === 'Em curso').length;
  const criticalDeadlines = prazos.filter(p => p.status === 'Vencido' || (p.prioridade === 'Crítica' && p.status !== 'Concluído')).length;

  const latestReqs = requisicoes.slice(0, 5);
  const nextMeetings = reunioes.filter(r => r.status === 'Agendada').slice(0, 3);

  const docsFiltered = documentosOficiais
    .filter(d => {
      const q = docQuery.trim().toLowerCase();
      if (!q) return true;
      return d.titulo.toLowerCase().includes(q) || d.tipo.toLowerCase().includes(q);
    })
    .slice()
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 6);

  // Feed de "Notícias & Atualizações" (reutiliza dados existentes)
  const expiringContractsList = contratos
    .filter(c => c.status === 'A Renovar' || c.status === 'Expirado')
    .slice(0, 2);

  const criticalPrazosList = prazos
    .filter(p => p.status === 'Vencido' || p.prioridade === 'Crítica')
    .slice(0, 2);

  const newsCards = [
    ...latestReqs.slice(0, 2).map(r => ({
      key: `req-${r.id}`,
      title: `Nova requisição: ${r.num}`,
      meta: `${r.fornecedor}`,
      body: `Valor ${formatKz(r.valor)} • Status: ${r.status}`,
    })),
    ...nextMeetings.slice(0, 1).map(m => ({
      key: `meet-${m.id}`,
      title: `Reunião agendada: ${m.titulo}`,
      meta: `${formatDate(m.data)} • ${m.hora} — ${m.local}`,
      body: `Tipo/área: ${m.tipo}`,
    })),
    ...expiringContractsList.map(c => ({
      key: `contract-${c.id}`,
      title: `Atenção: contrato ${c.numero}`,
      meta: `${c.parteB}`,
      body: `Vence: ${formatDate(c.dataFim)} • Estado: ${c.status}`,
    })),
    ...criticalPrazosList.map(p => ({
      key: `deadline-${p.id}`,
      title: `Prazo crítico: ${p.titulo}`,
      meta: `Limite ${p.dataLimite ? formatDate(p.dataLimite) : ''}`.trim(),
      body: `Prioridade: ${p.prioridade} • Estado: ${p.status}`,
    })),
  ].slice(0, 5);

  const quickLinks = [
    { label: 'Requisições', path: '/financas/requisicoes', module: 'financas' },
    { label: 'Declarações', path: '/capital-humano/declaracoes', module: 'capital-humano' },
    { label: 'Pagamentos', path: '/contabilidade/pagamentos', module: 'contabilidade' },
    { label: 'Reuniões', path: '/secretaria/reunioes', module: 'secretaria' },
    { label: 'Contratos', path: '/juridico/contratos', module: 'juridico' },
  ].filter(l => hasModuleAccess(user, l.module));

  return (
    <div className="space-y-8">
      {/* Hero — intranet moderna */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border/80"
        style={{ background: 'linear-gradient(to right, #d4a926, #a57e26)' }}
      >
        <div className="absolute inset-0 opacity-[0.15] bg-[radial-gradient(circle_at_top,_transparent_0,_rgba(255,255,255,0.9)_45%,_transparent_60%)]" />
        <div className="relative p-6 sm:p-8">
          <h1 className="text-white text-xl lg:text-2xl font-semibold tracking-tight">
            Olá, {user.nome.split(' ')[0]}! Bem vindo(a) à intranet
          </h1>
          <p className="text-white/90 text-sm mt-1">
            Centro de comunicação e recursos relacionados com colaboradores
          </p>
          <p className="text-white/80 text-xs mt-2 capitalize">{getCurrentDatePT()}</p>
        </div>
      </div>

      {/* KPI Grid (corporativo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Receita"
          value={formatKz(receita)}
          icon={<TrendingUp className="h-5 w-5" />}
          description="Pagamentos recebidos"
        />
        <KpiCard
          title="Despesas"
          value={formatKz(despesas)}
          icon={<Receipt className="h-5 w-5" />}
          description="Requisições pagas"
        />
        <KpiCard
          title="Clientes"
          value={activeClients}
          icon={<UsersRound className="h-5 w-5" />}
          description="Colaboradores ativos"
        />
        <KpiCard
          title="Retenção"
          value={retencao}
          icon={<ShieldCheck className="h-5 w-5" />}
          description="Contratos com mais de 90 dias"
          className={retencao <= 0 ? 'border-destructive/30' : ''}
        />
      </div>

      {/* Conteúdo principal (2 colunas) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Esquerda: Feed de notícias */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Notícias & Atualizações</h2>
              <p className="text-sm text-muted-foreground mt-1">Resumo do que está a acontecer no sistema.</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Ver mais
            </Button>
          </div>

          <div className="space-y-3">
            {newsCards.map(n => (
              <div
                key={n.key}
                className="bg-card rounded-xl border border-border/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{n.meta}</p>
                  </div>
                  <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3">{n.body}</p>
              </div>
            ))}
            {newsCards.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground bg-card rounded-xl border border-border/80">
                Sem notícias para mostrar.
              </div>
            )}
          </div>
        </section>

        {/* Direita: Atalhos + Calendário + Eventos */}
        <section className="space-y-4">
          <div className="bg-card rounded-xl border border-border/80 p-5">
            <h2 className="text-base font-semibold text-foreground">Links rápidos</h2>
            <p className="text-sm text-muted-foreground mt-1">Atalhos para acções frequentes.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {quickLinks.map(l => (
                <button
                  key={l.path}
                  onClick={() => navigate(l.path)}
                  className="group flex items-center gap-2 rounded-xl border border-border/80 px-3 py-2 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Download className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.label}</p>
                  </div>
                </button>
              ))}
              {quickLinks.length === 0 && (
                <div className="col-span-full text-sm text-muted-foreground">Sem atalhos para o seu perfil.</div>
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Calendário</h2>
                <p className="text-sm text-muted-foreground mt-1">Visão mensal (informativa).</p>
              </div>
              <LucideCalendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-border/80">
              <UiCalendar />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border/80 p-5">
            <h2 className="text-base font-semibold text-foreground">Eventos</h2>
            <p className="text-sm text-muted-foreground mt-1">Próximas reuniões e prazos relevantes.</p>

            <div className="divide-y divide-border/50 mt-4">
              {[...nextMeetings].slice(0, 2).map(m => (
                <div key={`ev-meet-${m.id}`} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(m.data)} • {m.hora} — {m.local}
                    </p>
                  </div>
                  <StatusBadge status={m.tipo} variant="gold" />
                </div>
              ))}
              {criticalPrazosList.length > 0 &&
                criticalPrazosList.map(p => (
                  <div key={`ev-prazo-${p.id}`} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Prazo {p.dataLimite ? formatDate(p.dataLimite) : '—'} • Prioridade {p.prioridade}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              {nextMeetings.length === 0 && criticalPrazosList.length === 0 && (
                <p className="py-3 text-sm text-muted-foreground">Sem eventos no momento.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Documentos */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Repositório de Documentos</h2>
            <p className="text-sm text-muted-foreground mt-1">Documentos e despachos mais recentes.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                value={docQuery}
                onChange={e => setDocQuery(e.target.value)}
                placeholder="Buscar por título..."
                className="w-[260px]"
              />
            </div>
            <Button variant="outline" onClick={() => navigate('/secretaria/documentos')}>
              Ver todos
            </Button>
          </div>
        </div>

        <div className="table-container overflow-x-auto">
          {docsFiltered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum documento encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/80">
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Documento</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {docsFiltered.map(d => (
                  <tr
                    key={d.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-5">{d.tipo}</td>
                    <td className="py-3 px-5">
                      <div className="font-medium">{d.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{d.numero}</div>
                    </td>
                    <td className="py-3 px-5 text-muted-foreground">{formatDate(d.data)}</td>
                    <td className="py-3 px-5">
                      <StatusBadge status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
