import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
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

export default function AuditoriaPage() {
  const { user, isAuthReady } = useAuth();
  const [rows, setRows] = useState<IntranetAuditEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [detailRow, setDetailRow] = useState<IntranetAuditEventRow | null>(null);
  const [actorNames, setActorNames] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase || !isAuthReady) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('intranet_audit_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(800);
      if (error) throw error;
      const mapped = (data ?? []).map((r) =>
        mapRowFromDb<IntranetAuditEventRow>('intranet_audit_events', r as Record<string, unknown>),
      );
      setRows(mapped);
      const ids = [...new Set(mapped.map((x) => x.actorProfileId).filter((x): x is number => typeof x === 'number'))];
      if (ids.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, nome').in('id', ids);
        const nm: Record<number, string> = {};
        for (const p of (profs ?? []) as { id: number; nome: string }[]) {
          nm[p.id] = p.nome;
        }
        setActorNames(nm);
      } else {
        setActorNames({});
      }
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthReady]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase || user?.perfil !== 'Admin') return;
    const channel = supabase
      .channel('intranet-audit-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'intranet_audit_events' },
        (payload) => {
          const row = mapRowFromDb<IntranetAuditEventRow>(
            'intranet_audit_events',
            payload.new as Record<string, unknown>,
          );
          setRows((prev) => {
            const next = [row, ...prev.filter((r) => r.id !== row.id)];
            return next.slice(0, 800);
          });
          if (typeof row.actorProfileId === 'number' && row.actorProfileId > 0) {
            setActorNames((prev) => {
              if (prev[row.actorProfileId!]) return prev;
              return prev;
            });
            void supabase
              .from('profiles')
              .select('id, nome')
              .eq('id', row.actorProfileId)
              .maybeSingle()
              .then(({ data }) => {
                const p = data as { id: number; nome: string } | null;
                if (p?.nome) {
                  setActorNames((prev) => ({ ...prev, [p.id]: p.nome }));
                }
              });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.perfil]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== 'all' && r.eventCategory !== category) return false;
      if (!q) return true;
      const blob = [
        r.summary,
        r.eventCategory,
        r.action,
        r.resourceType,
        r.resourceId,
        JSON.stringify(r.details ?? {}),
        r.actorProfileId != null ? String(actorNames[r.actorProfileId] ?? '') : '',
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search, category, actorNames]);

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
            Últimos 800 registos; actualização em tempo real para novos eventos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Pesquisar resumo, tipo, ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[220px]">
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
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Actualizar
              </Button>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data / hora</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Utilizador</TableHead>
                  <TableHead>Acção</TableHead>
                  <TableHead className="min-w-[200px]">Resumo</TableHead>
                  <TableHead className="w-[72px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-sm py-8 text-center">
                      A carregar…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-sm py-8 text-center">
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
                      <TableCell className="text-sm max-w-[160px] truncate">
                        {r.actorProfileId != null
                          ? actorNames[r.actorProfileId] ?? `#${r.actorProfileId}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.action}</TableCell>
                      <TableCell className="text-sm max-w-[360px]">
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
