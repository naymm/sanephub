import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapRowFromDb } from '@/lib/supabaseMappers';
import type { TimePunch, Colaborador } from '@/types';
import { textoReferenciaHorarioColaborador } from '@/lib/pontoHorario';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, RefreshCw, Eye, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const FETCH_LIMIT = 1500;

function formatOccurredAt(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy HH:mm:ss", { locale: pt });
  } catch {
    return iso;
  }
}

function extrairNomeColaboradorEmbutido(raw: Record<string, unknown>): string | null {
  const emb = raw.colaboradores;
  if (emb && typeof emb === 'object' && !Array.isArray(emb)) {
    const n = (emb as Record<string, unknown>).nome;
    const s = n != null ? String(n).trim() : '';
    return s || null;
  }
  if (Array.isArray(emb) && emb[0] && typeof emb[0] === 'object') {
    const n = (emb[0] as Record<string, unknown>).nome;
    const s = n != null ? String(n).trim() : '';
    return s || null;
  }
  return null;
}

function nomeColaboradorNaMarcacao(p: TimePunch, colabById: Map<number, Colaborador>): string {
  const join = p.colaboradorNome?.trim();
  if (join) return join;
  if (p.colaboradorId == null) return '—';
  const id = Number(p.colaboradorId);
  if (!Number.isFinite(id)) return '—';
  return colabById.get(id)?.nome?.trim() || `#${id}`;
}

