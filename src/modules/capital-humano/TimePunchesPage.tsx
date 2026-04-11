import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { NormalizedBiometricoRegistro, Colaborador } from '@/types';
import { textoReferenciaHorarioColaborador } from '@/lib/pontoHorario';
import {
  agruparRegistrosBiometricoPorDiaNumeroMec,
  mapBiometricoRegistroRow,
  normalizeBiometricoRegistro,
} from '@/lib/biometricoRegistro';
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

function dataParaFiltro(r: NormalizedBiometricoRegistro): string {
  if (r.dataIso && r.dataIso.length >= 10) return r.dataIso.slice(0, 10);
  const d = r.occurredAtIso?.trim();
  if (d && d.length >= 10) return d.slice(0, 10);
  return '';
}

function colaboradorPorNumeroMec(
  numeroMec: string | null,
  mapa: Map<string, Colaborador>,
): Colaborador | undefined {
  if (!numeroMec?.trim()) return undefined;
  return mapa.get(numeroMec.trim().toLowerCase());
}

export default function TimePunchesPage() {
  const { colaboradoresTodos, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const [rows, setRows] = useState<NormalizedBiometricoRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [viewItem, setViewItem] = useState<NormalizedBiometricoRegistro | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const colabByNumeroMec = useMemo(() => {
    const m = new Map<string, Colaborador>();
    for (const c of colaboradoresTodos) {
      const key = (c.numeroMec ?? '').trim().toLowerCase();
      if (key) m.set(key, c);
    }
    return m;
  }, [colaboradoresTodos]);

  const empresaLabel = (empresaId: number | null | undefined) => {
    if (empresaId == null || !Number.isFinite(Number(empresaId))) return '—';
    return empresas.find(e => e.id === Number(empresaId))?.nome ?? `#${empresaId}`;
  };

  /** Nome da empresa (tenant), a partir do registo ou do colaborador resolvido por nº mec. */
  const nomeEmpresa = (r: NormalizedBiometricoRegistro, colab: Colaborador | undefined) => {
    return empresaLabel(r.empresaId ?? colab?.empresaId ?? null);
  };

  const nomeColaborador = (r: NormalizedBiometricoRegistro) => {
    const c = colaboradorPorNumeroMec(r.numeroMec, colabByNumeroMec);
    if (c?.nome?.trim()) return c.nome.trim();
    if (r.numeroMec?.trim()) return `Nº mec. ${r.numeroMec.trim()}`;
    return '—';
  };

  const registosNoTenantRaw = useMemo(() => {
    return rows.filter(p => {
      if (currentEmpresaId === 'consolidado') return true;
      const colab = colaboradorPorNumeroMec(p.numeroMec, colabByNumeroMec);
      const eid = p.empresaId ?? colab?.empresaId;
      return eid === currentEmpresaId;
    });
  }, [rows, currentEmpresaId, colabByNumeroMec]);

  const registosNoTenant = useMemo(
    () => agruparRegistrosBiometricoPorDiaNumeroMec(registosNoTenantRaw),
    [registosNoTenantRaw],
  );

  const kinds = useMemo(() => {
    const s = new Set<string>();
    for (const p of registosNoTenantRaw) s.add(p.kind);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [registosNoTenantRaw]);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    for (const p of registosNoTenantRaw) s.add(p.status);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [registosNoTenantRaw]);

  const fetchRegistos = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      toast.error('Supabase não configurado.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('biometrico_registros')
        .select('*')
        .order('id', { ascending: false })
        .limit(FETCH_LIMIT);
      if (error) throw new Error(error.message);
      const mapped = (data ?? []).map((r: Record<string, unknown>) =>
        normalizeBiometricoRegistro(mapBiometricoRegistroRow(r)),
      );
      setRows(mapped);
    } catch (e) {
      console.error('[biometrico_registros]', e);
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar registos biométricos.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRegistos();
  }, [fetchRegistos]);

  const filtered = useMemo(() => {
    const matchLinha = (r: NormalizedBiometricoRegistro, q: string) =>
      r.dataTexto.toLowerCase().includes(q) ||
      r.entradaTexto.toLowerCase().includes(q) ||
      r.saidaTexto.toLowerCase().includes(q) ||
      r.viaTexto.toLowerCase().includes(q) ||
      (r.localTexto ?? '').toLowerCase().includes(q) ||
      (r.empresaColunaTexto ?? '').toLowerCase().includes(q) ||
      String(r.kind).toLowerCase().includes(q) ||
      String(r.status).toLowerCase().includes(q);

    return registosNoTenant.filter(p => {
      const nome = nomeColaborador(p);
      const nMec = (p.numeroMec ?? '').toLowerCase();
      const colab = colaboradorPorNumeroMec(p.numeroMec, colabByNumeroMec);
      const empTxt = nomeEmpresa(p, colab).toLowerCase();
      const q = search.toLowerCase();
      const matchSearch =
        !search.trim() ||
        nome.toLowerCase().includes(q) ||
        nMec.includes(q) ||
        empTxt.includes(q) ||
        matchLinha(p, q) ||
        (p.mergedSources?.some(s => matchLinha(s, q)) ?? false);
      const matchKind =
        kindFilter === 'todos' ||
        p.kind === kindFilter ||
        (p.mergedSources?.some(s => s.kind === kindFilter) ?? false);
      const matchStatus =
        statusFilter === 'todos' ||
        p.status === statusFilter ||
        (p.mergedSources?.some(s => s.status === statusFilter) ?? false);
      const d = dataParaFiltro(p);
      let matchDate = true;
      if (d) {
        if (dataInicio) matchDate = matchDate && d >= dataInicio;
        if (dataFim) matchDate = matchDate && d <= dataFim;
      } else if (dataInicio || dataFim) {
        matchDate = false;
      }
      return matchSearch && matchKind && matchStatus && matchDate;
    });
  }, [registosNoTenant, search, kindFilter, statusFilter, dataInicio, dataFim, colabByNumeroMec, empresas]);

  const pagination = useClientSidePagination({
    items: filtered,
    pageSize: PAGE_SIZE_OPTIONS[0],
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  });

  const openView = (p: NormalizedBiometricoRegistro) => {
    setViewItem(p);
    setViewOpen(true);
  };

  const pinLabel = (v: boolean | null) => (v == null ? '—' : v ? 'Sim' : 'Não');
  const faceLabel = (r: NormalizedBiometricoRegistro) => {
    if (r.faceVerified == null) return '—';
    const base = r.faceVerified ? 'Sim' : 'Não';
    return r.faceConfidence != null ? `${base} (${r.faceConfidence})` : base;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Marcações de ponto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Últimos {FETCH_LIMIT} registos em <code className="text-xs">biometrico_registros</code>, agrupados por dia e{' '}
            <code className="text-xs">numero_mec</code> (uma linha por colaborador e dia). Colunas: Data,             Colaborador, Empresa,
            Entrada, Saída, Local (coluna <code className="text-xs">empresa</code> no registo, ou o mesmo nome que «Empresa» se vier vazio), Via. Entrada/saída podem vir de colunas dedicadas ou do timestamp + tipo de marcação.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchRegistos()} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar colaborador, empresa, data, horas, local, via…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
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
                Data
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Colaborador
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Empresa
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                Entrada
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                Saída
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Local
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Via
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Acções
              </th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(p => {
              const colab = colaboradorPorNumeroMec(p.numeroMec, colabByNumeroMec);
              const nomeEmp = nomeEmpresa(p, colab);
              const empCol = p.empresaColunaTexto?.trim() ?? '';
              const textoLocal = empCol || (nomeEmp !== '—' ? nomeEmp : '');
              const temMapa = p.locationLat != null && p.locationLng != null;
              const mapaLink = temMapa ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${p.locationLat}&mlon=${p.locationLng}#map=16/${p.locationLat}/${p.locationLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Mapa
                </a>
              ) : null;
              const localCell =
                textoLocal && mapaLink ? (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate min-w-0">{textoLocal}</span>
                    {mapaLink}
                  </span>
                ) : textoLocal ? (
                  textoLocal
                ) : mapaLink ? (
                  mapaLink
                ) : (
                  '—'
                );
              return (
                <tr
                  key={typeof p.id === 'string' && String(p.id).startsWith('dia:') ? p.id : String(p.id)}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-4 whitespace-nowrap tabular-nums text-muted-foreground">{p.dataTexto}</td>
                  <td className="py-3 px-4 font-medium">{nomeColaborador(p)}</td>
                  <td className="py-3 px-4 text-muted-foreground max-w-[160px] truncate" title={nomeEmp}>
                    {nomeEmp}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap tabular-nums font-mono text-xs">{p.entradaTexto}</td>
                  <td className="py-3 px-4 whitespace-nowrap tabular-nums font-mono text-xs">{p.saidaTexto}</td>
                  <td className="py-3 px-4 text-muted-foreground max-w-[200px]">
                    <div className="truncate" title={typeof localCell === 'string' ? localCell : undefined}>
                      {localCell}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground max-w-[180px] truncate" title={p.viaTexto}>
                    {p.viaTexto}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Detalhe" onClick={() => openView(p)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && !loading && (
        <p className="text-center py-8 text-muted-foreground text-sm">
          Nenhum registo encontrado (ou sem permissão RLS para ver <code className="text-xs">biometrico_registros</code>).
        </p>
      )}

      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewItem?.mergedSources && viewItem.mergedSources.length > 1
                ? `Dia agregado (${viewItem.mergedSources.length} registos)`
                : `Registo biométrico #${viewItem?.id}`}
            </DialogTitle>
            <DialogDescription>
              {viewItem
                ? `${viewItem.dataTexto} · Entrada ${viewItem.entradaTexto} · Saída ${viewItem.saidaTexto}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              {viewItem.mergedSources && viewItem.mergedSources.length > 1 ? (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Registos que compõem esta linha</p>
                  <ul className="text-xs space-y-2 list-none pl-0">
                    {viewItem.mergedSources.map(s => (
                      <li key={String(s.id)} className="border-b border-border/50 last:border-0 pb-2 last:pb-0">
                        <span className="font-mono">#{s.id}</span>
                        {' · '}
                        <span className="tabular-nums">
                          {s.entradaTexto} / {s.saidaTexto}
                        </span>
                        {s.occurredAtIso ? (
                          <>
                            {' · '}
                            <span className="text-muted-foreground break-all">{s.occurredAtIso}</span>
                          </>
                        ) : null}
                        <div className="text-muted-foreground mt-0.5">{s.kind}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p>
                <span className="text-muted-foreground">Nº mecanográfico:</span>{' '}
                <span className="font-mono text-xs">{viewItem.numeroMec?.trim() || '—'}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Colaborador:</span> {nomeColaborador(viewItem)}
              </p>
              {(() => {
                const colab = colaboradorPorNumeroMec(viewItem.numeroMec, colabByNumeroMec);
                const ref = colab ? textoReferenciaHorarioColaborador(colab) : null;
                return ref ? (
                  <p className="text-muted-foreground border-l-2 border-primary/30 pl-3">{ref}</p>
                ) : null;
              })()}
              <p>
                <span className="text-muted-foreground">Empresa:</span>{' '}
                {nomeEmpresa(viewItem, colaboradorPorNumeroMec(viewItem.numeroMec, colabByNumeroMec))}
              </p>
              <p>
                <span className="text-muted-foreground">Entrada / Saída:</span>{' '}
                {viewItem.entradaTexto} / {viewItem.saidaTexto}
              </p>
              <p>
                <span className="text-muted-foreground">Via:</span> {viewItem.viaTexto}
              </p>
              <p>
                <span className="text-muted-foreground">Empresa (coluna no registo):</span>{' '}
                {viewItem.empresaColunaTexto?.trim() || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Local / morada (texto):</span>{' '}
                {viewItem.localTexto?.trim() || '—'}
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
                <span className="text-muted-foreground">PIN verificado:</span> {pinLabel(viewItem.pinVerified)}
              </p>
              <p>
                <span className="text-muted-foreground">Face:</span> {faceLabel(viewItem)}
              </p>
              <p>
                <span className="text-muted-foreground">Geocerca / dentro:</span>{' '}
                {viewItem.geofenceId != null ? `#${viewItem.geofenceId}` : '—'}
                {viewItem.isWithinGeofence != null ? ` · ${viewItem.isWithinGeofence ? 'dentro' : 'fora'}` : ''}
              </p>
              <p>
                <span className="text-muted-foreground">Selfie (storage):</span> {viewItem.selfieStoragePath ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Precisão GPS (m):</span>{' '}
                {viewItem.locationAccuracyM != null ? String(viewItem.locationAccuracyM) : '—'}
              </p>
              {viewItem.authUserId ? (
                <p>
                  <span className="text-muted-foreground">Utilizador Auth:</span>{' '}
                  <span className="font-mono text-xs break-all">{viewItem.authUserId}</span>
                </p>
              ) : null}
              {viewItem.clientMeta && Object.keys(viewItem.clientMeta).length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Meta (cliente)</p>
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(viewItem.clientMeta, null, 2)}
                  </pre>
                </div>
              )}
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Linha completa (camelCase)</p>
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                  {JSON.stringify(viewItem.rawCamel, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
