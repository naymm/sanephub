import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapRowFromDb } from '@/lib/supabaseMappers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, RefreshCw, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export type IntranetAuditEventRow = {
  id: number;
  createdAt: string;
  eventCategory: string;
  action: string;
  actorProfileId: number | null;
  actorAuthUid: string | null;
  resourceType: string | null;
  resourceId: string | null;
  empresaId: number | null;
  colaboradorId: number | null;
  summary: string | null;
  details: Record<string, unknown>;
};

const PAGE_SIZE = 40;
/** Sem canal Realtime permanente: polling só com o separador visível e intervalo largo. */
const POLL_MS_WHEN_VISIBLE = 120_000;

const CATEGORY_LABEL: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  chat_message: 'Mensagens',
  produtividade_actividade: 'Produtividade (actividade)',
  produtividade_comentario: 'Produtividade (comentário)',
  produtividade_log: 'Produtividade (registo / log)',
  time_punch: 'Ponto (marcação)',
  ponto_biometrico: 'Ponto biométrico / ERP',
  localizacao: 'Localização (GPS)',
  sistema: 'Sistema',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABEL[cat] ?? cat;
}

function badgeVariant(cat: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (cat === 'login') return 'default';
  if (cat === 'logout') return 'secondary';
  if (cat === 'localizacao') return 'outline';
  if (cat === 'chat_message') return 'secondary';
  return 'outline';
}

function shortName(nome: string): string {
  const p = nome.trim().split(/\s+/);
  if (p.length === 0) return nome;
  if (p.length === 1) return p[0]!;
  return `${p[0]!} ${p[p.length - 1]!}`;
}