export default function TimePunchesPage() {
  const { colaboradoresTodos, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const [rows, setRows] = useState<TimePunch[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [viewItem, setViewItem] = useState<TimePunch | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const colabById = useMemo(() => {
    const m = new Map<number, Colaborador>();
    for (const c of colaboradoresTodos) {
      m.set(Number(c.id), c);
    }
    return m;
  }, [colaboradoresTodos]);

  const empresaLabel = (empresaId: number | null) => {
    if (empresaId == null) return '—';
    return empresas.find(e => e.id === empresaId)?.nome ?? `#${empresaId}`;
  };

  const punchesNoTenant = useMemo(() => {
    const colabIds = new Set(colaboradoresTodos.map(c => Number(c.id)));
    return rows.filter(p => {
      if (currentEmpresaId === 'consolidado') return true;
      if (p.empresaId === currentEmpresaId) return true;
      const cid = p.colaboradorId != null ? Number(p.colaboradorId) : NaN;
      if (Number.isFinite(cid) && colabIds.has(cid)) {
        const c = colabById.get(cid);
        return c?.empresaId === currentEmpresaId;
      }
      return false;
    });
  }, [rows, currentEmpresaId, colaboradoresTodos, colabById]);

  const kinds = useMemo(() => {
    const s = new Set<string>();
    for (const p of punchesNoTenant) s.add(p.kind);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [punchesNoTenant]);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    for (const p of punchesNoTenant) s.add(p.status);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [punchesNoTenant]);

  const fetchPunches = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      toast.error('Supabase não configurado.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('time_punches')
        .select('*, colaboradores(nome)')
        .order('occurred_at', { ascending: false })
        .limit(FETCH_LIMIT);
      if (error) throw new Error(error.message);
      const mapped = (data ?? []).map((r: Record<string, unknown>) => {
        const nomeJoin = extrairNomeColaboradorEmbutido(r);
        const { colaboradores: _emb, ...rest } = r;
        const row = mapRowFromDb<TimePunch>('time_punches', rest);
        return { ...row, colaboradorNome: nomeJoin };
      });
      setRows(mapped);
    } catch (e) {
      console.error('[time_punches]', e);
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar marcações.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPunches();
  }, [fetchPunches]);

  const filtered = useMemo(() => {
    return punchesNoTenant.filter(p => {
      const nome = nomeColaboradorNaMarcacao(p, colabById);
      const matchSearch =
        !search.trim() ||
        nome.toLowerCase().includes(search.toLowerCase()) ||
        String(p.kind).toLowerCase().includes(search.toLowerCase()) ||
        String(p.status).toLowerCase().includes(search.toLowerCase());
      const matchKind = kindFilter === 'todos' || p.kind === kindFilter;
      const matchStatus = statusFilter === 'todos' || p.status === statusFilter;
      const d = p.occurredAt.slice(0, 10);
      let matchDate = true;
      if (dataInicio) matchDate = matchDate && d >= dataInicio;
      if (dataFim) matchDate = matchDate && d <= dataFim;
      return matchSearch && matchKind && matchStatus && matchDate;
    });
  }, [punchesNoTenant, search, kindFilter, statusFilter, dataInicio, dataFim, colabById]);

  const pagination = useClientSidePagination({
    items: filtered,
    pageSize: PAGE_SIZE_OPTIONS[0],
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  });

  const openView = (p: TimePunch) => {
    setViewItem(p);
    setViewOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Marcações de ponto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consulta das marcações registadas (últimos {FETCH_LIMIT} eventos). O cálculo de atrasos e faltas automáticas usa o
            horário de entrada definido no colaborador, tolerância de 15 min e fuso Africa/Luanda (ver Capital Humano →
            Colaboradores).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchPunches()} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar colaborador, tipo ou estado…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo (kind)</Label>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {kinds.map(k => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Estado</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {statuses.map(s => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Desde</Label>
          <Input type="date" className="h-9 w-[150px]" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input type="date" className="h-9 w-[150px]" value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Data/Hora
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Colaborador
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Empresa
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tipo
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Estado
              </th>
              <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                PIN
              </th>
              <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Face
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Local
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Acções
              </th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(p => (
              <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4 whitespace-nowrap tabular-nums text-muted-foreground">
                  {formatOccurredAt(p.occurredAt)}
                </td>
                <td className="py-3 px-4 font-medium">{nomeColaboradorNaMarcacao(p, colabById)}</td>
                <td className="py-3 px-4 text-muted-foreground">{empresaLabel(p.empresaId)}</td>
                <td className="py-3 px-4">{p.kind}</td>
                <td className="py-3 px-4">{p.status}</td>
                <td className="py-3 px-4 text-center">{p.pinVerified ? 'Sim' : 'Não'}</td>
                <td className="py-3 px-4 text-center">
                  {p.faceVerified == null ? '—' : p.faceVerified ? 'Sim' : 'Não'}
                </td>
                <td className="py-3 px-4 text-right">
                  {p.locationLat != null && p.locationLng != null ? (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${p.locationLat}&mlon=${p.locationLng}#map=16/${p.locationLat}/${p.locationLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Mapa
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Detalhe" onClick={() => openView(p)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && !loading && (
        <p className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma marcação encontrada (ou sem permissão RLS para ver registos).
        </p>
      )}

      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Marcação #{viewItem?.id}</DialogTitle>
            <DialogDescription>
              {viewItem ? formatOccurredAt(viewItem.occurredAt) : ''}
            </DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Colaborador:</span>{' '}
                {nomeColaboradorNaMarcacao(viewItem, colabById)}
              </p>
              {(() => {
                const cid =
                  viewItem.colaboradorId != null ? Number(viewItem.colaboradorId) : NaN;
                const ref = Number.isFinite(cid)
                  ? textoReferenciaHorarioColaborador(colabById.get(cid))
                  : null;
                return ref ? (
                  <p className="text-muted-foreground border-l-2 border-primary/30 pl-3">{ref}</p>
                ) : null;
              })()}
              <p>
                <span className="text-muted-foreground">Empresa (registo):</span> {empresaLabel(viewItem.empresaId)}
              </p>
              <p>
                <span className="text-muted-foreground">Tipo:</span> {viewItem.kind}
              </p>
              <p>
                <span className="text-muted-foreground">Estado:</span> {viewItem.status}
              </p>
              <p>
                <span className="text-muted-foreground">Verificação:</span> {viewItem.verificationMethod ?? '—'}
              </p>
                <p>
                <span className="text-muted-foreground">PIN verificado:</span> {viewItem.pinVerified ? 'Sim' : 'Não'}
              </p>
              <p>
                <span className="text-muted-foreground">Face:</span>{' '}
                {viewItem.faceVerified == null
                  ? '—'
                  : `${viewItem.faceVerified ? 'Sim' : 'Não'}${viewItem.faceConfidence != null ? ` (${viewItem.faceConfidence})` : ''}`}
              </p>
              <p>
                <span className="text-muted-foreground">Geocerca / dentro:</span>{' '}
                {viewItem.geofenceId != null ? `#${viewItem.geofenceId}` : '—'}
                {viewItem.isWithinGeofence != null ? ` · ${viewItem.isWithinGeofence ? 'dentro' : 'fora'}` : ''}
              </p>
              <p>
                <span className="text-muted-foreground">Selfie (storage):</span>{' '}
                {viewItem.selfieStoragePath ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Utilizador Auth:</span>{' '}
                <span className="font-mono text-xs break-all">{viewItem.authUserId}</span>
              </p>
              {viewItem.clientMeta && Object.keys(viewItem.clientMeta).length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">client_meta</p>
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(viewItem.clientMeta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
