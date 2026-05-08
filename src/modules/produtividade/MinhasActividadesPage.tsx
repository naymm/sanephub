import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import type {
  ProdutividadeActividade,
  ProdutividadeComentario,
  ProdutividadeEntregavel,
  ProdutividadeEvento,
  ProdutividadeParticipante,
  ProdutividadeStatus,
} from '@/types';
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
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Plus, Search, UploadCloud, Clock, Tag, CalendarDays, Flag, User, Users, Loader2, Download, Eye, FileText, FileImage, File, Paperclip } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EmployeeMultiSelect } from '@/components/shared/EmployeeMultiSelect';
import { EmployeeSelect } from '@/components/shared/EmployeeSelect';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function isAllowedDeliverableFile(f: File): boolean {
  const name = f.name.toLowerCase();
  const ext = name.split('.').pop() || '';
  const allowedExt = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp']);
  return allowedExt.has(ext);
}

const ENTREGAVEL_INPUT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,image/*';

function DeliverableFileDropZone({
  disabled,
  uploading,
  uploadingHint,
  selectedFile,
  onFileSelected,
  dropZoneClassName,
  ariaLabel = 'Área para largar ou escolher ficheiro do entregável',
  idleTitle,
  idleSub,
}: {
  disabled?: boolean;
  /** Enviar ficheiro ao armazenamento (mostra estado na zona). */
  uploading?: boolean;
  /** Texto curto durante o envio (ex.: destino do estado). */
  uploadingHint?: string;
  selectedFile: File | null;
  onFileSelected: (file: File | null) => void;
  dropZoneClassName?: string;
  ariaLabel?: string;
  idleTitle?: string;
  idleSub?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const applyChosenFile = useCallback(
    (file: File | null) => {
      if (!file) {
        onFileSelected(null);
        return;
      }
      if (!isAllowedDeliverableFile(file)) {
        toast.error('Tipo de ficheiro não aceite. Use PDF, Word, PowerPoint, Excel ou imagem (PNG, JPG, JPEG, WebP).');
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected],
  );

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || uploading) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || uploading) return;
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) {
      try {
        e.dataTransfer.dropEffect = 'copy';
      } catch {
        /* ignore */
      }
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (disabled || uploading) return;
    const f = e.dataTransfer.files?.[0];
    applyChosenFile(f ?? null);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={ENTREGAVEL_INPUT_ACCEPT}
        disabled={disabled || uploading}
        onChange={(ev: ChangeEvent<HTMLInputElement>) => {
          applyChosenFile(ev.target.files?.[0] ?? null);
          ev.target.value = '';
        }}
      />
      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        aria-disabled={disabled || uploading}
        aria-label={ariaLabel}
        className={cn(
          'w-full rounded-xl border-2 border-dashed text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'p-6 min-h-[140px] flex flex-col items-center justify-center gap-2',
          dropZoneClassName,
          !(disabled || uploading) && 'cursor-pointer',
          (disabled || uploading) && 'pointer-events-none opacity-70',
          isDragging && !disabled && !uploading ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 bg-muted/20 hover:bg-muted/35',
        )}
        onClick={() => {
          if (!disabled && !uploading) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (disabled || uploading) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {uploading ? (
          <>
            <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
            <div className="text-sm font-medium text-center">A enviar o ficheiro…</div>
            <div className="text-xs text-muted-foreground text-center max-w-[280px]">
              {uploadingHint ?? 'A actualizar o estado da actividade…'}
            </div>
            {selectedFile ? (
              <div className="mt-1 text-xs font-medium text-foreground truncate max-w-full px-1 text-center">
                {selectedFile.name}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <UploadCloud className={cn('h-9 w-9', isDragging ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
            <div className="text-sm font-medium text-center">
              {isDragging ? 'Largue o ficheiro aqui' : (idleTitle ?? 'Arraste o ficheiro para aqui')}
            </div>
            <div className="text-xs text-muted-foreground text-center max-w-[280px]">
              {idleSub ??
                'ou clique para escolher — o envio e a mudança de estado são automáticos (PDF, DOCX, XLSX, imagens)'}
            </div>
            {selectedFile ? (
              <div className="mt-1 text-xs font-medium text-foreground truncate max-w-full px-1 text-center">
                {selectedFile.name}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function formatEntregavelSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isOfficePreviewableEntregavel(row: { nomeFicheiro: string; mimeType?: string | null }): boolean {
  const name = (row.nomeFicheiro || '').toLowerCase();
  const ext = name.split('.').pop() || '';
  if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) return true;
  const m = (row.mimeType || '').toLowerCase();
  return m.includes('officedocument') || m.includes('msword') || m.includes('mspowerpoint') || m.includes('msexcel');
}

function isPdfPreviewableEntregavel(row: { nomeFicheiro: string; mimeType?: string | null }): boolean {
  const name = (row.nomeFicheiro || '').toLowerCase();
  const ext = name.split('.').pop() || '';
  if (ext === 'pdf') return true;
  const m = (row.mimeType || '').toLowerCase();
  return m.includes('pdf');
}

function officeViewerUrlFromPublicUrl(publicUrl: string): string {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(publicUrl)}`;
}

function entregavelLinkedToDeliverableEvent(ev: ProdutividadeEvento, list: ProdutividadeEntregavel[]): ProdutividadeEntregavel | null {
  const p = ev.payload ?? {} as Record<string, unknown>;
  const rid = p['entregavel_id'];
  if (rid != null) {
    const id = Number(rid);
    if (Number.isFinite(id)) {
      const hit = list.find((x) => x.id === id);
      if (hit) return hit;
    }
  }
  const sp = typeof p['storage_path'] === 'string' ? (p['storage_path'] as string) : null;
  if (sp) {
    const hit = list.find((x) => x.storagePath === sp);
    if (hit) return hit;
  }
  const nome = typeof p['nome'] === 'string' ? p['nome'] : null;
  if (!nome) return null;
  const sameName = list.filter((x) => x.nomeFicheiro === nome);
  if (sameName.length === 0) return null;
  return sameName.sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''))[0] ?? null;
}

function EntregavelFileVisual({ mimeType }: { mimeType: string }) {
  const m = (mimeType || '').toLowerCase();
  const box = 'h-10 w-10 shrink-0 rounded-lg border bg-background flex items-center justify-center';
  if (m.includes('pdf')) return <FileText className={cn(box, 'text-red-600')} aria-hidden />;
  if (m.startsWith('image/')) return <FileImage className={cn(box, 'text-sky-600')} aria-hidden />;
  if (m.includes('sheet') || m.includes('spreadsheet') || mimeType.includes('excel')) return <FileText className={cn(box, 'text-emerald-600')} aria-hidden />;
  return <File className={cn(box, 'text-muted-foreground')} aria-hidden />;
}

const STATUS_KANBAN = ['Pendente', 'Em Progresso', 'Em aprovação', 'Concluída'] as const;
type KanbanColumnId = (typeof STATUS_KANBAN)[number];

const DND_COL_PREFIX = 'col:' as const;
const DND_ITEM_PREFIX = 'act:' as const;

function dndItemId(id: number): string {
  return `${DND_ITEM_PREFIX}${id}`;
}

function parseDndItemId(value: string): number | null {
  if (!value.startsWith(DND_ITEM_PREFIX)) return null;
  const n = Number(value.slice(DND_ITEM_PREFIX.length));
  return Number.isFinite(n) ? n : null;
}

function isColumnId(value: string): value is `${typeof DND_COL_PREFIX}${KanbanColumnId}` {
  return value.startsWith(DND_COL_PREFIX) && (STATUS_KANBAN as readonly string[]).includes(value.slice(DND_COL_PREFIX.length));
}

function kanbanColumnForActivity(a: ProdutividadeActividade): KanbanColumnId | null {
  if (a.status === 'Cancelada') return null;
  if (a.status === 'Concluída') return 'Concluída';
  if (a.status === 'Em aprovação') return 'Em aprovação';
  if (a.status === 'Pendente') return 'Pendente';
  return 'Em Progresso';
}

/** Actividades com aprovação obrigatória só podem chegar a «Concluída» a partir de «Em aprovação». */
function mustCompleteViaApprovalFlow(a: ProdutividadeActividade | undefined): boolean {
  if (!a) return false;
  return Boolean(a.requerAprovacao) && a.status !== 'Em aprovação' && a.status !== 'Concluída' && a.status !== 'Cancelada';
}

function missingObrigatorioEntregavel(a: ProdutividadeActividade | undefined, entregaCount: number): boolean {
  if (!a?.possuiEntregavel) return false;
  return entregaCount <= 0;
}

function pendingApprovalCompletionStatus(a: ProdutividadeActividade): 'Em aprovação' | 'Concluída' {
  if (Boolean(a.requerAprovacao) && a.aprovadorColaboradorId != null) return 'Em aprovação';
  return 'Concluída';
}

function canManageApprovalTransition(
  a: ProdutividadeActividade,
  colabId: number | undefined | null,
  perfil: string | null | undefined,
  governanceEmpresaId: number | null,
): boolean {
  if (!colabId || !a.aprovadorColaboradorId) return false;
  if (a.aprovadorColaboradorId === colabId) return true;
  const p = perfil ?? '';
  if (!(p === 'Admin' || p === 'PCA' || p === 'Director')) return false;
  if (governanceEmpresaId == null) return false;
  return Number(a.empresaId) === Number(governanceEmpresaId);
}

function isOverdue(a: ProdutividadeActividade): boolean {
  if (a.status === 'Concluída' || a.status === 'Cancelada') return false;
  const today = new Date();
  const t = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const d = new Date(a.prazo + 'T00:00:00Z');
  return d < t;
}

function effectiveStatus(a: ProdutividadeActividade): ProdutividadeStatus {
  // «Em aprovação» tem prioridade na UI mesmo com prazo vencido — o fluxo decisório vem primeiro.
  if (a.status === 'Em aprovação') return 'Em aprovação';
  // UI-friendly: se o prazo venceu e não foi concluída, mostrar como atrasada (DB também tenta manter isso por trigger).
  return isOverdue(a) ? 'Atrasada' : a.status;
}

function statusBadgeVariant(s: ProdutividadeStatus): React.ComponentProps<typeof Badge>['variant'] {
  if (s === 'Concluída') return 'default';
  if (s === 'Em Progresso') return 'secondary';
  if (s === 'Em aprovação') return 'secondary';
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

function TaskCard({
  a,
  dragging,
  onOpen,
}: {
  a: ProdutividadeActividade;
  dragging?: boolean;
  onOpen?: () => void;
}) {
  const s = effectiveStatus(a);
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm transition-[box-shadow,transform,opacity] duration-200 ease-out',
        'hover:shadow-md',
        dragging && 'shadow-lg',
      )}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
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

function SortableCard({ id, a, disabled }: { id: string; a: ProdutividadeActividade; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing select-none',
        isDragging && 'opacity-40',
      )}
    >
      <TaskCard a={a} />
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

export default function MinhasActividadesPage({
  scope = 'mine',
}: {
  scope?: 'mine' | 'area';
}) {
  const { currentEmpresaId } = useTenant();
  const { user } = useAuth();
  const { colaboradoresTodos } = useData();
  const canAssign = user?.perfil === 'Admin' || user?.perfil === 'Director' || user?.perfil === 'PCA';
  const cargoLower = (user?.cargo ?? '').toLowerCase();
  const isDireccaoCargo = cargoLower.includes('director') || cargoLower.includes('diretor') || cargoLower.includes('coordenador');
  const myEmpresaId = useMemo(() => {
    if (typeof currentEmpresaId === 'number') return currentEmpresaId;
    if (typeof user?.empresaId === 'number') return user.empresaId;
    if (user?.colaboradorId) return (colaboradoresTodos ?? []).find(c => c.id === user.colaboradorId)?.empresaId ?? null;
    return null;
  }, [currentEmpresaId, user?.empresaId, user?.colaboradorId, colaboradoresTodos]);
  const [areaFilter, setAreaFilter] = useState<string | 'all'>('all');
  const [colaboradorFilter, setColaboradorFilter] = useState<number | 'all'>('all');
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
  const [detailsReplyUploading, setDetailsReplyUploading] = useState(false);
  const [detailsReplyPick, setDetailsReplyPick] = useState<File | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string>('');
  const [viewerTitle, setViewerTitle] = useState<string>('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [detailsTab, setDetailsTab] = useState<'actividade' | 'comentarios'>('actividade');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [calendarCursor, setCalendarCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<ProdutividadeEvento[]>([]);
  const [comments, setComments] = useState<ProdutividadeComentario[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [kanbanUi, setKanbanUi] = useState<Record<KanbanColumnId, string[]>>({
    Pendente: [],
    'Em Progresso': [],
    'Em aprovação': [],
    Concluída: [],
  });

  const governanceEmpresaId = useMemo(() => {
    if (typeof currentEmpresaId === 'number') return currentEmpresaId;
    if (typeof user?.empresaId === 'number') return user.empresaId;
    return null;
  }, [currentEmpresaId, user?.empresaId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const mapRow = useMemo(() => {
    return (row: Record<string, unknown>) => mapRowFromDb<ProdutividadeActividade>('produtividade_actividades', row);
  }, []);

  const [optimisticActivities, setOptimisticActivities] = useState<ProdutividadeActividade[]>([]);

  const { rows: allRows, isLoading } = useRealtimeTable<ProdutividadeActividade>('produtividade_actividades', 'id', {
    mapRow,
  });

  const mergedAllRows = useMemo(() => {
    if (!optimisticActivities.length) return allRows;
    const ids = new Set<number>(allRows.map((r) => r.id));
    return [...optimisticActivities.filter((r) => !ids.has(r.id)), ...allRows];
  }, [allRows, optimisticActivities]);

  useEffect(() => {
    if (!optimisticActivities.length) return;
    const ids = new Set<number>(allRows.map((r) => r.id));
    setOptimisticActivities((prev) => prev.filter((r) => !ids.has(r.id)));
  }, [allRows, optimisticActivities.length]);

  const mapEnt = useMemo(() => {
    return (row: Record<string, unknown>) => mapRowFromDb<ProdutividadeEntregavel>('produtividade_entregaveis', row);
  }, []);
  const { rows: allEntregaveis } = useRealtimeTable<ProdutividadeEntregavel>('produtividade_entregaveis', 'id', {
    mapRow: mapEnt,
  });

  const mapPart = useMemo(() => {
    return (row: Record<string, unknown>) => mapRowFromDb<ProdutividadeParticipante>('produtividade_participantes', row);
  }, []);
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
        ? mergedAllRows
        : mergedAllRows.filter(r => Number(r.empresaId) === Number(currentEmpresaId));
    if (scope === 'mine') {
      // Em perfis sem colaboradorId (ex.: PCA grupo) mostramos vazio por defeito.
      if (!user?.colaboradorId) return [];
      return base.filter(r => {
        if (r.colaboradorId === user.colaboradorId) return true;
        const parts = participantesByActividade.get(r.id) ?? [];
        if (parts.some(p => p.colaboradorId === user.colaboradorId)) return true;
        if (r.status === 'Em aprovação' && r.aprovadorColaboradorId === user.colaboradorId) return true;
        return false;
      });
    }

    // scope === 'area'
    if (!user?.colaboradorId || !isDireccaoCargo) return [];
    const empresaId =
      typeof currentEmpresaId === 'number'
        ? currentEmpresaId
        : typeof user?.empresaId === 'number'
          ? user.empresaId
          : (colaboradoresTodos ?? []).find(c => c.id === user.colaboradorId)?.empresaId ?? null;
    if (!empresaId) return [];
    const normalize = (v: string) =>
      v
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
    const areaIds = new Set<number>(
      (colaboradoresTodos ?? [])
        .filter(c => {
          if (Number(c.empresaId) !== Number(empresaId)) return false;
          if (areaFilter === 'all') return true;
          return normalize(String(c.departamento ?? '')) === normalize(areaFilter);
        })
        .map(c => c.id),
    );
    return base.filter(r => {
      if (areaIds.has(r.colaboradorId)) return true;
      const parts = participantesByActividade.get(r.id) ?? [];
      if (parts.some(p => areaIds.has(p.colaboradorId))) return true;
      if (user.colaboradorId && r.status === 'Em aprovação' && r.aprovadorColaboradorId === user.colaboradorId)
        return true;
      return false;
    });
  }, [
    mergedAllRows,
    currentEmpresaId,
    scope,
    user?.colaboradorId,
    user?.empresaId,
    isDireccaoCargo,
    areaFilter,
    colaboradoresTodos,
    participantesByActividade,
  ]);

  const areaOptions = useMemo(() => {
    if (scope !== 'area') return [];
    const empresaId =
      typeof currentEmpresaId === 'number'
        ? currentEmpresaId
        : typeof user?.empresaId === 'number'
          ? user.empresaId
          : user?.colaboradorId
            ? (colaboradoresTodos ?? []).find(c => c.id === user.colaboradorId)?.empresaId ?? null
            : null;
    if (!empresaId) return [];
    const normalize = (v: string) =>
      v
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
    const m = new Map<string, string>();
    for (const c of colaboradoresTodos ?? []) {
      if (Number(c.empresaId) !== Number(empresaId)) continue;
      const raw = String(c.departamento ?? '').trim();
      if (!raw) continue;
      const key = normalize(raw);
      if (!m.has(key)) m.set(key, raw);
    }
    const list = [...m.entries()].map(([key, label]) => ({ key, label }));
    list.sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [scope, colaboradoresTodos, user?.empresaId, user?.colaboradorId, currentEmpresaId]);

  const direccaoColaboradores = useMemo(() => {
    if (scope !== 'area') return [];
    const empresaId =
      typeof currentEmpresaId === 'number'
        ? currentEmpresaId
        : typeof user?.empresaId === 'number'
          ? user.empresaId
          : user?.colaboradorId
            ? (colaboradoresTodos ?? []).find(c => c.id === user.colaboradorId)?.empresaId ?? null
            : null;
    if (!empresaId) return [];
    const normalize = (v: string) =>
      v
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
    const list = (colaboradoresTodos ?? []).filter((c) => {
      if (Number(c.empresaId) !== Number(empresaId)) return false;
      if (areaFilter === 'all') return true;
      return normalize(String(c.departamento ?? '')) === normalize(areaFilter);
    });
    list.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
    return list;
  }, [scope, colaboradoresTodos, user?.empresaId, user?.colaboradorId, currentEmpresaId, areaFilter]);

  useEffect(() => {
    if (scope !== 'area') return;
    if (myEmpresaId !== 1) return;
    if (!user?.colaboradorId) return;
    const me = (colaboradoresTodos ?? []).find(c => c.id === user.colaboradorId);
    const dept = String(me?.departamento ?? '').trim();
    if (!dept) return;
    // Em empresa 1, Director/Coordenador só vê a sua área: forçamos o filtro.
    setAreaFilter(dept);
  }, [scope, myEmpresaId, user?.colaboradorId, colaboradoresTodos]);

  if (scope === 'area' && user && !isDireccaoCargo) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold leading-tight">Produtividade</h1>
          <p className="text-sm text-muted-foreground">Direcção</p>
        </div>
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Esta página é apenas para cargos Director/Coordenador.
        </div>
      </div>
    );
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return myRows
      .filter(a => {
        if (scope === 'area' && colaboradorFilter !== 'all') {
          if (a.colaboradorId === colaboradorFilter) return true;
          const parts = participantesByActividade.get(a.id) ?? [];
          if (!parts.some(p => p.colaboradorId === colaboradorFilter)) return false;
        }
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
  }, [myRows, search, statusFilter, prioridadeFilter, categoriaFilter, dateFilter, scope, colaboradorFilter, participantesByActividade]);

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
    const cols: Record<KanbanColumnId, ProdutividadeActividade[]> = {
      Pendente: [],
      'Em Progresso': [],
      'Em aprovação': [],
      Concluída: [],
    };
    for (const a of filtered) {
      const col = kanbanColumnForActivity(a);
      if (col) cols[col].push(a);
    }
    for (const k of STATUS_KANBAN) cols[k] = cols[k].slice().sort((a, b) => (a.kanbanOrder ?? 0) - (b.kanbanOrder ?? 0));
    return cols;
  }, [filtered]);

  // Mantém um estado local de IDs por coluna para animação/drag "tipo Jira".
  useEffect(() => {
    setKanbanUi({
      Pendente: kanbanColumns.Pendente.map(a => dndItemId(a.id)),
      'Em Progresso': kanbanColumns['Em Progresso'].map(a => dndItemId(a.id)),
      'Em aprovação': kanbanColumns['Em aprovação'].map(a => dndItemId(a.id)),
      Concluída: kanbanColumns.Concluída.map(a => dndItemId(a.id)),
    });
  }, [kanbanColumns.Pendente, kanbanColumns['Em Progresso'], kanbanColumns['Em aprovação'], kanbanColumns.Concluída]);

  const activityById = useMemo(() => {
    const m = new Map<number, ProdutividadeActividade>();
    for (const a of myRows) m.set(a.id, a);
    return m;
  }, [myRows]);

  // Evita toasts duplicados em listeners realtime.
  const seenEventIdsRef = useRef<Set<number>>(new Set());
  const seenCommentIdsRef = useRef<Set<number>>(new Set());
  const lastStatusByActivityRef = useRef<Map<number, string>>(new Map());
  const seenApprovalActivityIdsRef = useRef<Set<number>>(new Set());
  const activityByIdRef = useRef<Map<number, ProdutividadeActividade>>(new Map());
  const colaboradorByIdRef = useRef<Map<number, { id: number; nome: string; fotoPerfilUrl?: string | null }>>(new Map());
  const eventLabelRef = useRef<(e: ProdutividadeEvento) => string>(() => '');

  const dragOverlayActivity = useMemo(() => {
    if (!activeDragId) return null;
    const id = parseDndItemId(activeDragId);
    if (!id) return null;
    return activityById.get(id) ?? null;
  }, [activeDragId, activityById]);

  const detailsActivity = useMemo(() => {
    if (!detailsId) return null;
    return activityById.get(detailsId) ?? null;
  }, [detailsId, activityById]);

  useEffect(() => {
    activityByIdRef.current = activityById;
  }, [activityById]);

  const detailsEntregaveis = useMemo(() => {
    if (!detailsActivity) return [];
    return (entregaveisByActividade.get(detailsActivity.id) ?? []).slice().sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));
  }, [detailsActivity, entregaveisByActividade]);

  const canAttachMoreDeliverables = useMemo(() => {
    if (!detailsActivity || !user?.colaboradorId) return false;
    if (!isSupabaseConfigured()) return false;
    if (currentEmpresaId === 'consolidado') return false;
    const s = detailsActivity.status;
    return s !== 'Concluída' && s !== 'Cancelada';
  }, [detailsActivity, user?.colaboradorId, currentEmpresaId]);

  const blockManualEmAprovacaoPorEntregavel = useMemo(() => {
    if (!detailsActivity || detailsActivity.status === 'Em aprovação') return false;
    return missingObrigatorioEntregavel(detailsActivity, detailsEntregaveis.length);
  }, [detailsActivity, detailsEntregaveis]);

  const blockSeleccionarConcluidaPorEntregavel = useMemo(() => {
    if (!detailsActivity || detailsActivity.status === 'Concluída') return false;
    return missingObrigatorioEntregavel(detailsActivity, detailsEntregaveis.length);
  }, [detailsActivity, detailsEntregaveis]);

  const colaboradorById = useMemo(() => {
    const m = new Map<number, { id: number; nome: string; fotoPerfilUrl?: string | null }>();
    for (const c of colaboradoresTodos ?? []) m.set(c.id, c);
    return m;
  }, [colaboradoresTodos]);

  useEffect(() => {
    colaboradorByIdRef.current = colaboradorById;
  }, [colaboradorById]);

  const creatorColaborador = useMemo(() => {
    if (!detailsActivity) return null;
    return colaboradorById.get(detailsActivity.colaboradorId) ?? null;
  }, [detailsActivity, colaboradorById]);

  const detailsParticipants = useMemo(() => {
    if (!detailsActivity) return [];
    const parts = participantesByActividade.get(detailsActivity.id) ?? [];
    const ids = new Set<number>([detailsActivity.colaboradorId, ...parts.map(p => p.colaboradorId)]);
    const out = [...ids]
      .map((id) => colaboradorById.get(id))
      .filter(Boolean) as Array<{ id: number; nome: string; fotoPerfilUrl?: string | null }>;
    out.sort((a, b) => a.nome.localeCompare(b.nome));
    return out;
  }, [detailsActivity, participantesByActividade, colaboradorById]);

  const initialsForName = useCallback((nome: string): string => {
    const parts = nome.trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? '';
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return (a + b).toUpperCase() || '?';
  }, []);

  const shortName = useCallback((nome: string): string => {
    const parts = nome.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '—';
    if (parts.length === 1) return parts[0]!;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }, []);

  const downloadEntregavelFicheiro = useCallback(
    (row: { storagePath: string; nomeFicheiro: string; actividadeId?: number; entregavelId?: number | null }) => {
      if (!isSupabaseConfigured() || !supabase) {
        toast.error('Serviço de ficheiros indisponível.');
        return;
      }
      const { data } = supabase.storage.from('produtividade-entregaveis').getPublicUrl(row.storagePath);
      const url = data?.publicUrl;
      if (!url) {
        toast.error('Não foi possível obter o link de descarga.');
        return;
      }

      // Regista no feed (sem bloquear o download).
      if (row.actividadeId && user?.colaboradorId) {
        (supabase.from('produtividade_eventos') as any)
          .insert({
            actividade_id: row.actividadeId,
            tipo: 'deliverable_downloaded',
            actor_profile_id: null,
            actor_colaborador_id: user.colaboradorId,
            payload: {
              nome: row.nomeFicheiro,
              entregavel_id: row.entregavelId ?? null,
              storage_path: row.storagePath,
            },
          })
          .then(({ error }: { error?: { message?: string } | null }) => {
            if (error) console.warn('deliverable_downloaded event failed', error?.message ?? error);
          })
          .catch((e: unknown) => {
            console.warn('deliverable_downloaded event failed', e);
          });
      }

      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [user?.colaboradorId],
  );

  const logDeliverableDownloaded = useCallback(
    (row: { storagePath: string; nomeFicheiro: string; actividadeId?: number; entregavelId?: number | null }) => {
      if (!row.actividadeId || !user?.colaboradorId) return;
      if (!isSupabaseConfigured() || !supabase) return;
      (supabase.from('produtividade_eventos') as any)
        .insert({
          actividade_id: row.actividadeId,
          tipo: 'deliverable_downloaded',
          actor_profile_id: null,
          actor_colaborador_id: user.colaboradorId,
          payload: {
            nome: row.nomeFicheiro,
            entregavel_id: row.entregavelId ?? null,
            storage_path: row.storagePath,
          },
        })
        .then(({ error }: { error?: { message?: string } | null }) => {
          if (error) console.warn('deliverable_downloaded event failed', error?.message ?? error);
        })
        .catch((e: unknown) => {
          console.warn('deliverable_downloaded event failed', e);
        });
    },
    [user?.colaboradorId],
  );

  const logDeliverableViewed = useCallback(
    (row: { storagePath: string; nomeFicheiro: string; actividadeId?: number; entregavelId?: number | null }) => {
      if (!row.actividadeId || !user?.colaboradorId) return;
      if (!isSupabaseConfigured() || !supabase) return;
      (supabase.from('produtividade_eventos') as any)
        .insert({
          actividade_id: row.actividadeId,
          tipo: 'deliverable_viewed',
          actor_profile_id: null,
          actor_colaborador_id: user.colaboradorId,
          payload: {
            nome: row.nomeFicheiro,
            entregavel_id: row.entregavelId ?? null,
            storage_path: row.storagePath,
          },
        })
        .then(({ error }: { error?: { message?: string } | null }) => {
          if (error) console.warn('deliverable_viewed event failed', error?.message ?? error);
        })
        .catch((e: unknown) => {
          console.warn('deliverable_viewed event failed', e);
        });
    },
    [user?.colaboradorId],
  );

  const openOfficeViewerForEntregavel = useCallback(
    (row: {
      storagePath: string;
      nomeFicheiro: string;
      mimeType?: string | null;
      actividadeId?: number;
      entregavelId?: number | null;
    }) => {
      if (!isOfficePreviewableEntregavel(row)) {
        toast.error('Este ficheiro não suporta pré-visualização.');
        return;
      }
      if (!isSupabaseConfigured() || !supabase) {
        toast.error('Serviço de ficheiros indisponível.');
        return;
      }
      const { data } = supabase.storage.from('produtividade-entregaveis').getPublicUrl(row.storagePath);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) {
        toast.error('Não foi possível obter o link de visualização.');
        return;
      }
      logDeliverableViewed(row);
      setViewerTitle(row.nomeFicheiro || 'Documento');
      setViewerUrl(officeViewerUrlFromPublicUrl(publicUrl));
      setViewerOpen(true);
    },
    [logDeliverableViewed],
  );

  const openPdfViewerForEntregavel = useCallback(
    (row: {
      storagePath: string;
      nomeFicheiro: string;
      mimeType?: string | null;
      actividadeId?: number;
      entregavelId?: number | null;
    }) => {
      if (!isPdfPreviewableEntregavel(row)) {
        toast.error('Este ficheiro não suporta pré-visualização.');
        return;
      }
      if (!isSupabaseConfigured() || !supabase) {
        toast.error('Serviço de ficheiros indisponível.');
        return;
      }
      const { data } = supabase.storage.from('produtividade-entregaveis').getPublicUrl(row.storagePath);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) {
        toast.error('Não foi possível obter o link de visualização.');
        return;
      }
      logDeliverableViewed(row);
      setViewerTitle(row.nomeFicheiro || 'PDF');
      setViewerUrl(publicUrl);
      setViewerOpen(true);
    },
    [logDeliverableViewed],
  );

  useEffect(() => {
    setDetailsReplyPick(null);
  }, [detailsId]);

  useEffect(() => {
    if (!detailsOpen) setDetailsReplyPick(null);
  }, [detailsOpen]);

  const eventLabel = useCallback((e: ProdutividadeEvento): string => {
    const p = e.payload ?? {};
    if (e.tipo === 'created') return 'Criou a actividade';
    if (e.tipo === 'status_changed') return `Mudou o status: ${p.from ?? '—'} → ${p.to ?? '—'}`;
    if (e.tipo === 'priority_changed') return `Mudou a prioridade: ${p.from ?? '—'} → ${p.to ?? '—'}`;
    if (e.tipo === 'deadline_changed') return `Mudou o prazo: ${p.from ?? '—'} → ${p.to ?? '—'}`;
    if (e.tipo === 'deliverable_uploaded') return 'anexou um ficheiro';
    if (e.tipo === 'deliverable_downloaded') return `descarregou o ficheiro ${p.nome ? `«${p.nome}»` : ''}`.trim();
    if (e.tipo === 'deliverable_viewed') return `visualizou o ficheiro ${p.nome ? `«${p.nome}»` : ''}`.trim();
    if (e.tipo === 'comment_added') return 'Adicionou um comentário';
    return e.tipo;
  }, []);

  useEffect(() => {
    eventLabelRef.current = eventLabel;
  }, [eventLabel]);

  // Notificações em tempo-real para todos que têm acesso (via RLS) enquanto estiverem online neste módulo.
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;
    if (!user?.colaboradorId) return;

    const channel = supabase
      .channel(`produtividade-notifs:${user.colaboradorId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'produtividade_eventos' }, (payload) => {
        try {
          const row = payload.new as any;
          const mapped = mapRowFromDb<ProdutividadeEvento>('produtividade_eventos', row);
          if (seenEventIdsRef.current.has(mapped.id)) return;
          seenEventIdsRef.current.add(mapped.id);

          const act = activityByIdRef.current.get(mapped.actividadeId);
          const actorName = mapped.actorColaboradorId
            ? (colaboradorByIdRef.current.get(mapped.actorColaboradorId)?.nome ?? 'Alguém')
            : 'Alguém';
          const title = act?.titulo ? `«${act.titulo}»` : `#${mapped.actividadeId}`;

          toast(`${actorName} ${eventLabelRef.current(mapped)}`, {
            description: `Actividade ${title}`,
          });
        } catch (e) {
          console.warn('produtividade event toast failed', e);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'produtividade_comentarios' }, (payload) => {
        try {
          const row = payload.new as any;
          const mapped = mapRowFromDb<ProdutividadeComentario>('produtividade_comentarios', row);
          if (seenCommentIdsRef.current.has(mapped.id)) return;
          seenCommentIdsRef.current.add(mapped.id);

          const act = activityByIdRef.current.get(mapped.actividadeId);
          const actorName = colaboradorByIdRef.current.get(mapped.autorColaboradorId)?.nome ?? 'Alguém';
          const title = act?.titulo ? `«${act.titulo}»` : `#${mapped.actividadeId}`;
          const snippet = (mapped.conteudo ?? '').trim().slice(0, 120);

          toast(`${actorName} comentou`, {
            description: snippet ? `${snippet} — em ${title}` : `Em ${title}`,
          });
        } catch (e) {
          console.warn('produtividade comment toast failed', e);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.info('[produtividade] realtime subscribed');
        if (status === 'CHANNEL_ERROR') console.warn('[produtividade] realtime channel error');
        if (status === 'TIMED_OUT') console.warn('[produtividade] realtime channel timed out');
      });

    return () => {
      try {
        void supabase.removeChannel(channel);
      } catch {}
    };
  }, [user?.colaboradorId]);

  // Notificação para aprovador quando uma actividade muda para «Em aprovação».
  useEffect(() => {
    if (!user?.colaboradorId) return;
    const me = user.colaboradorId;

    // Inicializa mapa (sem toasts)
    if (lastStatusByActivityRef.current.size === 0) {
      for (const a of myRows) lastStatusByActivityRef.current.set(a.id, a.status);
      // Regista o "baseline" de actividades já em aprovação para não tostar o histórico ao abrir a página.
      for (const a of myRows) {
        if (a.status === 'Em aprovação' && a.aprovadorColaboradorId === me) {
          seenApprovalActivityIdsRef.current.add(a.id);
        }
      }
      return;
    }

    for (const a of myRows) {
      const prev = lastStatusByActivityRef.current.get(a.id);
      const isNowApprovalForMe = a.status === 'Em aprovação' && a.aprovadorColaboradorId === me;

      // Caso 1: transição de estado para «Em aprovação».
      if (prev && prev !== a.status && isNowApprovalForMe) {
        if (!seenApprovalActivityIdsRef.current.has(a.id)) {
          toast('Nova actividade para aprovar', { description: `«${a.titulo}»` });
          seenApprovalActivityIdsRef.current.add(a.id);
        }
      }

      // Caso 2: actividade nova entrou na lista já em «Em aprovação» (ex.: criada por outro utilizador).
      if (!prev && isNowApprovalForMe) {
        if (!seenApprovalActivityIdsRef.current.has(a.id)) {
          toast('Nova actividade para aprovar', { description: `«${a.titulo}»` });
          seenApprovalActivityIdsRef.current.add(a.id);
        }
      }

      lastStatusByActivityRef.current.set(a.id, a.status);
    }
  }, [myRows, user?.colaboradorId]);

  useEffect(() => {
    if (!detailsOpen || !detailsId || !isSupabaseConfigured() || !supabase) return;
    let cancelled = false;
    setDetailsLoading(true);
    setEvents([]);
    setComments([]);

    const load = async () => {
      try {
        const [{ data: ev, error: evErr }, { data: cm, error: cmErr }] = await Promise.all([
          supabase
            .from('produtividade_eventos')
            .select('*')
            .eq('actividade_id', detailsId)
            .order('created_at', { ascending: false })
            .limit(200),
          supabase
            .from('produtividade_comentarios')
            .select('*')
            .eq('actividade_id', detailsId)
            .order('created_at', { ascending: false })
            .limit(200),
        ]);
        if (cancelled) return;
        if (evErr) throw new Error(evErr.message);
        if (cmErr) throw new Error(cmErr.message);
        setEvents((ev ?? []).map(r => mapRowFromDb<ProdutividadeEvento>('produtividade_eventos', r as any)));
        setComments((cm ?? []).map(r => mapRowFromDb<ProdutividadeComentario>('produtividade_comentarios', r as any)));
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Erro ao carregar detalhes.');
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    };

    void load();

    const channel = supabase
      .channel(`produtividade-details:${detailsId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'produtividade_eventos', filter: `actividade_id=eq.${detailsId}` },
        (payload) => {
          const row = payload.new as any;
          const mapped = mapRowFromDb<ProdutividadeEvento>('produtividade_eventos', row);
          setEvents(prev => [mapped, ...prev].slice(0, 300));
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'produtividade_comentarios', filter: `actividade_id=eq.${detailsId}` },
        (payload) => {
          const row = payload.new as any;
          const mapped = mapRowFromDb<ProdutividadeComentario>('produtividade_comentarios', row);
          setComments(prev => [mapped, ...prev].slice(0, 300));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      try {
        void supabase.removeChannel(channel);
      } catch {}
    };
  }, [detailsOpen, detailsId]);

  async function postComment() {
    if (!detailsId || !user?.colaboradorId) return;
    const text = newComment.trim();
    if (!text) return;
    if (!isSupabaseConfigured() || !supabase) return;
    setPostingComment(true);
    try {
      const { error } = await (supabase.from('produtividade_comentarios') as any).insert({
        actividade_id: detailsId,
        autor_colaborador_id: user.colaboradorId,
        conteudo: text,
      });
      if (error) throw new Error(error.message || 'Erro ao comentar');
      setNewComment('');
      toast.success('Comentário enviado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao comentar');
    } finally {
      setPostingComment(false);
    }
  }

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

  const isoFromDate = useCallback((dt: Date): string => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const startOfWeekMonday = useCallback((dt: Date): Date => {
    const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const dow = (d.getDay() + 6) % 7; // segunda=0
    d.setDate(d.getDate() - dow);
    return d;
  }, []);

  const addDays = useCallback((dt: Date, days: number): Date => {
    const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    d.setDate(d.getDate() + days);
    return d;
  }, []);

  const todayIso = useMemo(() => isoFromDate(new Date()), [isoFromDate]);

  const weekStart = useMemo(() => startOfWeekMonday(selectedDay ?? new Date()), [selectedDay, startOfWeekMonday]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart, addDays]);
  const weekLabel = useMemo(() => {
    const a = weekDays[0];
    const b = weekDays[6];
    const fmt = (d: Date) => d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
    return `${fmt(a)} – ${fmt(b)}`;
  }, [weekDays]);

  const monthLabel = useMemo(() => {
    const y = calendarCursor.getFullYear();
    const m = calendarCursor.toLocaleString('pt-PT', { month: 'long' });
    return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${y}`;
  }, [calendarCursor]);

  const monthCells = useMemo(() => {
    const start = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const end = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0);
    const startDow = (start.getDay() + 6) % 7; // segunda=0
    const totalDays = end.getDate();

    const cells: Array<{ date: Date; iso: string; inMonth: boolean }> = [];
    // leading days
    for (let i = 0; i < startDow; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() - (startDow - i));
      cells.push({ date: d, iso: isoFromDate(d), inMonth: false });
    }
    // month days
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), day);
      cells.push({ date: d, iso: isoFromDate(d), inMonth: true });
    }
    // trailing to complete weeks
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1]!.date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, iso: isoFromDate(d), inMonth: false });
    }
    return cells;
  }, [calendarCursor, isoFromDate]);

  const activitiesByIso = useMemo(() => {
    const m = new Map<string, ProdutividadeActividade[]>();
    for (const a of filtered) {
      const k = a.dataActividade;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    for (const [k, v] of m) {
      m.set(
        k,
        v
          .slice()
          .sort((a, b) => {
            const pr = (p: string) => (p === 'Urgente' ? 4 : p === 'Alta' ? 3 : p === 'Média' ? 2 : 1);
            const byPr = pr(b.prioridade) - pr(a.prioridade);
            if (byPr !== 0) return byPr;
            return (a.kanbanOrder ?? 0) - (b.kanbanOrder ?? 0);
          })
          .slice(0, 50),
      );
    }
    return m;
  }, [filtered]);

  async function createActivity(form: {
    tipoActividade: string;
    localizacao: string | null;
    meioOnline: string | null;
    atribuidoColaboradorIds: number[];
    colegasColaboradorIds: number[];
    titulo: string;
    descricao: string;
    comentario: string;
    dataActividade: string;
    prazo: string;
    prioridade: string;
    categoria: string;
    possuiEntregavel: boolean;
    requerAprovacao: boolean;
    aprovadorColaboradorId: number | null;
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
        requer_aprovacao: form.requerAprovacao,
        aprovador_colaborador_id: form.requerAprovacao ? form.aprovadorColaboradorId : null,
        status: 'Pendente',
        kanban_order: 0,
      };
      const { data, error } = await supabase.from('produtividade_actividades').insert(payload).select('*').maybeSingle();
      if (error) throw new Error(error.message || 'Erro ao criar actividade');
      const actId = (data as any)?.id ? Number((data as any).id) : null;
      if (data) {
        const mapped = mapRowFromDb<ProdutividadeActividade>('produtividade_actividades', data as any);
        setOptimisticActivities((prev) => (prev.some((r) => r.id === mapped.id) ? prev : [mapped, ...prev]));
      }
      if (actId && Array.isArray(form.atribuidoColaboradorIds) && form.atribuidoColaboradorIds.length > 0) {
        const unique = [...new Set(form.atribuidoColaboradorIds)].filter((id) => Number.isFinite(id) && id !== user.colaboradorId);
        if (unique.length > 0) {
          const rows = unique.map((id) => ({ actividade_id: actId, colaborador_id: id, role: 'assignee' }));
          const { error: pErr } = await (supabase.from('produtividade_participantes') as any).insert(rows);
          if (pErr) throw new Error(pErr.message || 'Erro ao atribuir colaboradores');
        }
      }

      if (actId && Array.isArray(form.colegasColaboradorIds) && form.colegasColaboradorIds.length > 0) {
        const unique = [...new Set(form.colegasColaboradorIds)].filter((id) => Number.isFinite(id) && id !== user.colaboradorId);
        if (unique.length > 0) {
          const rows = unique.map((id) => ({ actividade_id: actId, colaborador_id: id, role: 'collaborator' }));
          const { error: cErr } = await (supabase.from('produtividade_participantes') as any).insert(rows);
          if (cErr) throw new Error(cErr.message || 'Erro ao adicionar colegas');
        }
      }
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

  async function setStatus(
    id: number,
    next: ProdutividadeStatus,
    opts?: { assumeEntregavelJustUploaded?: boolean },
  ): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    const current = activityById.get(id);
    if (next === 'Concluída' && mustCompleteViaApprovalFlow(current)) {
      toast.error(
        'Esta actividade exige aprovação: não pode passar directamente a «Concluída». Use «Concluir» ou arraste para a coluna «Concluída» no Kanban para submeter à aprovação.',
      );
      return false;
    }
    const entCount = entregaveisByActividade.get(id)?.length ?? 0;
    if (!opts?.assumeEntregavelJustUploaded) {
      if (next === 'Em aprovação' && missingObrigatorioEntregavel(current, entCount)) {
        toast.error(
          'Entregável obrigatório: anexe um ficheiro antes de submeter a actividade para aprovação (use «Concluir» ou envie primeiro no painel de detalhes).',
        );
        return false;
      }
      if (next === 'Concluída' && missingObrigatorioEntregavel(current, entCount)) {
        toast.error('Entregável obrigatório: anexe um ficheiro antes de concluir a actividade.');
        return false;
      }
    }
    const { error } = await (supabase.from('produtividade_actividades') as any).update({ status: next }).eq('id', id);
    if (error) {
      toast.error(error.message ?? 'Erro ao actualizar o estado.');
      return false;
    }
    return true;
  }

  function requestComplete(a: ProdutividadeActividade) {
    const next = pendingApprovalCompletionStatus(a);
    const entCount = entregaveisByActividade.get(a.id)?.length ?? 0;
    if (missingObrigatorioEntregavel(a, entCount)) {
      setCompleteTargetId(a.id);
      setUploadFile(null);
      setCompleteDialogOpen(true);
      return;
    }
    void setStatus(a.id, next);
  }

  function openDetails(id: number) {
    setDetailsId(id);
    setDetailsOpen(true);
    setDetailsTab('actividade');
  }

  async function uploadDeliverableAndComplete(fileFromPicker?: File | null) {
    if (!completeTarget) return;
    const file = fileFromPicker ?? uploadFile;
    if (!file) return;
    if (!isSupabaseConfigured() || !supabase) return;
    if (!user?.colaboradorId) return;
    if (currentEmpresaId === 'consolidado') return;

    if (!isAllowedDeliverableFile(file)) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const safeName = file.name.replace(/[^\w.\-() ]+/g, '_').slice(0, 90);
      const path = `empresa-${currentEmpresaId}/colab-${user.colaboradorId}/act-${completeTarget.id}/${Date.now()}-${safeName}`;

      const { data, error } = await supabase.storage
        .from('produtividade-entregaveis')
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error || !data?.path) throw new Error(error?.message || 'Falha ao carregar entregável');

      await (supabase.from('produtividade_entregaveis') as any).insert({
        actividade_id: completeTarget.id,
        storage_path: data.path,
        nome_ficheiro: file.name,
        mime_type: file.type || `application/${ext}`,
        tamanho_bytes: file.size,
        estado: 'Pendente',
        uploaded_by_colaborador_id: user.colaboradorId,
      });

      const nextStatus = pendingApprovalCompletionStatus(completeTarget);
      const statusOk = await setStatus(completeTarget.id, nextStatus, { assumeEntregavelJustUploaded: true });
      if (statusOk) {
        setCompleteDialogOpen(false);
        setCompleteTargetId(null);
        setUploadFile(null);
        toast.success(
          nextStatus === 'Em aprovação'
            ? 'Entregável enviado. Actividade em aprovação.'
            : 'Entregável enviado. Actividade concluída.',
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar o entregável.');
    } finally {
      setUploading(false);
    }
  }

  async function uploadDetailsDeliverableAttachment(fileFromPicker?: File | null) {
    const act = detailsActivity;
    const file = fileFromPicker ?? detailsReplyPick;
    if (!act || !file || !user?.colaboradorId) return;
    if (!isSupabaseConfigured() || !supabase) return;
    if (currentEmpresaId === 'consolidado') {
      toast.error('Seleccione uma empresa específica (não «consolidado») para anexar ficheiros.');
      return;
    }
    if (!isAllowedDeliverableFile(file)) return;

    const ext = file.name.split('.').pop() || 'bin';
    const safeName = file.name.replace(/[^\w.\-() ]+/g, '_').slice(0, 90);
    const path = `empresa-${currentEmpresaId}/colab-${user.colaboradorId}/act-${act.id}/${Date.now()}-${safeName}`;

    setDetailsReplyUploading(true);
    try {
      const { data, error } = await supabase.storage
        .from('produtividade-entregaveis')
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error || !data?.path) throw new Error(error?.message || 'Falha ao carregar ficheiro');

      const { error: dbErr } = await (supabase.from('produtividade_entregaveis') as any).insert({
        actividade_id: act.id,
        storage_path: data.path,
        nome_ficheiro: file.name,
        mime_type: file.type || `application/${ext}`,
        tamanho_bytes: file.size,
        estado: 'Pendente',
        uploaded_by_colaborador_id: user.colaboradorId,
      });
      if (dbErr) throw new Error(dbErr.message || 'Erro ao registar entregável');

      toast.success('Anexo adicionado.');
      setDetailsReplyPick(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao anexar');
    } finally {
      setDetailsReplyUploading(false);
    }
  }

  function findContainerForItemId(itemId: string, state: Record<KanbanColumnId, string[]>): KanbanColumnId | null {
    for (const col of STATUS_KANBAN) {
      if (state[col].includes(itemId)) return col;
    }
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    void updateKanban(e);
    setActiveDragId(null);
  }

  async function updateKanban(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) return;

    // ids:
    // - act:<id> (items)
    // - col:<Status> (containers)
    if (!activeId.startsWith(DND_ITEM_PREFIX)) return;
    const activeActId = parseDndItemId(activeId);
    if (!activeActId) return;

    const active = activityById.get(activeActId);
    if (!active) return;
    if (active.status === 'Concluída') {
      toast.error('Actividade «Concluída» não pode ser movida.');
      return;
    }

    const fromCol = findContainerForItemId(activeId, kanbanUi);
    if (!fromCol) return;

    // target col
    let toCol: KanbanColumnId | null = null;
    let overItemId: string | null = null;
    if (isColumnId(overId)) {
      toCol = overId.slice(DND_COL_PREFIX.length) as KanbanColumnId;
    } else if (overId.startsWith(DND_ITEM_PREFIX)) {
      overItemId = overId;
      toCol = findContainerForItemId(overId, kanbanUi);
    }
    if (!toCol) return;

    if (fromCol !== toCol) {
      if (toCol === 'Em aprovação' && fromCol !== 'Em aprovação') {
        // Permite arrastar directamente para «Em aprovação» (respeita regras/validações em setStatus + triggers SQL).
        void setStatus(active.id, 'Em aprovação');
        return;
      }
      if (toCol === 'Concluída') {
        // Se está «Em aprovação», arrastar para «Concluída» significa APROVAR (apenas aprovador/gestão).
        if (fromCol === 'Em aprovação' || active.status === 'Em aprovação') {
          const ok = canManageApprovalTransition(
            active,
            user?.colaboradorId ?? null,
            user?.perfil ?? null,
            governanceEmpresaId,
          );
          if (!ok) {
            toast.error('Só o aprovador designado (ou gestão) pode aprovar e concluir a actividade.');
            return;
          }
          void setStatus(active.id, 'Concluída');
          return;
        }

        // Caso normal: concluir (pode abrir diálogo de entregável obrigatório)
        requestComplete(active);
        return;
      }
      if (fromCol === 'Em aprovação') {
        const ok = canManageApprovalTransition(
          active,
          user?.colaboradorId ?? null,
          user?.perfil ?? null,
          governanceEmpresaId,
        );
        if (!ok) {
          toast.error('Só o aprovador designado (ou gestão) pode mover a actividade desde «Em aprovação».');
          return;
        }
      }
    }

    const nextUi = { ...kanbanUi, [fromCol]: [...kanbanUi[fromCol]], [toCol]: fromCol === toCol ? [...kanbanUi[toCol]] : [...kanbanUi[toCol]] };
    // remover do from
    nextUi[fromCol] = nextUi[fromCol].filter(x => x !== activeId);
    // inserir no to
    const toIndex =
      overItemId && nextUi[toCol].includes(overItemId) ? nextUi[toCol].indexOf(overItemId) : nextUi[toCol].length;
    nextUi[toCol].splice(Math.max(0, toIndex), 0, activeId);
    // se moveu entre colunas, garantir que não duplicou
    if (fromCol !== toCol) nextUi[fromCol] = nextUi[fromCol].filter(x => x !== activeId);
    setKanbanUi(nextUi);

    // Persistência
    if (!isSupabaseConfigured() || !supabase) return;

    if (fromCol !== toCol) {
      await setStatus(active.id, toCol);
    }

    // Regravar ordens (em ambas colunas se mudou, senão apenas na coluna)
    const colsToPersist: KanbanColumnId[] = fromCol === toCol ? [toCol] : [fromCol, toCol];
    await Promise.all(
      colsToPersist.flatMap((col) =>
        nextUi[col].slice(0, 120).map((dndId, idx) => {
          const id = parseDndItemId(dndId);
          if (!id) return Promise.resolve();
          return (supabase.from('produtividade_actividades') as any).update({ kanban_order: idx }).eq('id', id);
        }),
      ),
    );
  }

  return (
    <div className="space-y-5">
      {/* styles removidos (calendário custom) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight">Produtividade</h1>
          <p className="text-sm text-muted-foreground">{scope === 'area' ? 'Direcção' : 'Minhas Actividades'}</p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nova actividade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl p-0 overflow-hidden">
              <div className="max-h-[85dvh] overflow-hidden">
                <div className="px-6 pt-6 pb-3 border-b bg-background sticky top-0 z-10">
                  <DialogHeader>
                    <DialogTitle>Criar actividade</DialogTitle>
                  </DialogHeader>
                </div>
                <div className="px-6 pb-6 overflow-y-auto max-h-[calc(85dvh-72px)]">
                  <CreateActivityForm
                    onCreate={createActivity}
                    creating={creating}
                    defaultDataActividade={prefillDate}
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
                    empresaIdForSearch={
                      currentEmpresaId === 'consolidado'
                        ? typeof user?.empresaId === 'number'
                          ? user.empresaId
                          : null
                        : currentEmpresaId
                    }
                    canAssign={canAssign}
                  />
                </div>
              </div>
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
          {scope === 'area' ? (
            <>
              <Select value={String(areaFilter)} onValueChange={(v: any) => setAreaFilter(v)} disabled={myEmpresaId === 1}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Área (módulo)" />
                </SelectTrigger>
                <SelectContent>
                  {myEmpresaId !== 1 ? <SelectItem value="all">Todas as áreas</SelectItem> : null}
                  {areaOptions.map((o) => (
                    <SelectItem key={o.key} value={o.label}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

            <Select
              value={String(colaboradorFilter)}
              onValueChange={(v) => setColaboradorFilter(v === 'all' ? 'all' : Number(v))}
            >
              <SelectTrigger className="w-full md:w-[240px]">
                <SelectValue placeholder="Colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {direccaoColaboradores.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome ? shortName(String(c.nome)) : `#${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </>
          ) : null}

          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Em Progresso">Em Progresso</SelectItem>
              <SelectItem value="Em aprovação">Em aprovação</SelectItem>
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
                        <button
                          type="button"
                          className="font-medium truncate text-left hover:underline"
                          onClick={() => openDetails(a.id)}
                        >
                          {a.titulo}
                        </button>
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
                      <div className="shrink-0 flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                        {canManageApprovalTransition(
                          a,
                          user?.colaboradorId ?? null,
                          user?.perfil ?? null,
                          governanceEmpresaId,
                        ) &&
                        a.status === 'Em aprovação' ? (
                          <div className="flex gap-2">
                            <Button size="sm" variant="default" onClick={() => void setStatus(a.id, 'Concluída')}>
                              Aprovar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void setStatus(a.id, 'Em Progresso')}>
                              Recusar
                            </Button>
                          </div>
                        ) : null}
                        {s !== 'Concluída' && s !== 'Cancelada' && a.status !== 'Em aprovação' ? (
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
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="grid gap-3 md:grid-cols-4">
              {STATUS_KANBAN.map(col => (
                <KanbanColumn key={col} columnId={`col:${col}`} title={col} count={kanbanColumns[col].length}>
                  <SortableContext items={kanbanUi[col]} strategy={rectSortingStrategy}>
                    {kanbanUi[col].map((dndId) => {
                      const id = parseDndItemId(dndId);
                      const a = id ? activityById.get(id) : null;
                      if (!a) return null;
                      const blockDragFromApproval =
                        a.status === 'Em aprovação' &&
                        !canManageApprovalTransition(
                          a,
                          user?.colaboradorId ?? null,
                          user?.perfil ?? null,
                          governanceEmpresaId,
                        );
                      return (
                        <div key={dndId} onClickCapture={() => openDetails(a.id)}>
                          <SortableCard id={dndId} a={a} disabled={blockDragFromApproval} />
                        </div>
                      );
                    })}
                  </SortableContext>
                  {kanbanUi[col].length === 0 ? (
                    <div className="text-xs text-muted-foreground py-10 text-center">Arraste aqui</div>
                  ) : null}
                </KanbanColumn>
              ))}
            </div>

            <DragOverlay
              dropAnimation={{
                duration: 220,
                easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
                sideEffects: defaultDropAnimationSideEffects({
                  styles: { active: { opacity: '0.4' } },
                }),
              }}
            >
              {dragOverlayActivity ? (
                <div className="w-[320px] md:w-[360px]">
                  <TaskCard a={dragOverlayActivity} dragging />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        <TabsContent value="calendario" className="mt-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-3 border-b flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant={calendarView === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCalendarView('month')}
                >
                  Mês
                </Button>
                <Button
                  variant={calendarView === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCalendarView('week')}
                >
                  Semana
                </Button>
                <Button
                  variant={calendarView === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCalendarView('day')}
                >
                  Dia
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (calendarView === 'month') {
                      setCalendarCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
                      return;
                    }
                    if (calendarView === 'week') {
                      setSelectedDay((d) => addDays(d ?? new Date(), -7));
                      return;
                    }
                    setSelectedDay((d) => addDays(d ?? new Date(), -1));
                  }}
                >
                  ‹
                </Button>
                <div className="text-sm font-semibold min-w-[160px] text-center">
                  {calendarView === 'month' ? monthLabel : calendarView === 'week' ? weekLabel : (dayKey || 'Dia')}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (calendarView === 'month') {
                      setCalendarCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
                      return;
                    }
                    if (calendarView === 'week') {
                      setSelectedDay((d) => addDays(d ?? new Date(), 7));
                      return;
                    }
                    setSelectedDay((d) => addDays(d ?? new Date(), 1));
                  }}
                >
                  ›
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    if (calendarView === 'month') setCalendarCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                    setSelectedDay(now);
                  }}
                >
                  Hoje
                </Button>
              </div>
            </div>

            {calendarView === 'month' ? (
              <div className="p-3">
                <div className="grid grid-cols-7 text-xs text-muted-foreground border rounded-lg overflow-hidden">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                    <div key={d} className="px-2 py-2 border-b bg-muted/20 font-medium">
                      {d}
                    </div>
                  ))}

                  {monthCells.map((cell) => {
                    const rows = activitiesByIso.get(cell.iso) ?? [];
                    const visible = rows.slice(0, 3);
                    const more = rows.length - visible.length;
                    const isToday = cell.iso === isoFromDate(new Date());
                    const isPast = cell.iso < isoFromDate(new Date());
                    return (
                      <div
                        key={cell.iso}
                        className={cn(
                          'min-h-[110px] border-b border-r p-2 group',
                          !cell.inMonth && 'bg-muted/10 text-muted-foreground',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className={cn('text-xs font-medium', isToday && 'text-primary')}>
                            {cell.date.getDate()}
                          </div>
                          {!isPast ? (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition"
                              onClick={() => {
                                setPrefillDate(cell.iso);
                                setCreateDialogOpen(true);
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>

                        <div className="mt-2 space-y-1">
                          {visible.map((a) => {
                            const s = effectiveStatus(a);
                            const pr =
                              a.prioridade === 'Urgente'
                                ? 'bg-red-500/15 text-red-800'
                                : a.prioridade === 'Alta'
                                  ? 'bg-amber-500/15 text-amber-800'
                                  : a.prioridade === 'Média'
                                    ? 'bg-blue-500/15 text-blue-800'
                                    : 'bg-emerald-500/15 text-emerald-800';
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => openDetails(a.id)}
                                className={cn(
                                  'w-full text-left rounded-md px-2 py-1 text-xs truncate border hover:bg-muted/30 transition',
                                  pr,
                                  s === 'Concluída' && 'opacity-70 line-through',
                                  s === 'Atrasada' && 'ring-1 ring-red-500/30',
                                )}
                                title={a.titulo}
                              >
                                {a.titulo}
                              </button>
                            );
                          })}
                          {more > 0 ? (
                            <div className="text-[11px] text-muted-foreground px-1">+{more} others</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : calendarView === 'day' ? (
              <div className="p-3">
                <div className="text-sm font-semibold mb-2">{dayKey || 'Dia'}</div>
                <div className="rounded-lg border divide-y">
                  {calendarRows.map((a) => {
                    const s = effectiveStatus(a);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => openDetails(a.id)}
                        className="w-full text-left p-3 hover:bg-muted/30 transition"
                      >
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
                      </button>
                    );
                  })}
                  {calendarRows.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground">Sem actividades neste dia.</div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="p-3">
                <div className="grid grid-cols-7 border rounded-lg overflow-hidden">
                  {weekDays.map((d, idx) => {
                    const iso = isoFromDate(d);
                    const rows = activitiesByIso.get(iso) ?? [];
                    const visible = rows.slice(0, 6);
                    const more = rows.length - visible.length;
                    const isToday = iso === todayIso;
                    const isPast = iso < todayIso;
                    const dayName = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][idx]!;
                    return (
                      <div key={iso} className="min-h-[180px] border-r border-b p-2 group">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDay(d);
                              setCalendarView('day');
                            }}
                            className={cn(
                              'text-left min-w-0',
                              isToday && 'text-primary',
                            )}
                            title="Abrir dia"
                          >
                            <div className="text-xs font-medium">{dayName}</div>
                            <div className="text-[11px] text-muted-foreground">{iso}</div>
                          </button>

                          {!isPast ? (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition"
                              onClick={() => {
                                setPrefillDate(iso);
                                setCreateDialogOpen(true);
                              }}
                              title="Nova actividade"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>

                        <div className="mt-2 space-y-1">
                          {visible.map((a) => {
                            const s = effectiveStatus(a);
                            const pr =
                              a.prioridade === 'Urgente'
                                ? 'bg-red-500/15 text-red-800'
                                : a.prioridade === 'Alta'
                                  ? 'bg-amber-500/15 text-amber-800'
                                  : a.prioridade === 'Média'
                                    ? 'bg-blue-500/15 text-blue-800'
                                    : 'bg-emerald-500/15 text-emerald-800';
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => openDetails(a.id)}
                                className={cn(
                                  'w-full text-left rounded-md px-2 py-1 text-xs truncate border hover:bg-muted/30 transition',
                                  pr,
                                  s === 'Concluída' && 'opacity-70 line-through',
                                  s === 'Atrasada' && 'ring-1 ring-red-500/30',
                                )}
                                title={a.titulo}
                              >
                                {a.titulo}
                              </button>
                            );
                          })}
                          {more > 0 ? (
                            <div className="text-[11px] text-muted-foreground px-1">+{more} others</div>
                          ) : null}
                          {rows.length === 0 ? (
                            <div className="text-[11px] text-muted-foreground px-1">—</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={completeDialogOpen} onOpenChange={(v) => setCompleteDialogOpen(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {completeTarget && pendingApprovalCompletionStatus(completeTarget) === 'Em aprovação'
                ? 'Submeter para aprovação'
                : 'Concluir actividade'}
            </DialogTitle>
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
                    {pendingApprovalCompletionStatus(completeTarget) === 'Em aprovação'
                      ? 'Largue ou escolha um ficheiro — após o envio, a actividade passa automaticamente para «Em aprovação» (PDF, DOCX, XLSX ou imagem).'
                      : 'Largue ou escolha um ficheiro — após o envio, a actividade fica automaticamente «Concluída».'}
                  </div>

                  <DeliverableFileDropZone
                    disabled={uploading}
                    uploading={uploading}
                    uploadingHint={
                      pendingApprovalCompletionStatus(completeTarget) === 'Em aprovação'
                        ? 'A passar para «Em aprovação»…'
                        : 'A passar para «Concluída»…'
                    }
                    selectedFile={uploadFile}
                    onFileSelected={(f) => {
                      setUploadFile(f);
                      if (f) void uploadDeliverableAndComplete(f);
                    }}
                  />
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
                      await setStatus(completeTarget.id, pendingApprovalCompletionStatus(completeTarget));
                      setCompleteDialogOpen(false);
                      setCompleteTargetId(null);
                    }}
                  >
                    {pendingApprovalCompletionStatus(completeTarget) === 'Em aprovação' ? 'Submeter' : 'Concluir'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Seleccione uma actividade.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Painel lateral de detalhes (tipo Jira) */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] p-0">
          <div className="h-full max-h-[100dvh] overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b">
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{detailsActivity?.titulo ?? 'Actividade'}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{detailsActivity ? `ID #${detailsActivity.id}` : ''}</div>
              </div>
              {/* O Sheet já tem Close default; evitamos duplicar */}
            </div>

            {detailsActivity ? (
              <div className="px-5 py-4 space-y-4 overflow-auto max-h-[calc(100dvh-64px)]">
                  <div className="grid gap-3">
                    <div className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
                      <div className="text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Criado em
                      </div>
                      <div className="text-foreground">
                        {(detailsActivity.createdAt ?? '').slice(0, 19).replace('T', ' ') || '—'}
                      </div>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
                      <div className="text-muted-foreground flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Criado por
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7 ring-1 ring-border/60">
                          {creatorColaborador?.fotoPerfilUrl ? (
                            <AvatarImage src={creatorColaborador.fotoPerfilUrl} alt={creatorColaborador.nome} className="object-cover" />
                          ) : null}
                          <AvatarFallback className="text-[10px] font-semibold">
                            {creatorColaborador?.nome ? initialsForName(creatorColaborador.nome) : '—'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="truncate">{creatorColaborador?.nome ? shortName(creatorColaborador.nome) : '—'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
                      <div className="text-muted-foreground flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Participantes
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {detailsParticipants.length === 0 ? (
                          <div className="text-muted-foreground">—</div>
                        ) : (
                          detailsParticipants.map((c) => (
                            <div key={c.id} className="flex items-center gap-2 rounded-full border bg-muted/30 px-2 py-1 max-w-full">
                              <Avatar className="h-6 w-6 ring-1 ring-border/60">
                                {c.fotoPerfilUrl ? <AvatarImage src={c.fotoPerfilUrl} alt={c.nome} className="object-cover" /> : null}
                                <AvatarFallback className="text-[10px] font-semibold">{initialsForName(c.nome)}</AvatarFallback>
                              </Avatar>
                              <div className="text-xs truncate max-w-[240px]">{shortName(c.nome)}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {Boolean(detailsActivity.requerAprovacao) && detailsActivity.aprovadorColaboradorId ? (
                      <div className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
                        <div className="text-muted-foreground flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Aprovação
                        </div>
                        <div className="text-sm">
                          <div>
                            Estado: obrigatória — conclusão vai para «Em aprovação» antes de «Concluída».
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            Aprovador:{' '}
                            <span className="text-foreground font-medium">
                              {colaboradorById.get(detailsActivity.aprovadorColaboradorId)?.nome
                                ? shortName(colaboradorById.get(detailsActivity.aprovadorColaboradorId)!.nome)
                                : `#${detailsActivity.aprovadorColaboradorId}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-1">
                      <div className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
                        <div className="text-muted-foreground flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Status
                        </div>
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                          <Badge variant={statusBadgeVariant(effectiveStatus(detailsActivity))}>
                            {effectiveStatus(detailsActivity)}
                          </Badge>
                          <Select
                            value={detailsActivity.status}
                            onValueChange={(v: any) => void setStatus(detailsActivity.id, v)}
                            disabled={detailsActivity.status === 'Concluída'}
                          >
                            <SelectTrigger className="h-8 w-[170px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pendente">Pendente</SelectItem>
                              <SelectItem value="Em Progresso">Em Progresso</SelectItem>
                              <SelectItem value="Em aprovação" disabled={blockManualEmAprovacaoPorEntregavel}>
                                Em aprovação
                              </SelectItem>
                              <SelectItem value="Atrasada">Atrasada</SelectItem>
                              <SelectItem
                                value="Concluída"
                                disabled={
                                  mustCompleteViaApprovalFlow(detailsActivity) || blockSeleccionarConcluidaPorEntregavel
                                }
                                className={
                                  mustCompleteViaApprovalFlow(detailsActivity) || blockSeleccionarConcluidaPorEntregavel
                                    ? 'opacity-50'
                                    : undefined
                                }
                              >
                                Concluída
                              </SelectItem>
                              <SelectItem value="Cancelada">Cancelada</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {detailsActivity.status === 'Concluída' ? (
                        <p className="text-[11px] text-muted-foreground pl-0 md:pl-[152px]">
                          Esta actividade está «Concluída» e já não pode mudar de estado.
                        </p>
                      ) : null}
                      {mustCompleteViaApprovalFlow(detailsActivity) ? (
                        <p className="text-[11px] text-muted-foreground pl-0 md:pl-[152px]">
                          Com aprovação activa, «Concluída» só fica disponível depois de «Em aprovação» (via Concluir ou coluna no Kanban).
                        </p>
                      ) : null}
                      {blockSeleccionarConcluidaPorEntregavel ? (
                        <p className="text-[11px] text-muted-foreground pl-0 md:pl-[152px]">
                          Com entregável obrigatório, anexe primeiro um ficheiro na secção abaixo antes de escolher «Concluída».
                        </p>
                      ) : null}
                      {blockManualEmAprovacaoPorEntregavel ? (
                        <p className="text-[11px] text-muted-foreground pl-0 md:pl-[152px]">
                          Com entregável obrigatório, anexe um ficheiro antes de passar a «Em aprovação» — use «Concluir» ou carregue aqui em Entregáveis.
                        </p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
                      <div className="text-muted-foreground flex items-center gap-2">
                        <Flag className="h-4 w-4" />
                        Prioridade
                      </div>
                      <Select
                        value={detailsActivity.prioridade}
                        onValueChange={(v: any) =>
                          void (supabase?.from('produtividade_actividades') as any)
                            ?.update({ prioridade: v })
                            .eq('id', detailsActivity.id)
                        }
                      >
                        <SelectTrigger className="h-8 w-[190px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Baixa">Baixa</SelectItem>
                          <SelectItem value="Média">Média</SelectItem>
                          <SelectItem value="Alta">Alta</SelectItem>
                          <SelectItem value="Urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
                      <div className="text-muted-foreground flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Datas
                      </div>
                      <div className="text-foreground">
                        {detailsActivity.dataActividade} → <span className="font-medium">{detailsActivity.prazo}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
                      <div className="text-muted-foreground">Categoria</div>
                      <Badge variant="outline">{detailsActivity.categoria}</Badge>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium">Descrição</div>
                    <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {detailsActivity.descricao?.trim() || detailsActivity.comentario?.trim() || '—'}
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">Entregáveis</div>
                      {detailsActivity.possuiEntregavel ? (
                        <Badge variant="secondary">Obrigatório</Badge>
                      ) : (
                        <Badge variant="outline">Opcional</Badge>
                      )}
                    </div>
                    {detailsEntregaveis.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nenhum ficheiro anexado.</div>
                    ) : (
                      <div className="space-y-2">
                        {detailsEntregaveis.map((eRow) => (
                          <div
                            key={eRow.id}
                            className="flex items-center gap-3 rounded-xl border bg-muted/10 px-3 py-2.5 text-left shadow-sm"
                          >
                            <EntregavelFileVisual mimeType={eRow.mimeType} />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{eRow.nomeFicheiro}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {eRow.mimeType
                                  ? `${eRow.mimeType} · ${formatEntregavelSize(eRow.tamanhoBytes)}`
                                  : formatEntregavelSize(eRow.tamanhoBytes)}
                              </div>
                              <div className="mt-1">
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  {eRow.estado}
                                </Badge>
                              </div>
                            </div>
                          {isPdfPreviewableEntregavel(eRow) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              aria-label={`Ver ${eRow.nomeFicheiro}`}
                              disabled={!eRow.storagePath}
                              onClick={() =>
                                openPdfViewerForEntregavel({
                                  storagePath: eRow.storagePath,
                                  nomeFicheiro: eRow.nomeFicheiro,
                                  mimeType: eRow.mimeType,
                                  actividadeId: detailsActivity.id,
                                  entregavelId: eRow.id,
                                })
                              }
                            >
                              <Eye className="h-5 w-5" />
                            </Button>
                          ) : null}
                          {isOfficePreviewableEntregavel(eRow) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              aria-label={`Ver ${eRow.nomeFicheiro}`}
                              disabled={!eRow.storagePath}
                              onClick={() =>
                                openOfficeViewerForEntregavel({
                                  storagePath: eRow.storagePath,
                                  nomeFicheiro: eRow.nomeFicheiro,
                                  mimeType: eRow.mimeType,
                                  actividadeId: detailsActivity.id,
                                  entregavelId: eRow.id,
                                })
                              }
                            >
                              <Eye className="h-5 w-5" />
                            </Button>
                          ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              aria-label={`Descarregar ${eRow.nomeFicheiro}`}
                              disabled={!eRow.storagePath}
                              onClick={() =>
                                downloadEntregavelFicheiro({
                                  storagePath: eRow.storagePath,
                                  nomeFicheiro: eRow.nomeFicheiro,
                                  actividadeId: detailsActivity.id,
                                  entregavelId: eRow.id,
                                })
                              }
                            >
                              <Download className="h-5 w-5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {canAttachMoreDeliverables ? (
                      <div className="rounded-lg border border-dashed bg-muted/15 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">Adicionar novo anexo</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              O ficheiro fica registado nos entregáveis e na actividade sem alterar o estado (ex.: nova versão em «Em aprovação»).
                            </div>
                          </div>
                        </div>
                        <DeliverableFileDropZone
                          disabled={detailsReplyUploading}
                          uploading={detailsReplyUploading}
                          uploadingHint="A registar anexo…"
                          selectedFile={detailsReplyPick}
                          dropZoneClassName="min-h-[100px] p-4 rounded-lg"
                          ariaLabel="Área para anexar outro entregável"
                          idleSub="ou clique para escolher — o envio é automático mas o estado não muda (PDF, Word, PowerPoint, Excel, imagens)"
                          onFileSelected={(f) => {
                            setDetailsReplyPick(f);
                            if (f) void uploadDetailsDeliverableAttachment(f);
                          }}
                        />
                      </div>
                    ) : detailsActivity.status === 'Concluída' || detailsActivity.status === 'Cancelada' ? (
                      <p className="text-[11px] text-muted-foreground">Não é possível anexar mais ficheiros neste estado.</p>
                    ) : currentEmpresaId === 'consolidado' ? (
                      <p className="text-[11px] text-muted-foreground">Seleccione uma empresa específica para anexar ficheiros aqui.</p>
                    ) : !user?.colaboradorId ? (
                      <p className="text-[11px] text-muted-foreground">Só utilizadores associados a um colaborador podem anexar ficheiros.</p>
                    ) : null}
                  </div>

                  <Tabs value={detailsTab} onValueChange={(v: any) => setDetailsTab(v)} className="w-full">
                    <TabsList className="w-full justify-start">
                      <TabsTrigger value="actividade">Actividade</TabsTrigger>
                      <TabsTrigger value="comentarios">Comentários</TabsTrigger>
                    </TabsList>
                    <TabsContent value="actividade" className="mt-3">
                      {detailsLoading ? (
                        <div className="text-sm text-muted-foreground">A carregar…</div>
                      ) : events.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Sem actividade recente.</div>
                      ) : (
                        <div className="space-y-0">
                          {events.map((e, evIdx) => {
                            const p = (e.payload ?? {}) as Record<string, unknown>;
                            const linked =
                              e.tipo === 'deliverable_uploaded'
                                ? entregavelLinkedToDeliverableEvent(e, detailsEntregaveis)
                                : null;
                            const commentIdRaw = (p as any)['commentId'] ?? (p as any)['comment_id'];
                            const commentId =
                              typeof commentIdRaw === 'number' && Number.isFinite(commentIdRaw)
                                ? commentIdRaw
                                : typeof commentIdRaw === 'string'
                                  ? Number(commentIdRaw)
                                  : null;
                            const linkedComment =
                              e.tipo === 'comment_added' && commentId != null
                                ? comments.find((c) => c.id === commentId) ?? null
                                : null;
                            const deliverableNome =
                              (typeof p['nome'] === 'string' && p['nome']) || linked?.nomeFicheiro || null;
                            const deliverablePath =
                              (typeof p['storage_path'] === 'string' && p['storage_path']) ||
                              linked?.storagePath ||
                              '';
                            const deliverableMime =
                              (typeof p['mime'] === 'string' && p['mime']) || linked?.mimeType || '';
                            const rawTb = p['tamanho_bytes'];
                            const deliverableSizeBytes =
                              typeof rawTb === 'number' && Number.isFinite(rawTb)
                                ? rawTb
                                : typeof rawTb === 'string'
                                  ? Number(rawTb)
                                  : linked?.tamanhoBytes;
                            const mimeLabel =
                              deliverableMime && deliverableMime.includes('/')
                                ? (() => {
                                    const part = deliverableMime.split('/')[1]!;
                                    return part.length > 14 ? deliverableMime : part.toUpperCase();
                                  })()
                                : deliverableMime;
                            const sizeLine =
                              typeof deliverableSizeBytes === 'number' && Number.isFinite(deliverableSizeBytes)
                                ? formatEntregavelSize(deliverableSizeBytes)
                                : '—';

                            const showDeliverableCard =
                              e.tipo === 'deliverable_uploaded' && deliverableNome && Boolean(deliverablePath);
                            const showCommentCard = e.tipo === 'comment_added' && Boolean(linkedComment?.conteudo?.trim());

                            return (
                              <div key={e.id} className="relative flex gap-3">
                                <div className="relative flex w-11 shrink-0 flex-col items-center pb-8">
                                  <Avatar className="relative z-10 h-9 w-9 ring-2 ring-background ring-offset-0">
                                    {e.actorColaboradorId && colaboradorById.get(e.actorColaboradorId)?.fotoPerfilUrl ? (
                                      <AvatarImage
                                        src={colaboradorById.get(e.actorColaboradorId)!.fotoPerfilUrl!}
                                        alt={colaboradorById.get(e.actorColaboradorId)!.nome}
                                        className="object-cover"
                                      />
                                    ) : null}
                                    <AvatarFallback className="text-[10px] font-semibold">
                                      {e.actorColaboradorId && colaboradorById.get(e.actorColaboradorId)?.nome
                                        ? initialsForName(colaboradorById.get(e.actorColaboradorId)!.nome)
                                        : '—'}
                                    </AvatarFallback>
                                  </Avatar>
                                  {evIdx < events.length - 1 ? (
                                    <div
                                      aria-hidden
                                      className="absolute left-1/2 top-9 bottom-0 w-0 -translate-x-1/2 border-l border-dashed border-muted-foreground/35"
                                    />
                                  ) : null}
                                </div>
                                <div className="min-w-0 flex-1 space-y-2 pb-8">
                                  <div>
                                    <div className="text-sm text-foreground">
                                      <span className="font-medium">
                                        {e.actorColaboradorId
                                          ? colaboradorById.get(e.actorColaboradorId)?.nome
                                            ? shortName(colaboradorById.get(e.actorColaboradorId)!.nome)
                                            : '—'
                                          : '—'}
                                      </span>{' '}
                                      <span className="text-muted-foreground font-normal">{eventLabel(e)}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {(e.createdAt ?? '').slice(0, 19).replace('T', ' ')}
                                    </div>
                                  </div>
                                  {showDeliverableCard ? (
                                    <div className="flex items-center gap-3 rounded-xl border bg-muted/10 px-3 py-2.5 shadow-sm">
                                      <EntregavelFileVisual mimeType={deliverableMime} />
                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium truncate">{deliverableNome}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                          {mimeLabel ? `${mimeLabel} · ${sizeLine}` : sizeLine}
                                        </div>
                                      </div>
                                      {isPdfPreviewableEntregavel({ nomeFicheiro: deliverableNome!, mimeType: deliverableMime }) ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="shrink-0"
                                          aria-label={`Ver ${deliverableNome}`}
                                          onClick={() =>
                                            openPdfViewerForEntregavel({
                                              storagePath: deliverablePath,
                                              nomeFicheiro: deliverableNome!,
                                              mimeType: deliverableMime,
                                              actividadeId: detailsActivity.id,
                                              entregavelId: linked?.id ?? null,
                                            })
                                          }
                                        >
                                          <Eye className="h-5 w-5" />
                                        </Button>
                                      ) : null}
                                      {isOfficePreviewableEntregavel({ nomeFicheiro: deliverableNome!, mimeType: deliverableMime }) ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="shrink-0"
                                          aria-label={`Ver ${deliverableNome}`}
                                          onClick={() =>
                                            openOfficeViewerForEntregavel({
                                              storagePath: deliverablePath,
                                              nomeFicheiro: deliverableNome!,
                                              mimeType: deliverableMime,
                                              actividadeId: detailsActivity.id,
                                              entregavelId: linked?.id ?? null,
                                            })
                                          }
                                        >
                                          <Eye className="h-5 w-5" />
                                        </Button>
                                      ) : null}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0"
                                        aria-label={`Descarregar ${deliverableNome}`}
                                        onClick={() =>
                                          downloadEntregavelFicheiro({
                                            storagePath: deliverablePath,
                                            nomeFicheiro: deliverableNome!,
                                            actividadeId: detailsActivity.id,
                                            entregavelId: linked?.id ?? null,
                                          })
                                        }
                                      >
                                        <Download className="h-5 w-5" />
                                      </Button>
                                    </div>
                                  ) : e.tipo === 'deliverable_uploaded' && deliverableNome && !deliverablePath ? (
                                    <div className="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                                      Anexo «{deliverableNome}» (evento antigo — sem caminho de armazenamento para descarga).
                                    </div>
                                  ) : showCommentCard ? (
                                    <div className="rounded-xl border bg-muted/10 px-3 py-2.5 shadow-sm">
                                      <div className="text-sm whitespace-pre-wrap">{linkedComment!.conteudo.trim()}</div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="comentarios" className="mt-3">
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <Textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Escreva um comentário…"
                            className="min-h-[44px]"
                          />
                          <Button onClick={postComment} disabled={postingComment || !newComment.trim()} className="shrink-0">
                            {postingComment ? 'A enviar…' : 'Enviar'}
                          </Button>
                        </div>

                        {detailsLoading ? (
                          <div className="text-sm text-muted-foreground">A carregar…</div>
                        ) : comments.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Sem comentários.</div>
                        ) : (
                          <div className="space-y-2">
                            {comments.map((c) => (
                              <div key={c.id} className="rounded-md border px-3 py-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Avatar className="h-7 w-7 ring-1 ring-border/60">
                                      {colaboradorById.get(c.autorColaboradorId)?.fotoPerfilUrl ? (
                                        <AvatarImage
                                          src={colaboradorById.get(c.autorColaboradorId)!.fotoPerfilUrl!}
                                          alt={colaboradorById.get(c.autorColaboradorId)!.nome}
                                          className="object-cover"
                                        />
                                      ) : null}
                                      <AvatarFallback className="text-[10px] font-semibold">
                                        {colaboradorById.get(c.autorColaboradorId)?.nome
                                          ? initialsForName(colaboradorById.get(c.autorColaboradorId)!.nome)
                                          : '—'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="text-sm font-medium truncate">
                                      {colaboradorById.get(c.autorColaboradorId)?.nome
                                        ? shortName(colaboradorById.get(c.autorColaboradorId)!.nome)
                                        : '—'}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground shrink-0">
                                    {(c.createdAt ?? '').slice(0, 19).replace('T', ' ')}
                                  </div>
                                </div>
                                <div className="text-sm whitespace-pre-wrap">{c.conteudo}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
              </div>
            ) : (
              <div className="px-5 py-6 text-sm text-muted-foreground">Seleccione uma actividade.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={viewerOpen}
        onOpenChange={(o) => {
          setViewerOpen(o);
          if (!o) {
            setViewerUrl('');
            setViewerTitle('');
          }
        }}
      >
        <DialogContent className="max-w-[980px]">
          <DialogHeader>
            <DialogTitle className="truncate">{viewerTitle || 'Documento'}</DialogTitle>
          </DialogHeader>
          {viewerUrl ? (
            <div className="w-full">
              <iframe
                title={viewerTitle || 'Microsoft Viewer'}
                src={viewerUrl}
                className="w-full h-[70vh] rounded-md border"
                allow="fullscreen"
              />
              <div className="mt-2 text-xs text-muted-foreground">
                Para ficheiros Office (Word/PowerPoint/Excel) a pré-visualização usa Microsoft Viewer. PDFs abrem no preview normal do browser.
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">A abrir…</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DireccaoActividadesPage() {
  return <MinhasActividadesPage scope="area" />;
}

function CreateActivityForm({
  onCreate,
  creating,
  disableSubmit,
  disableReason,
  empresaIdForSearch,
  canAssign,
  defaultDataActividade,
}: {
  creating: boolean;
  disableSubmit?: boolean;
  disableReason?: string;
  empresaIdForSearch: number | null;
  canAssign: boolean;
  defaultDataActividade?: string | null;
  onCreate: (form: {
    tipoActividade: string;
    localizacao: string | null;
    meioOnline: string | null;
    atribuidoColaboradorIds: number[];
    colegasColaboradorIds: number[];
    titulo: string;
    descricao: string;
    comentario: string;
    dataActividade: string;
    prazo: string;
    prioridade: string;
    categoria: string;
    possuiEntregavel: boolean;
    requerAprovacao: boolean;
    aprovadorColaboradorId: number | null;
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
  const [atribuidoColaboradorIds, setAtribuidoColaboradorIds] = useState<number[]>([]);
  const [colegasColaboradorIds, setColegasColaboradorIds] = useState<number[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [comentario, setComentario] = useState('');
  const initialDate = useMemo(() => {
    const v = defaultDataActividade?.trim();
    if (v && v >= todayKey) return v;
    return todayKey;
  }, [defaultDataActividade, todayKey]);

  const [dataActividade, setDataActividade] = useState(initialDate);
  const [prazo, setPrazo] = useState(initialDate);
  const minPrazo = useMemo(() => {
    const a = dataActividade?.trim() ? dataActividade : todayKey;
    // ISO yyyy-mm-dd compara lexicograficamente (seguro)
    return a > todayKey ? a : todayKey;
  }, [dataActividade, todayKey]);

  useEffect(() => {
    if (!prazo?.trim()) return;
    if (prazo < minPrazo) setPrazo(minPrazo);
  }, [minPrazo]);

  const [prioridade, setPrioridade] = useState('Média');
  const [categoria, setCategoria] = useState('Técnica');
  const [possuiEntregavel, setPossuiEntregavel] = useState(false);
  const [requerAprovacao, setRequerAprovacao] = useState(false);
  const [aprovadorColaboradorId, setAprovadorColaboradorId] = useState<number | null>(null);

  const canSubmit =
    titulo.trim().length >= 3 &&
    dataActividade.trim() &&
    prazo.trim() &&
    prioridade &&
    categoria &&
    tipoActividade &&
    (tipoActividade !== 'Presencial' || Boolean(localizacao)) &&
    (tipoActividade !== 'Online' || Boolean(meioOnline)) &&
    (!requerAprovacao || aprovadorColaboradorId != null) &&
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
          atribuidoColaboradorIds,
          colegasColaboradorIds,
          titulo: titulo.trim(),
          descricao,
          comentario,
          dataActividade,
          prazo,
          prioridade,
          categoria,
          possuiEntregavel,
          requerAprovacao,
          aprovadorColaboradorId,
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

      {canAssign ? (
        <div className="grid gap-2">
          <Label>Atribuir a (opcional)</Label>
          <EmployeeMultiSelect
            valueIds={atribuidoColaboradorIds}
            empresaId={empresaIdForSearch}
            disabled={disableSubmit}
            onChange={(ids) => setAtribuidoColaboradorIds(ids)}
          />
          <div className="text-xs text-muted-foreground">
            A actividade ficará visível para ti e para o colaborador atribuído, e ambos podem actualizar o estado.
          </div>
        </div>
      ) : null}

      {!canAssign ? (
        <div className="grid gap-2">
          <Label>Adicionar colega (opcional)</Label>
          <EmployeeMultiSelect
            valueIds={colegasColaboradorIds}
            empresaId={empresaIdForSearch}
            disabled={disableSubmit}
            onChange={(ids) => setColegasColaboradorIds(ids)}
          />
          <div className="text-xs text-muted-foreground">
            O(s) colega(s) adicionado(s) também verá(ão) a actividade e poderão actualizar o estado.
          </div>
        </div>
      ) : null}

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
          <Input type="date" value={dataActividade} min={todayKey} onChange={e => setDataActividade(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Prazo (deadline)</Label>
          <Input type="date" value={prazo} min={minPrazo} onChange={e => setPrazo(e.target.value)} />
          <div className="text-xs text-muted-foreground">O prazo não pode ser anterior a {minPrazo}.</div>
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

      <div className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium">Exige aprovação para concluir?</div>
          <div className="text-xs text-muted-foreground">
            Se sim, ao arrastar para «Concluída» a actividade passa para «Em aprovação» até o colaborador seleccionado aprovar.
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-muted-foreground">{requerAprovacao ? 'Sim' : 'Não'}</span>
          <Switch
            checked={requerAprovacao}
            onCheckedChange={(v) => {
              setRequerAprovacao(v);
              if (!v) setAprovadorColaboradorId(null);
            }}
            aria-label="Exige aprovação"
          />
        </div>
      </div>

      {requerAprovacao ? (
        <div className="grid gap-2">
          <Label>Quem deve aprovar?</Label>
          <EmployeeSelect
            valueId={aprovadorColaboradorId}
            onChange={(id) => setAprovadorColaboradorId(id)}
            empresaId={empresaIdForSearch}
            disabled={disableSubmit}
            placeholder="Pesquisar colaborador (mín. 4 letras)…"
          />
          {!aprovadorColaboradorId ? (
            <div className="text-xs text-muted-foreground">Seleccione o aprovador para continuar.</div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={!canSubmit || creating}>
          {creating ? 'A criar…' : 'Criar'}
        </Button>
      </div>
    </form>
  );
}