export default function AuditoriaPage() {
  const { user, isAuthReady, usuarios } = useAuth();
  const { colaboradoresTodos } = useData();
  const [rows, setRows] = useState<IntranetAuditEventRow[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [colaboradorFilter, setColaboradorFilter] = useState<string>('all');
  const [detailRow, setDetailRow] = useState<IntranetAuditEventRow | null>(null);
  const [actorNames, setActorNames] = useState<Record<number, string>>({});

  const colaboradorById = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of colaboradoresTodos ?? []) {
      if (Number.isFinite(c.id)) m.set(c.id, c.nome ?? `#${c.id}`);
    }
    return m;
  }, [colaboradoresTodos]);

  const usuariosSorted = useMemo(() => {
    return [...(usuarios ?? [])].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt'));
  }, [usuarios]);

  const colaboradoresSorted = useMemo(() => {
    return [...(colaboradoresTodos ?? [])].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt'));
  }, [colaboradoresTodos]);

  const mergeActorNames = useCallback(async (mapped: IntranetAuditEventRow[]) => {
    if (!supabase) return;
    const ids = [...new Set(mapped.map((x) => x.actorProfileId).filter((x): x is number => typeof x === 'number'))];
    if (ids.length === 0) return;
    const { data: profs } = await supabase.from('profiles').select('id, nome').in('id', ids);
    setActorNames((prev) => {
      const next = { ...prev };
      for (const p of (profs ?? []) as { id: number; nome: string }[]) {
        next[p.id] = p.nome;
      }
      return next;
    });
  }, [supabase]);

  const buildQuery = useCallback(() => {
    if (!supabase) return null;
    let q = supabase.from('intranet_audit_events').select('*');
    if (category !== 'all') q = q.eq('event_category', category);
    if (actorFilter !== 'all') {
      const id = Number(actorFilter);
      if (Number.isFinite(id)) q = q.eq('actor_profile_id', id);
    }
    if (colaboradorFilter !== 'all') {
      const id = Number(colaboradorFilter);
      if (Number.isFinite(id)) q = q.eq('colaborador_id', id);
    }
    return q.order('created_at', { ascending: false }).order('id', { ascending: false });
  }, [category, actorFilter, colaboradorFilter]);

  const fetchSlice = useCallback(
    async (offset: number, limit: number): Promise<IntranetAuditEventRow[]> => {
      const q = buildQuery();
      if (!q) return [];
      const { data, error } = await q.range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []).map((r) =>
        mapRowFromDb<IntranetAuditEventRow>('intranet_audit_events', r as Record<string, unknown>),
      );
    },
    [buildQuery],
  );

  const reloadFromStart = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase || !isAuthReady) return;
    setLoading(true);
    setHasMore(true);
    try {
      const slice = await fetchSlice(0, PAGE_SIZE);
      setRows(slice);
      setHasMore(slice.length === PAGE_SIZE);
      await mergeActorNames(slice);
    } catch (e) {
      console.error(e);
      setRows([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [isAuthReady, fetchSlice, mergeActorNames]);

  const loadMore = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase || !isAuthReady || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const slice = await fetchSlice(rows.length, PAGE_SIZE);
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const merged = [...prev];
        for (const r of slice) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            merged.push(r);
          }
        }
        return merged;
      });
      setHasMore(slice.length === PAGE_SIZE);
      await mergeActorNames(slice);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [isAuthReady, rows.length, hasMore, loadingMore, fetchSlice, mergeActorNames]);

  /** Só substitui a primeira página (menos carga que reabrir Realtime em tudo). */
  const silentRefreshFirstPage = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase || !isAuthReady) return;
    if (rows.length > PAGE_SIZE) return;
    try {
      const slice = await fetchSlice(0, PAGE_SIZE);
      setRows(slice);
      setHasMore(slice.length === PAGE_SIZE);
      await mergeActorNames(slice);
    } catch {
      /* ignora em segundo plano */
    }
  }, [isAuthReady, rows.length, fetchSlice, mergeActorNames]);

  useEffect(() => {
    void reloadFromStart();
  }, [reloadFromStart]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase || user?.perfil !== 'Admin') return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void silentRefreshFirstPage();
    };
    const id = window.setInterval(tick, POLL_MS_WHEN_VISIBLE);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [user?.perfil, silentRefreshFirstPage]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = [
        r.summary,
        r.eventCategory,
        r.action,
        r.resourceType,
        r.resourceId,
        JSON.stringify(r.details ?? {}),
        r.actorProfileId != null ? String(actorNames[r.actorProfileId] ?? '') : '',
        r.colaboradorId != null ? String(colaboradorById.get(r.colaboradorId) ?? '') : '',
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search, actorNames, colaboradorById]);

  if (!user) return null;
  if (user.perfil !== 'Admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-xl font-semibold leading-tight">Auditoria</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão consolidada de acções na intranet (login, chat, produtividade, ponto e localização). Apenas administradores.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Eventos</CardTitle>
          <CardDescription>
            Lista paginada no servidor ({PAGE_SIZE} por página), sem subscrição Realtime permanente. Com o separador
            visível, a primeira página actualiza a cada {POLL_MS_WHEN_VISIBLE / 60_000} min. Use «Actualizar» para forçar
            imediatamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Utilizador (actor)</span>
              <Select value={actorFilter} onValueChange={setActorFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os utilizadores</SelectItem>
                  {usuariosSorted.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {shortName(u.nome)} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Colaborador (contexto)</span>
              <Select value={colaboradorFilter} onValueChange={setColaboradorFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="all">Todos os colaboradores</SelectItem>
                  {colaboradoresSorted.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {shortName(c.nome ?? '')} (#{c.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Categoria</span>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="relative flex-1 max-w-md space-y-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Filtrar na lista carregada…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                A pesquisa aplica-se aos eventos já obtidos; carregue mais páginas para alargar o conjunto antes de
                filtrar.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => void reloadFromStart()} disabled={loading}>
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Actualizar
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data / hora</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Utilizador</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Acção</TableHead>
                  <TableHead className="min-w-[200px]">Resumo</TableHead>
                  <TableHead className="w-[72px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-sm py-8 text-center">
                      A carregar…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-sm py-8 text-center">
                      Sem eventos com os filtros actuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-mono">
                        {(() => {
                          try {
                            return format(new Date(r.createdAt), "dd/MM/yyyy HH:mm", { locale: pt });
                          } catch {
                            return r.createdAt;
                          }
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant(r.eventCategory)} className="font-normal">
                          {categoryLabel(r.eventCategory)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[140px] truncate">
                        {r.actorProfileId != null
                          ? actorNames[r.actorProfileId] ?? `#${r.actorProfileId}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[140px] truncate text-muted-foreground">
                        {r.colaboradorId != null ? shortName(colaboradorById.get(r.colaboradorId) ?? `#${r.colaboradorId}`) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.action}</TableCell>
                      <TableCell className="text-sm max-w-[320px]">
                        <span className="line-clamp-2">{r.summary ?? '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" aria-label="Detalhes" onClick={() => setDetailRow(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => void loadMore()} disabled={loadingMore || loading}>
                {loadingMore ? 'A carregar…' : 'Carregar mais'}
              </Button>
            </div>
          ) : rows.length > 0 ? (
            <p className="text-center text-xs text-muted-foreground">Fim da lista para os filtros seleccionados.</p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={detailRow != null} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="max-w-lg max-h-[85dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhe do evento</DialogTitle>
          </DialogHeader>
          {detailRow ? (
            <ScrollArea className="flex-1 min-h-0 max-h-[60dvh] pr-3">
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">ID</dt>
                  <dd className="font-mono">{detailRow.id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Categoria</dt>
                  <dd>{categoryLabel(detailRow.eventCategory)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Recurso</dt>
                  <dd className="font-mono text-xs break-all">
                    {detailRow.resourceType ?? '—'} {detailRow.resourceId ? `· ${detailRow.resourceId}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Payload (JSON)</dt>
                  <dd>
                    <pre className="mt-1 rounded-md border bg-muted/40 p-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(detailRow.details ?? {}, null, 2)}
                    </pre>
                  </dd>
                </div>
              </dl>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
