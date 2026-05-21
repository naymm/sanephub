import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useCiEmpresaId } from '@/modules/controlo-interno/useCiEmpresaId';
import { CI_BASE } from '@/modules/controlo-interno/constants';
import { ciRiscoNivel, ciRiscoNivelClass } from '@/modules/controlo-interno/controloInternoRisk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ClipboardCheck, FileWarning, ShieldAlert, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ControloInternoDashboardPage() {
  const empresaId = useCiEmpresaId();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['controlo-interno', 'dashboard', empresaId],
    enabled: isSupabaseConfigured() && empresaId != null,
    staleTime: 60_000,
    queryFn: async () => {
      if (!supabase || empresaId == null) return null;
      const eid = empresaId;
      const [aud, nc, riscos, ncIdsRes] = await Promise.all([
        supabase.from('ci_auditorias').select('estado').eq('empresa_id', eid),
        supabase.from('ci_nao_conformidades').select('estado, gravidade, prazo_resolucao').eq('empresa_id', eid),
        supabase.from('ci_riscos').select('score, estado').eq('empresa_id', eid),
        supabase.from('ci_nao_conformidades').select('id').eq('empresa_id', eid),
      ]);
      const ncIds = (ncIdsRes.data ?? []).map((r: { id: number }) => r.id);
      let planosRows: { estado: string; prazo: string | null }[] = [];
      if (ncIds.length > 0) {
        const { data: pl } = await supabase.from('ci_planos_accao').select('estado, prazo').in('nao_conformidade_id', ncIds);
        planosRows = (pl ?? []) as { estado: string; prazo: string | null }[];
      }
      const auditorias = aud.data ?? [];
      const ncs = nc.data ?? [];
      const rs = riscos.data ?? [];
      const today = new Date().toISOString().slice(0, 10);
      return {
        auditoriasActivas: auditorias.filter(a => a.estado === 'Em Execução').length,
        auditoriasConcluidas: auditorias.filter(a => a.estado === 'Concluída').length,
        auditoriasPlaneadas: auditorias.filter(a => a.estado === 'Planeada').length,
        ncAbertas: ncs.filter(n => n.estado === 'Aberta' || n.estado === 'Em Tratamento').length,
        ncCriticas: ncs.filter(n => n.gravidade === 'Crítico' && n.estado !== 'Encerrada').length,
        ncVencidas: ncs.filter(
          n =>
            n.prazo_resolucao &&
            n.prazo_resolucao < today &&
            n.estado !== 'Resolvida' &&
            n.estado !== 'Encerrada',
        ).length,
        riscosCriticos: rs.filter(r => (r.score ?? 0) >= 20).length,
        planosAtrasados: planosRows.filter(
          p => p.estado === 'Atrasada' || (p.prazo && p.prazo < today && p.estado !== 'Concluída'),
        ).length,
      };
    },
  });

  const cards = useMemo(
    () => [
      {
        title: 'Auditorias activas',
        value: stats?.auditoriasActivas ?? 0,
        icon: ClipboardCheck,
        href: `${CI_BASE}/execucao`,
      },
      {
        title: 'Auditorias concluídas',
        value: stats?.auditoriasConcluidas ?? 0,
        icon: TrendingUp,
        href: `${CI_BASE}/plano-auditorias`,
      },
      {
        title: 'Não conformidades abertas',
        value: stats?.ncAbertas ?? 0,
        icon: FileWarning,
        href: `${CI_BASE}/nao-conformidades`,
      },
      {
        title: 'NC críticas / vencidas',
        value: `${stats?.ncCriticas ?? 0} / ${stats?.ncVencidas ?? 0}`,
        icon: AlertTriangle,
        href: `${CI_BASE}/nao-conformidades`,
        destructive: true,
      },
      {
        title: 'Riscos críticos (score ≥20)',
        value: stats?.riscosCriticos ?? 0,
        icon: ShieldAlert,
        href: `${CI_BASE}/riscos`,
      },
      {
        title: 'Planos de acção atrasados',
        value: stats?.planosAtrasados ?? 0,
        icon: AlertTriangle,
        href: `${CI_BASE}/plano-accao`,
      },
    ],
    [stats],
  );

  if (empresaId == null) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Seleccione uma empresa no contexto para ver o dashboard de Controlo Interno.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(c => (
          <Card key={c.title} className={cn(c.destructive && 'border-destructive/40')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={cn('h-4 w-4', c.destructive ? 'text-destructive' : 'text-muted-foreground')} />
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-semibold', c.destructive && 'text-destructive')}>
                {isLoading ? '…' : c.value}
              </div>
              <Button variant="link" className="h-auto p-0 mt-2 text-xs" asChild>
                <Link to={c.href}>Ver detalhes</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo de governança</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">{stats?.auditoriasPlaneadas ?? 0} auditorias planeadas</Badge>
          <Badge className={ciRiscoNivelClass(ciRiscoNivel(20))}>Matriz de risco activa</Badge>
          <span className="text-muted-foreground">
            Logs institucionais disponíveis em{' '}
            <Link to={`${CI_BASE}/logs`} className="text-primary underline-offset-2 hover:underline">
              Rastreabilidade
            </Link>
            .
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
