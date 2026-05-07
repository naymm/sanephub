import { useMemo, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import type { ProdutividadeActividade, ProdutividadeEntregavel, ProdutividadeStatus } from '@/types';
import { mapRowFromDb } from '@/lib/supabaseMappers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, UploadCloud } from 'lucide-react';
import { DndContext, DragEndEvent, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_KANBAN: Array<Extract<ProdutividadeStatus, 'Pendente' | 'Em Progresso' | 'Concluída'>> = [
  'Pendente',
  'Em Progresso',
  'Concluída',
];

function isOverdue(a: ProdutividadeActividade): boolean {
  if (a.status === 'Concluída' || a.status === 'Cancelada') return false;
  const today = new Date();
  const t = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const d = new Date(a.prazo + 'T00:00:00Z');
  return d < t;
}

function effectiveStatus(a: ProdutividadeActividade): ProdutividadeStatus {
  // UI-friendly: se o prazo venceu e não foi concluída, mostrar como atrasada (DB também tenta manter isso por trigger).
  return isOverdue(a) ? 'Atrasada' : a.status;
}

function statusBadgeVariant(s: ProdutividadeStatus): React.ComponentProps<typeof Badge>['variant'] {
  if (s === 'Concluída') return 'default';
  if (s === 'Em Progresso') return 'secondary';
  if (s === 'Atrasada') return 'destructive';
  if (s === 'Cancelada') return 'outline';
  return 'outline';
}

function prioridadeColorClass(p: string): string {
  if (p === 'Urgente') return 'text-red-600';
  if (p === 'Alta') return 'text-amber-600';
  if (p === 'Média') return 'text-sky-600';
  return 'text-muted-foreground';
}

function SortableCard({ id, a }: { id: string; a: ProdutividadeActividade }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const s = effectiveStatus(a);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium leading-snug truncate">{a.titulo}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Prazo: <span className={cn('font-medium', s === 'Atrasada' && 'text-destructive')}>{a.prazo}</span>
          </div>
        </div>
        <Badge variant={statusBadgeVariant(s)} className="shrink-0">
          {s}
        </Badge>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={cn('text-xs font-semibold', prioridadeColorClass(a.prioridade))}>{a.prioridade}</span>
        <span className="text-xs text-muted-foreground">{a.categoria}</span>
      </div>
    </div>
  );
}

function KanbanColumn({
  columnId,
  title,
  count,
  children,
}: {
  columnId: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  return (
    <div ref={setNodeRef} className={cn('rounded-xl border bg-card', isOver && 'ring-2 ring-primary/30')}>
      <div className="p-3 border-b flex items-center justify-between">
        <div className="font-semibold text-sm">{title}</div>
        <Badge variant="outline">{count}</Badge>
      </div>
      <div className="p-3 space-y-2 min-h-[220px]">{children}</div>
    </div>
  );
}

export default function MinhasActividadesPage() {
  const { currentEmpresaId } = useTenant();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProdutividadeStatus | 'all'>('all');
  const [prioridadeFilter, setPrioridadeFilter] = useState<string | 'all'>('all');
  const [categoriaFilter, setCategoriaFilter] = useState<string | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeTargetId, setCompleteTargetId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const mapRow = useMemo(() => {
    return (row: Record<string, unknown>) => mapRowFromDb<ProdutividadeActividade>('produtividade_actividades', row);
  }, []);

  const { rows: allRows, isLoading } = useRealtimeTable<ProdutividadeActividade>('produtividade_actividades', 'id', {
    mapRow,
  });

  const mapEnt = useMemo(() => {
    return (row: Record<string, unknown>) => mapRowFromDb<ProdutividadeEntregavel>('produtividade_entregaveis', row);
  }, []);
  const { rows: allEntregaveis } = useRealtimeTable<ProdutividadeEntregavel>('produtividade_entregaveis', 'id', {
    mapRow: mapEnt,
  });

  const entregaveisByActividade = useMemo(() => {
    const m = new Map<number, ProdutividadeEntregavel[]>();
    for (const e of allEntregaveis) {
      const id = Number(e.actividadeId);
      if (!Number.isFinite(id)) continue;
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push(e);
    }
    return m;
  }, [allEntregaveis]);

  const myRows = useMemo(() => {
    const base =
      currentEmpresaId === 'consolidado'
        ? allRows
        : allRows.filter(r => Number(r.empresaId) === Number(currentEmpresaId));
    // Em perfis sem colaboradorId (ex.: PCA grupo) mostramos vazio por defeito.
    if (!user?.colaboradorId) return [];
    return base.filter(r => r.colaboradorId === user.colaboradorId);
  }, [allRows, currentEmpresaId, user?.colaboradorId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return myRows
      .filter(a => {
        const s = effectiveStatus(a);
        if (statusFilter !== 'all' && s !== statusFilter) return false;
        if (prioridadeFilter !== 'all' && a.prioridade !== prioridadeFilter) return false;
        if (categoriaFilter !== 'all' && a.categoria !== categoriaFilter) return false;
        if (dateFilter && a.dataActividade !== dateFilter) return false;
        if (!q) return true;
        return (
          a.titulo.toLowerCase().includes(q) ||
          (a.descricao ?? '').toLowerCase().includes(q) ||
          (a.comentario ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // default: mais urgentes e prazo mais próximo
        const pr = (p: string) => (p === 'Urgente' ? 4 : p === 'Alta' ? 3 : p === 'Média' ? 2 : 1);
        const d = (s: string) => (s ? new Date(s + 'T00:00:00Z').getTime() : 0);
        const byPr = pr(b.prioridade) - pr(a.prioridade);
        if (byPr !== 0) return byPr;
        return d(a.prazo) - d(b.prazo);
      });
  }, [myRows, search, statusFilter, prioridadeFilter, categoriaFilter, dateFilter]);

  const metrics = useMemo(() => {
    const total = myRows.length;
    const concluida = myRows.filter(a => effectiveStatus(a) === 'Concluída').length;
    const atrasada = myRows.filter(a => effectiveStatus(a) === 'Atrasada').length;
    const emProgresso = myRows.filter(a => effectiveStatus(a) === 'Em Progresso').length;
    const pendente = myRows.filter(a => effectiveStatus(a) === 'Pendente').length;
    const pct = total === 0 ? 0 : Math.round((concluida / total) * 100);
    return { total, concluida, atrasada, emProgresso, pendente, pct };
  }, [myRows]);

  const kanbanColumns = useMemo(() => {
    const cols: Record<string, ProdutividadeActividade[]> = { Pendente: [], 'Em Progresso': [], 'Concluída': [] };
    for (const a of filtered) {
      const s = effectiveStatus(a);
      if (s === 'Pendente' || s === 'Em Progresso' || s === 'Concluída') cols[s].push(a);
    }
    for (const k of Object.keys(cols)) cols[k] = cols[k].slice().sort((a, b) => (a.kanbanOrder ?? 0) - (b.kanbanOrder ?? 0));
    return cols as Record<(typeof STATUS_KANBAN)[number], ProdutividadeActividade[]>;
  }, [filtered]);

  const dayKey = useMemo(() => {
    if (!selectedDay) return '';
    const y = selectedDay.getFullYear();
    const m = String(selectedDay.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDay.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDay]);

  const calendarRows = useMemo(() => {
    if (!dayKey) return [];
    return filtered.filter(a => a.dataActividade === dayKey).slice(0, 50);
  }, [filtered, dayKey]);

  async function createActivity(form: {
    tipoActividade: string;
    localizacao: string | null;
    meioOnline: string | null;
    titulo: string;
    descricao: string;
    comentario: string;
    dataActividade: string;
    prazo: string;
    prioridade: string;
    categoria: string;
    possuiEntregavel: boolean;
  }) {
    if (!isSupabaseConfigured() || !supabase) {
      toast.error('Produtividade requer Supabase configurado.');
      return;
    }
    if (!user?.colaboradorId) {
      toast.error('Este utilizador não está associado a um colaborador.');
      return;
    }
    const empresaIdForInsert =
      currentEmpresaId === 'consolidado' ? (typeof user.empresaId === 'number' ? user.empresaId : null) : currentEmpresaId;
    if (empresaIdForInsert == null) {
      toast.error('Para criar actividades seleccione uma empresa (não “consolidado”).');
      return;
    }
    setCreating(true);
    try {
      const payload: any = {
        empresa_id: empresaIdForInsert,
        colaborador_id: user.colaboradorId,
        tipo_actividade: form.tipoActividade,
        localizacao: form.tipoActividade === 'Presencial' ? form.localizacao : null,
        meio_online: form.tipoActividade === 'Online' ? form.meioOnline : null,
        titulo: form.titulo,
        descricao: form.descricao?.trim() ? form.descricao.trim() : null,
        comentario: form.comentario?.trim() ? form.comentario.trim() : null,
        data_actividade: form.dataActividade,
        prazo: form.prazo,
        prioridade: form.prioridade,
        categoria: form.categoria,
        possui_entregavel: form.possuiEntregavel,
        status: 'Pendente',
        kanban_order: 0,
      };
      const { error } = await supabase.from('produtividade_actividades').insert(payload);
      if (error) throw new Error(error.message || 'Erro ao criar actividade');
      toast.success('Actividade criada.');
      setCreateDialogOpen(false);
    } finally {
      setCreating(false);
    }
  }

  const completeTarget = useMemo(() => {
    if (!completeTargetId) return null;
    return myRows.find(r => r.id === completeTargetId) ?? null;
  }, [completeTargetId, myRows]);

  const completeTargetHasEntregavel = useMemo(() => {
    if (!completeTarget) return false;
    const list = entregaveisByActividade.get(completeTarget.id) ?? [];
    return list.length > 0;
  }, [completeTarget, entregaveisByActividade]);

  async function setStatus(id: number, next: ProdutividadeStatus) {
    if (!isSupabaseConfigured() || !supabase) return;
    await (supabase.from('produtividade_actividades') as any).update({ status: next }).eq('id', id);
  }

  function requestComplete(a: ProdutividadeActividade) {
    const needsUpload = a.possuiEntregavel && !(entregaveisByActividade.get(a.id)?.length);
    if (needsUpload) {
      setCompleteTargetId(a.id);
      setUploadFile(null);
      setCompleteDialogOpen(true);
      return;
    }
    void setStatus(a.id, 'Concluída');
  }

  function isAllowedDeliverableFile(f: File): boolean {
    const name = f.name.toLowerCase();
    const ext = name.split('.').pop() || '';
    const allowedExt = new Set(['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg', 'webp']);
    if (!allowedExt.has(ext)) return false;
    // Mime types variam; não confiar só no type.
    return true;
  }

  async function uploadDeliverableAndComplete() {
    if (!completeTarget) return;
    if (!uploadFile) return;
    if (!isSupabaseConfigured() || !supabase) return;
    if (!user?.colaboradorId) return;
    if (currentEmpresaId === 'consolidado') return;

    if (!isAllowedDeliverableFile(uploadFile)) return;
    setUploading(true);
    try {
      const ext = uploadFile.name.split('.').pop() || 'bin';
      const safeName = uploadFile.name.replace(/[^\w.\-() ]+/g, '_').slice(0, 90);
      const path = `empresa-${currentEmpresaId}/colab-${user.colaboradorId}/act-${completeTarget.id}/${Date.now()}-${safeName}`;

      const { data, error } = await supabase.storage
        .from('produtividade-entregaveis')
        .upload(path, uploadFile, { upsert: true, contentType: uploadFile.type || undefined });
      if (error || !data?.path) throw new Error(error?.message || 'Falha ao carregar entregável');

      await (supabase.from('produtividade_entregaveis') as any).insert({
        actividade_id: completeTarget.id,
        storage_path: data.path,
        nome_ficheiro: uploadFile.name,
        mime_type: uploadFile.type || `application/${ext}`,
        tamanho_bytes: uploadFile.size,
        estado: 'Pendente',
        uploaded_by_colaborador_id: user.colaboradorId,
      });

      await setStatus(completeTarget.id, 'Concluída');
      setCompleteDialogOpen(false);
      setCompleteTargetId(null);
    } finally {
      setUploading(false);
    }
  }

  async function updateKanban(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) return;

    // ids:
    // - card:<id>
    // - col:<Status>
    if (!activeId.startsWith('card:')) return;
    const activeActId = Number(activeId.replace('card:', ''));
    if (!Number.isFinite(activeActId)) return;

    const overIsColumn = overId.startsWith('col:');
    const overStatus = overIsColumn ? overId.replace('col:', '') : overId.includes(':') ? overId.split(':')[0] : null;

    // quando o over é outro card, ele vem como `${status}:${id}` no SortableContext
    const targetStatus = overIsColumn
      ? (overStatus as (typeof STATUS_KANBAN)[number])
      : ((overId.split(':')[0] ?? '') as (typeof STATUS_KANBAN)[number]);

    if (!STATUS_KANBAN.includes(targetStatus)) return;

    const active = myRows.find(a => a.id === activeActId);
    if (!active) return;

    const fromStatus = (effectiveStatus(active) as any) as (typeof STATUS_KANBAN)[number];
    if (!STATUS_KANBAN.includes(fromStatus)) return;

    // 1) mover entre colunas → muda status (com validação de entregável ao concluir)
    if (fromStatus !== targetStatus) {
      if (targetStatus === 'Concluída') {
        requestComplete(active);
      } else {
        await setStatus(active.id, targetStatus);
      }
      return;
    }

    // 2) reordenar dentro da mesma coluna
    const fromItems = kanbanColumns[fromStatus];
    const activeIndex = fromItems.findIndex(a => a.id === activeActId);
    if (activeIndex < 0) return;

    // over pode ser uma coluna (drop em vazio) → mandar para o fim
    const overIndex = overIsColumn
      ? fromItems.length - 1
      : (() => {
          const toId = Number(overId.split(':')[1]);
          if (!Number.isFinite(toId)) return -1;
          return fromItems.findIndex(a => a.id === toId);
        })();
    if (overIndex < 0) return;

    const moved = arrayMove(fromItems, activeIndex, overIndex);
    if (!isSupabaseConfigured() || !supabase) return;
    const updates = moved.slice(0, 60).map((a, idx) => ({ id: a.id, kanban_order: idx }));
    await Promise.all(
      updates.map(u => (supabase.from('produtividade_actividades') as any).update({ kanban_order: u.kanban_order }).eq('id', u.id)),
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight">Produtividade</h1>
          <p className="text-sm text-muted-foreground">Minhas Actividades</p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nova actividade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Criar actividade</DialogTitle>
              </DialogHeader>
              <CreateActivityForm
                onCreate={createActivity}
                creating={creating}
                disableSubmit={
                  !user?.colaboradorId || (currentEmpresaId === 'consolidado' && typeof user?.empresaId !== 'number')
                }
                disableReason={
                  !user?.colaboradorId
                    ? 'Utilizador sem colaborador associado.'
                    : currentEmpresaId === 'consolidado' && typeof user?.empresaId !== 'number'
                      ? 'Seleccione uma empresa (não “consolidado”).'
                      : undefined
                }
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{metrics.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Concluídas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{metrics.concluida}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Atrasadas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{metrics.atrasada}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Em progresso</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{metrics.emProgresso}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">% conclusão</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{metrics.pct}%</CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9" placeholder="Pesquisar actividade…" />
        </div>

        <div className="grid w-full gap-2 md:flex md:w-auto md:items-center">
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Em Progresso">Em Progresso</SelectItem>
              <SelectItem value="Concluída">Concluída</SelectItem>
              <SelectItem value="Atrasada">Atrasada</SelectItem>
              <SelectItem value="Cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={prioridadeFilter} onValueChange={(v: any) => setPrioridadeFilter(v)}>
            <SelectTrigger className="w-full md:w-[170px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="Baixa">Baixa</SelectItem>
              <SelectItem value="Média">Média</SelectItem>
              <SelectItem value="Alta">Alta</SelectItem>
              <SelectItem value="Urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoriaFilter} onValueChange={(v: any) => setCategoriaFilter(v)}>
            <SelectTrigger className="w-full md:w-[190px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {['Administrativa', 'Financeira', 'RH', 'Operacional', 'Jurídica', 'Técnica', 'Outra'].map(c => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-full md:w-[170px]"
            aria-label="Filtrar por data"
          />
        </div>
      </div>

      <Tabs defaultValue="lista" className="w-full">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4">
          <div className="rounded-xl border bg-card">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {isLoading ? 'A carregar…' : `${filtered.length} actividade(s)`}
              </div>
            </div>
            <div className="divide-y">
              {filtered.slice(0, 200).map(a => {
                const s = effectiveStatus(a);
                const hasEnt = (entregaveisByActividade.get(a.id) ?? []).length > 0;
                return (
                  <div key={a.id} className="p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{a.titulo}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {a.descricao?.trim() ? a.descricao : a.comentario?.trim() ? a.comentario : '—'}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant={statusBadgeVariant(s)}>{s}</Badge>
                          <span className={cn('font-semibold', prioridadeColorClass(a.prioridade))}>{a.prioridade}</span>
                          <span className="text-muted-foreground">{a.categoria}</span>
                          <span className="text-muted-foreground">Data: {a.dataActividade}</span>
                          <span className={cn('text-muted-foreground', s === 'Atrasada' && 'text-destructive')}>
                            Prazo: {a.prazo}
                          </span>
                          {a.possuiEntregavel ? (
                            <Badge variant={hasEnt ? 'secondary' : 'outline'}>{hasEnt ? 'Entregável anexado' : 'Entregável'}</Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {s !== 'Concluída' && s !== 'Cancelada' ? (
                          <Button size="sm" variant="secondary" onClick={() => requestComplete(a)}>
                            Concluir
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!isLoading && filtered.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Sem actividades com os filtros actuais.</div>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={updateKanban}>
            <div className="grid gap-3 md:grid-cols-3">
              {STATUS_KANBAN.map(col => (
                <KanbanColumn key={col} columnId={`col:${col}`} title={col} count={kanbanColumns[col].length}>
                  <SortableContext items={kanbanColumns[col].map(a => `${col}:${a.id}`)} strategy={rectSortingStrategy}>
                    {kanbanColumns[col].map(a => (
                      <SortableCard key={a.id} id={`card:${a.id}`} a={a} />
                    ))}
                  </SortableContext>
                  {kanbanColumns[col].length === 0 ? (
                    <div className="text-xs text-muted-foreground py-10 text-center">Arraste aqui</div>
                  ) : null}
                </KanbanColumn>
              ))}
            </div>
          </DndContext>
        </TabsContent>

        <TabsContent value="calendario" className="mt-4">
          <div className="grid gap-4 md:grid-cols-[340px_1fr]">
            <div className="rounded-xl border bg-card p-3">
              <Calendar mode="single" selected={selectedDay} onSelect={setSelectedDay} />
            </div>
            <div className="rounded-xl border bg-card">
              <div className="p-3 border-b flex items-center justify-between">
                <div className="text-sm font-semibold">{dayKey || 'Dia'}</div>
                <div className="text-xs text-muted-foreground">{calendarRows.length} actividade(s)</div>
              </div>
              <div className="divide-y">
                {calendarRows.map(a => {
                  const s = effectiveStatus(a);
                  return (
                    <div key={a.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{a.titulo}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {a.comentario?.trim() ? a.comentario : '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={statusBadgeVariant(s)}>{s}</Badge>
                          <span className={cn('text-xs font-semibold', prioridadeColorClass(a.prioridade))}>{a.prioridade}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {calendarRows.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">Sem actividades neste dia.</div>
                ) : null}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={completeDialogOpen} onOpenChange={(v) => setCompleteDialogOpen(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Concluir actividade</DialogTitle>
          </DialogHeader>

          {completeTarget ? (
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <div className="font-medium">{completeTarget.titulo}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Prazo: {completeTarget.prazo}</div>
              </div>

              {completeTarget.possuiEntregavel && !completeTargetHasEntregavel ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Entregável obrigatório</div>
                  <div className="text-xs text-muted-foreground">
                    Para concluir esta actividade, anexe um ficheiro (PDF, DOCX, XLSX ou imagem).
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".pdf,.docx,.xlsx,image/*"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      variant="secondary"
                      onClick={uploadDeliverableAndComplete}
                      disabled={!uploadFile || uploading}
                      className="gap-2"
                    >
                      <UploadCloud className="h-4 w-4" />
                      {uploading ? 'A enviar…' : 'Enviar e concluir'}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {uploadFile ? `Seleccionado: ${uploadFile.name}` : 'Nenhum ficheiro seleccionado.'}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCompleteDialogOpen(false);
                      setCompleteTargetId(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={async () => {
                      await setStatus(completeTarget.id, 'Concluída');
                      setCompleteDialogOpen(false);
                      setCompleteTargetId(null);
                    }}
                  >
                    Concluir
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Seleccione uma actividade.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateActivityForm({
  onCreate,
  creating,
  disableSubmit,
  disableReason,
}: {
  creating: boolean;
  disableSubmit?: boolean;
  disableReason?: string;
  onCreate: (form: {
    tipoActividade: string;
    localizacao: string | null;
    meioOnline: string | null;
    titulo: string;
    descricao: string;
    comentario: string;
    dataActividade: string;
    prazo: string;
    prioridade: string;
    categoria: string;
    possuiEntregavel: boolean;
  }) => Promise<void>;
}) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayKey = `${y}-${m}-${d}`;

  const [tipoActividade, setTipoActividade] = useState<string>('Presencial');
  const [localizacao, setLocalizacao] = useState<string>('Na Empresa');
  const [meioOnline, setMeioOnline] = useState<string>('Zoom');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [comentario, setComentario] = useState('');
  const [dataActividade, setDataActividade] = useState(todayKey);
  const [prazo, setPrazo] = useState(todayKey);
  const [prioridade, setPrioridade] = useState('Média');
  const [categoria, setCategoria] = useState('Técnica');
  const [possuiEntregavel, setPossuiEntregavel] = useState(false);

  const canSubmit =
    titulo.trim().length >= 3 &&
    dataActividade.trim() &&
    prazo.trim() &&
    prioridade &&
    categoria &&
    tipoActividade &&
    (tipoActividade !== 'Presencial' || Boolean(localizacao)) &&
    (tipoActividade !== 'Online' || Boolean(meioOnline)) &&
    !disableSubmit;

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        await onCreate({
          tipoActividade,
          localizacao: tipoActividade === 'Presencial' ? localizacao : null,
          meioOnline: tipoActividade === 'Online' ? meioOnline : null,
          titulo: titulo.trim(),
          descricao,
          comentario,
          dataActividade,
          prazo,
          prioridade,
          categoria,
          possuiEntregavel,
        });
      }}
    >
      {disableSubmit ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {disableReason ?? 'Não é possível criar actividade neste contexto.'}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Tipo de actividade</Label>
          <Select value={tipoActividade} onValueChange={setTipoActividade}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['Presencial', 'Online', 'Externa', 'Híbrida'].map(t => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tipoActividade === 'Online' ? (
          <div className="grid gap-2">
            <Label>Meio</Label>
            <Select value={meioOnline} onValueChange={setMeioOnline}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Zoom">Zoom</SelectItem>
                <SelectItem value="Google Meet">Google Meet</SelectItem>
                <SelectItem value="Microsoft Teams">Microsoft Teams</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label>Localização</Label>
            <Select value={localizacao} onValueChange={setLocalizacao} disabled={tipoActividade !== 'Presencial'}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Na Empresa">Na Empresa</SelectItem>
                <SelectItem value="Fora da Empresa">Fora da Empresa</SelectItem>
              </SelectContent>
            </Select>
            {tipoActividade !== 'Presencial' ? (
              <div className="text-xs text-muted-foreground">Disponível apenas para actividades presenciais.</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Título</Label>
        <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Preparar relatório semanal" />
      </div>

      <div className="grid gap-2">
        <Label>Descrição (opcional)</Label>
        <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Contexto / detalhes…" />
      </div>

      <div className="grid gap-2">
        <Label>Comentário (opcional)</Label>
        <Textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Opcional…" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Data da actividade</Label>
          <Input type="date" value={dataActividade} onChange={e => setDataActividade(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Prazo (deadline)</Label>
          <Input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Prioridade</Label>
          <Select value={prioridade} onValueChange={setPrioridade}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['Baixa', 'Média', 'Alta', 'Urgente'].map(p => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['Administrativa', 'Financeira', 'RH', 'Operacional', 'Jurídica', 'Técnica', 'Outra'].map(c => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Possui entregável?</div>
          <div className="text-xs text-muted-foreground">
            Se marcado, ao concluir a actividade vamos exigir upload de ficheiro (PDF/DOCX/XLSX/imagens).
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-muted-foreground">{possuiEntregavel ? 'Sim' : 'Não'}</span>
          <Switch checked={possuiEntregavel} onCheckedChange={setPossuiEntregavel} aria-label="Possui entregável" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={!canSubmit || creating}>
          {creating ? 'A criar…' : 'Criar'}
        </Button>
      </div>
    </form>
  );
}

