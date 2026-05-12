import { useMemo, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import type { ProdutividadeActividade, ProdutividadeParticipante, ProdutividadeStatus } from '@/types';
import { canTransitionProdutividadeStatus, produtividadeTransitionBlockedMessage } from '@/modules/produtividade/statusTransitions';
import { mapRowFromDb } from '@/lib/supabaseMappers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

function actsAsApprover(
  row: ProdutividadeActividade,
  colabId: number | null | undefined,
  empresaMatchId: number | null,
  perfil: string | undefined,
): boolean {
  if (!row.aprovadorColaboradorId) return false;
  if (colabId != null && row.aprovadorColaboradorId === colabId) return true;
  if (perfil === 'Admin' || perfil === 'PCA') {
    if (empresaMatchId == null) return true;
    return Number(row.empresaId) === Number(empresaMatchId);
  }
  if (perfil === 'Director' && empresaMatchId != null) {
    return Number(row.empresaId) === Number(empresaMatchId);
  }
  return false;
}

function isActividadeCompartilhada(a: ProdutividadeActividade, participantes: ProdutividadeParticipante[]): boolean {
  const ids = new Set<number>();
  if (Number.isFinite(Number(a.colaboradorId))) ids.add(Number(a.colaboradorId));
  for (const p of participantes) {
    if (Number.isFinite(Number(p.colaboradorId))) ids.add(Number(p.colaboradorId));
  }
  return ids.size > 1;
}

export default function ProdutividadeAprovacoesPage() {
  const { currentEmpresaId } = useTenant();
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<number | null>(null);

  const mapRow = useMemo(
    () => (row: Record<string, unknown>) => mapRowFromDb<ProdutividadeActividade>('produtividade_actividades', row),
    [],
  );
  const { rows: allRows, isLoading } = useRealtimeTable<ProdutividadeActividade>('produtividade_actividades', 'id', {
    mapRow,
  });

  const mapPart = useMemo(
    () => (row: Record<string, unknown>) => mapRowFromDb<ProdutividadeParticipante>('produtividade_participantes', row),
    [],
  );
  const { rows: allParticipantes } = useRealtimeTable<ProdutividadeParticipante>('produtividade_participantes', 'id', {
    mapRow: mapPart,
  });

  const participantesByActividade = useMemo(() => {
    const m = new Map<number, ProdutividadeParticipante[]>();
    for (const p of allParticipantes) {
      const id = Number(p.actividadeId);
      if (!Number.isFinite(id)) continue;
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push(p);
    }
    return m;
  }, [allParticipantes]);

  const userEmpresaId =
    typeof currentEmpresaId === 'number'
      ? currentEmpresaId
      : typeof user?.empresaId === 'number'
        ? user.empresaId
        : null;

  const pending = useMemo(() => {
    const base =
      currentEmpresaId === 'consolidado'
        ? allRows
        : allRows.filter(r => Number(r.empresaId) === Number(currentEmpresaId));
    const cid = user?.colaboradorId;
    const isGestorGlobal = user?.perfil === 'Admin' || user?.perfil === 'PCA';
    if (isGestorGlobal && cid == null) {
      return base
        .filter(a => a.status === 'Em aprovação' && a.aprovadorColaboradorId != null)
        .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''));
    }
    if (cid == null) return [];
    return base
      .filter(a => a.status === 'Em aprovação' && actsAsApprover(a, cid, userEmpresaId, user?.perfil))
      .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''));
  }, [allRows, currentEmpresaId, user?.colaboradorId, user?.perfil, userEmpresaId]);

  async function setStatus(id: number, next: string) {
    if (!isSupabaseConfigured() || !supabase) return;
    const row = allRows.find(r => r.id === id);
    const nextSt = next as ProdutividadeStatus;
    if (row && row.status !== nextSt && !canTransitionProdutividadeStatus(row.status, nextSt)) {
      toast.error(produtividadeTransitionBlockedMessage(row.status, nextSt));
      return;
    }
    setBusyId(id);
    try {
      const { error } = await (supabase.from('produtividade_actividades') as any).update({ status: next }).eq('id', id);
      if (error) throw new Error(error.message);
      toast.success(next === 'Concluída' ? 'Actividade concluída.' : 'Devolvida ao responsável.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao actualizar.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold leading-tight">Produtividade</h1>
        <p className="text-sm text-muted-foreground">Aprovações pendentes</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">À sua responsabilidade</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {!user?.colaboradorId && user?.perfil !== 'Admin' && user?.perfil !== 'PCA' ? (
            <div className="text-muted-foreground">É necessário um colaborador associado ao perfil para usar aprovações.</div>
          ) : isLoading ? (
            <div className="text-muted-foreground">A carregar…</div>
          ) : pending.length === 0 ? (
            <div className="text-muted-foreground">Não há actividades à espera da sua aprovação.</div>
          ) : (
            <ul className="divide-y rounded-xl border bg-card overflow-hidden">
              {pending.map((a) => (
                <li key={a.id} className="p-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium truncate">{a.titulo}</div>
                      {isActividadeCompartilhada(a, participantesByActividade.get(a.id) ?? []) ? (
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                          Compartilhada
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Prazo: {a.prazo} · {a.prioridade} · {a.categoria}
                    </div>
                    {a.possuiEntregavel ? <Badge variant="outline" className="mt-1">Com entregável</Badge> : null}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" disabled={busyId === a.id} onClick={() => void setStatus(a.id, 'Concluída')}>
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === a.id}
                      onClick={() => void setStatus(a.id, 'Em Progresso')}
                    >
                      Recusar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
