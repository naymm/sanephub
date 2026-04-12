import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { Acta, Colaborador, Reuniao } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Pencil, Eye, Trash2, X, Check, ChevronsUpDown, Mic, UploadCloud } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isActaAudioFile, uploadActaAudioTranscricao } from '@/lib/actaAudioTranscricao';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';

const STATUS_OPTIONS: Acta['status'][] = ['Rascunho', 'Em Revisão', 'Aprovada', 'Publicada', 'Arquivada'];

const MAX_AUDIO_BYTES = 80 * 1024 * 1024;

const AUDIO_INPUT_ACCEPT = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac,.opus';

/** Nomes na mesma ordem que os IDs (lista completa de colaboradores para resolver nomes). */
function participantesIdsToNomes(ids: number[], todosColaboradores: Colaborador[]): string[] {
  return ids.map(id => todosColaboradores.find(c => c.id === id)?.nome ?? `Colaborador #${id}`);
}

function nextNumero(actas: Acta[]): string {
  const year = new Date().getFullYear();
  const prefix = `ACT-${year}-`;
  const nums = actas.filter(a => a.numero.startsWith(prefix)).map(a => parseInt(a.numero.split('-')[2], 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function reuniaoToActaFields(r: Reuniao) {
  return {
    titulo: r.titulo,
    data: r.data,
    local: r.local,
    hora: r.hora,
    participantesIds: [...r.participantes],
  };
}

function emptyForm(actas: Acta[], reunioes: Reuniao[]): Omit<Acta, 'id'> {
  const r = reunioes[0];
  return {
    reuniaoId: r?.id ?? 0,
    numero: nextNumero(actas),
    data: r?.data ?? new Date().toISOString().slice(0, 10),
    titulo: r?.titulo ?? '',
    conteudo: '',
    status: 'Rascunho',
    local: r?.local ?? '',
    hora: r?.hora ?? '',
    duracao: '',
    participantesIds: r ? [...r.participantes] : [],
    presididaPor: null,
    audioTranscricaoPath: null,
  };
}

export default function ActasPage() {
  const { actas, addActa, updateActa, deleteActa, reunioes, colaboradores, colaboradoresTodos } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Acta['status'] | 'todos'>('todos');
  const [reuniaoFilter, setReuniaoFilter] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Acta | null>(null);
  const [viewItem, setViewItem] = useState<Acta | null>(null);
  const [form, setForm] = useState<Omit<Acta, 'id'>>(() => emptyForm([], []));
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDragActive, setAudioDragActive] = useState(false);
  const audioDragDepth = useRef(0);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [participantesOpen, setParticipantesOpen] = useState(false);
  const [participantesSearch, setParticipantesSearch] = useState('');

  const colaboradoresSelect = useMemo(() => {
    return [...colaboradores]
      .filter(c => c.status === 'Activo')
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  }, [colaboradores]);

  const participantesFiltrados = useMemo(() => {
    const q = participantesSearch.trim().toLowerCase();
    if (!q) return colaboradoresSelect;
    return colaboradoresSelect.filter(c => c.nome.toLowerCase().includes(q));
  }, [colaboradoresSelect, participantesSearch]);

  const getReuniaoTitulo = (id: number) => reunioes.find(r => r.id === id)?.titulo ?? 'N/A';

  const nomeColab = (id: number) => colaboradores.find(c => c.id === id)?.nome ?? `#${id}`;

  const applyAudioFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!isActaAudioFile(file)) {
      toast.error('Seleccione um ficheiro de áudio válido (MP3, WAV, M4A, etc.).');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      toast.error('O ficheiro de áudio não pode exceder 80 MB.');
      return;
    }
    setAudioFile(file);
  };

  const filtered = actas.filter(a => {
    const matchSearch =
      a.numero.toLowerCase().includes(search.toLowerCase()) ||
      a.titulo.toLowerCase().includes(search.toLowerCase()) ||
      getReuniaoTitulo(a.reuniaoId).toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || a.status === statusFilter;
    const matchReuniao = reuniaoFilter === 'todos' || String(a.reuniaoId) === reuniaoFilter;
    return matchSearch && matchStatus && matchReuniao;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('numero');
  const mobileComparators = useMemo(
    () => ({
      numero: (a: Acta, b: Acta) => a.numero.localeCompare(b.numero, 'pt', { sensitivity: 'base' }),
      titulo: (a: Acta, b: Acta) => a.titulo.localeCompare(b.titulo, 'pt', { sensitivity: 'base' }),
      data: (a: Acta, b: Acta) => a.data.localeCompare(b.data),
      reuniao: (a: Acta, b: Acta) =>
        getReuniaoTitulo(a.reuniaoId).localeCompare(getReuniaoTitulo(b.reuniaoId), 'pt', { sensitivity: 'base' }),
    }),
    [reunioes],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const openCreate = () => {
    setEditing(null);
    setAudioFile(null);
    setParticipantesSearch('');
    setForm(emptyForm(actas, reunioes));
    setDialogOpen(true);
  };

  const openEdit = (a: Acta) => {
    const r = reunioes.find(x => x.id === a.reuniaoId);
    setEditing(a);
    setAudioFile(null);
    setParticipantesSearch('');
    setForm({
      reuniaoId: a.reuniaoId,
      numero: a.numero,
      data: a.data,
      titulo: a.titulo,
      conteudo: a.conteudo,
      aprovadaPor: a.aprovadaPor,
      status: a.status,
      presididaPor: a.presididaPor ?? null,
      participantesIds: a.participantesIds ?? (r ? [...r.participantes] : []),
      local: a.local ?? r?.local ?? '',
      hora: a.hora ?? r?.hora ?? '',
      duracao: a.duracao ?? '',
      audioTranscricaoPath: a.audioTranscricaoPath ?? null,
    });
    setDialogOpen(true);
  };

  const toggleParticipante = (id: number) => {
    setForm(f => {
      const cur = f.participantesIds ?? [];
      const has = cur.includes(id);
      return {
        ...f,
        participantesIds: has ? cur.filter(x => x !== id) : [...cur, id],
      };
    });
  };

  const save = async () => {
    if (!form.reuniaoId || !form.numero.trim() || !form.data || !form.titulo.trim()) return;
    if (audioFile && audioFile.size > MAX_AUDIO_BYTES) {
      toast.error('O ficheiro de áudio não pode exceder 80 MB.');
      return;
    }
    if (audioFile && !isSupabaseConfigured()) {
      toast.error('Configure o Supabase para enviar áudio para transcrição.');
      return;
    }
    setSaving(true);
    try {
      const idsParticipantes = form.participantesIds ?? [];
      const payload: Partial<Acta> = {
        reuniaoId: form.reuniaoId,
        numero: editing ? form.numero.trim() : nextNumero(actas),
        data: form.data,
        titulo: form.titulo.trim(),
        conteudo: form.conteudo,
        aprovadaPor: form.aprovadaPor,
        status: form.status,
        presididaPor: form.presididaPor ?? null,
        participantesIds: idsParticipantes,
        participantesNomes: participantesIdsToNomes(idsParticipantes, colaboradoresTodos),
        local: form.local ?? '',
        hora: form.hora ?? '',
        duracao: form.duracao ?? '',
      };

      let actaId: number;
      if (editing) {
        await updateActa(editing.id, payload);
        actaId = editing.id;
      } else {
        const created = await addActa(payload);
        actaId = created.id;
      }

      if (audioFile && supabase) {
        const url = await uploadActaAudioTranscricao(supabase, actaId, audioFile);
        await updateActa(actaId, { audioTranscricaoPath: url });
      }

      setDialogOpen(false);
      setEditing(null);
      setAudioFile(null);
      toast.success('Acta guardada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Acta) => {
    if (!window.confirm(`Remover acta ${a.numero}?`)) return;
    try {
      await deleteActa(a.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  const isCreate = !editing;
  const numeroExibicao = isCreate ? nextNumero(actas) : form.numero;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Actas</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground" disabled={reunioes.length === 0}>
          <Plus className="h-4 w-4 mr-2" /> Nova acta
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar número, título ou reunião..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as Acta['status'] | 'todos')}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reuniaoFilter} onValueChange={setReuniaoFilter}>
          <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="Reunião" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as reuniões</SelectItem>
            {reunioes.map(r => (
              <SelectItem key={r.id} value={String(r.id)}>{r.titulo} ({formatDate(r.data)})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Número</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Título</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Reunião</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(a => (
              <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-mono text-xs">{a.numero}</td>
                <td className="py-3 px-5 font-medium max-w-48 truncate">{a.titulo}</td>
                <td className="py-3 px-5 text-muted-foreground max-w-40 truncate" title={getReuniaoTitulo(a.reuniaoId)}>{getReuniaoTitulo(a.reuniaoId)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(a.data)}</td>
                <td className="py-3 px-5"><StatusBadge status={a.status} /></td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(a); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={sortedMobileRows}
          rowId={a => a.id}
          sortBar={{
            options: [
              { key: 'numero', label: 'Número' },
              { key: 'titulo', label: 'Título' },
              { key: 'reuniao', label: 'Reunião' },
              { key: 'data', label: 'Data' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={a => ({
            title: a.titulo,
            trailing: <StatusBadge status={a.status} />,
          })}
          renderDetails={a => [
            { label: 'Número', value: <span className="font-mono text-xs">{a.numero}</span> },
            { label: 'Reunião', value: getReuniaoTitulo(a.reuniaoId) },
            { label: 'Data', value: formatDate(a.data) },
            { label: 'Status', value: <StatusBadge status={a.status} /> },
          ]}
          renderActions={a => (
            <>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => { setViewItem(a); setViewOpen(true); }} aria-label="Ver">
                <Eye className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => openEdit(a)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(a)}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        />
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma acta encontrada.</p>}
      {reunioes.length === 0 && <p className="text-sm text-amber-600">Crie pelo menos uma reunião para poder registar actas.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar acta' : 'Nova acta'}</DialogTitle>
            <DialogDescription>Registo da acta da reunião. O número é gerado automaticamente no novo registo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Reunião</Label>
              <Select
                value={form.reuniaoId ? String(form.reuniaoId) : ''}
                onValueChange={v => {
                  const id = Number(v);
                  const r = reunioes.find(x => x.id === id);
                  setForm(f => ({
                    ...f,
                    reuniaoId: id,
                    ...(r ? reuniaoToActaFields(r) : {}),
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar reunião" /></SelectTrigger>
                <SelectContent>
                  {reunioes.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.titulo} — {formatDate(r.data)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número da acta</Label>
                <Input value={numeroExibicao} readOnly className="bg-muted font-mono" />
                {isCreate && <p className="text-xs text-muted-foreground">Gerado automaticamente (sequência anual).</p>}
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Sincronizado com a reunião (editável)" />
            </div>

            <div className="space-y-2">
              <Label>Presidida por</Label>
              <Select
                value={form.presididaPor != null ? String(form.presididaPor) : '__none__'}
                onValueChange={v => setForm(f => ({ ...f, presididaPor: v === '__none__' ? null : Number(v) }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar colaborador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {colaboradoresSelect.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Participantes</Label>
              <Popover open={participantesOpen} onOpenChange={setParticipantesOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate text-left">
                      {(form.participantesIds?.length ?? 0) === 0
                        ? 'Seleccionar colaboradores…'
                        : `${form.participantesIds!.length} seleccionado(s)`}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Pesquisar por nome…"
                      value={participantesSearch}
                      onChange={e => setParticipantesSearch(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto p-2 space-y-1">
                    {participantesFiltrados.length === 0 && (
                      <p className="text-sm text-muted-foreground px-2 py-3">Nenhum colaborador encontrado.</p>
                    )}
                    {participantesFiltrados.map(c => {
                      const checked = (form.participantesIds ?? []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => toggleParticipante(c.id)}
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input',
                              checked && 'border-primary bg-primary text-primary-foreground',
                            )}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <span className="flex-1 truncate">{c.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              {(form.participantesIds?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.participantesIds!.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1 font-normal">
                      {nomeColab(id)}
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                        onClick={() => toggleParticipante(id)}
                        aria-label={`Remover ${nomeColab(id)}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Local</Label>
                <Input value={form.local ?? ''} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} placeholder="Da reunião" />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input value={form.hora ?? ''} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} placeholder="Ex: 09:00" />
              </div>
              <div className="space-y-2">
                <Label>Duração</Label>
                <Input value={form.duracao ?? ''} onChange={e => setForm(f => ({ ...f, duracao: e.target.value }))} placeholder="Ex: 90 min ou 1h30" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} placeholder="Resumo e deliberações..." rows={5} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Áudio para transcrição (n8n)
              </Label>
              <div
                className={cn(
                  'cursor-pointer rounded-lg border-2 border-dashed px-3 py-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  audioDragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border/80 bg-muted/20 hover:border-muted-foreground/40 hover:bg-muted/30',
                )}
                onClick={() => audioFileInputRef.current?.click()}
                onDragEnter={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  audioDragDepth.current += 1;
                  setAudioDragActive(true);
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  audioDragDepth.current -= 1;
                  if (audioDragDepth.current <= 0) {
                    audioDragDepth.current = 0;
                    setAudioDragActive(false);
                  }
                }}
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  audioDragDepth.current = 0;
                  setAudioDragActive(false);
                  const f = e.dataTransfer.files?.[0];
                  applyAudioFile(f);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={ev => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    audioFileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={audioFileInputRef}
                  type="file"
                  className="sr-only"
                  accept={AUDIO_INPUT_ACCEPT}
                  onChange={e => {
                    applyAudioFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <UploadCloud
                  className={cn('mx-auto h-9 w-9', audioDragActive ? 'text-primary' : 'text-muted-foreground')}
                  aria-hidden
                />
                <p className="mt-2 text-sm font-medium">Arraste o áudio aqui ou clique para seleccionar</p>
                <p className="mt-1 text-xs text-muted-foreground">MP3, WAV, M4A, OGG, WebM… · máx. 80 MB</p>
              </div>
              {editing?.audioTranscricaoPath && !audioFile && (
                <p className="text-xs text-muted-foreground break-all">
                  Ficheiro actual: <a href={editing.audioTranscricaoPath} className="text-primary underline" target="_blank" rel="noreferrer">abrir</a>
                </p>
              )}
              {audioFile && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={() => setAudioFile(null)}>
                    Remover
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Aprovada por</Label>
                <Input value={form.aprovadaPor ?? ''} onChange={e => setForm(f => ({ ...f, aprovadaPor: e.target.value || undefined }))} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Acta['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.reuniaoId || !form.data || !form.titulo.trim()}>
              {saving ? 'A guardar…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewItem?.numero}</DialogTitle>
            <DialogDescription>{viewItem?.titulo}</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Reunião:</span> {getReuniaoTitulo(viewItem.reuniaoId)}</p>
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewItem.data)}</p>
              {(viewItem.local || viewItem.hora) && (
                <p>
                  <span className="text-muted-foreground">Local / Hora:</span>{' '}
                  {[viewItem.local, viewItem.hora].filter(Boolean).join(' · ') || '—'}
                </p>
              )}
              {viewItem.duracao && <p><span className="text-muted-foreground">Duração:</span> {viewItem.duracao}</p>}
              {viewItem.presididaPor != null && (
                <p><span className="text-muted-foreground">Presidida por:</span> {nomeColab(viewItem.presididaPor)}</p>
              )}
              {(viewItem.participantesNomes?.length ?? 0) > 0 ||
              (viewItem.participantesIds?.length ?? 0) > 0 ? (
                <div>
                  <p className="text-muted-foreground mb-1">Participantes:</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {(viewItem.participantesNomes?.length
                      ? viewItem.participantesNomes
                      : viewItem.participantesIds!.map(id => nomeColab(id))
                    ).map((nome, i) => (
                      <li key={`${nome}-${i}`}>{nome}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
              {viewItem.aprovadaPor && <p><span className="text-muted-foreground">Aprovada por:</span> {viewItem.aprovadaPor}</p>}
              {viewItem.audioTranscricaoPath && (
                <p>
                  <span className="text-muted-foreground">Áudio (transcrição):</span>{' '}
                  <a href={viewItem.audioTranscricaoPath} className="text-primary underline" target="_blank" rel="noreferrer">abrir ficheiro</a>
                </p>
              )}
              <div>
                <p className="text-muted-foreground mb-1">Conteúdo:</p>
                <pre className="whitespace-pre-wrap rounded bg-muted/50 p-3 text-xs">{viewItem.conteudo || '—'}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
