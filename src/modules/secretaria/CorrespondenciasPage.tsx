import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import type { Correspondencia } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Pencil, Eye, Trash2, ExternalLink } from 'lucide-react';
import { FileDropZone } from '@/components/shared/FileDropZone';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  CORRESPONDENCIAS_ANEXOS_ACCEPT,
  correspondenciaAnexoPublicUrl,
  uploadCorrespondenciaAnexo,
  validateCorrespondenciaAnexoFile,
} from '@/lib/correspondenciaAnexos';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

const TIPO_OPTIONS: Correspondencia['tipo'][] = ['Entrada', 'Saída'];
const PRIORIDADE_OPTIONS: Correspondencia['prioridade'][] = ['Normal', 'Urgente', 'Confidencial'];
const ESTADO_OPTIONS: Correspondencia['estadoResposta'][] = ['Pendente', 'Respondida', 'Não requer', 'Arquivada'];

const LIST_PATH = '/secretaria/correspondencias';
const NOVO_PATH = '/secretaria/correspondencias/novo';

export default function CorrespondenciasPage() {
  const navigate = useNavigate();
  const { correspondencias, addCorrespondencia, updateCorrespondencia, deleteCorrespondencia } = useData();
  const isMobileViewport = useIsMobileViewport();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<Correspondencia['tipo'] | 'todos'>('todos');
  const [prioridadeFilter, setPrioridadeFilter] = useState<Correspondencia['prioridade'] | 'todos'>('todos');
  const [estadoFilter, setEstadoFilter] = useState<Correspondencia['estadoResposta'] | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Correspondencia | null>(null);
  const [viewItem, setViewItem] = useState<Correspondencia | null>(null);
  const emptyForm = useCallback(
    (): Omit<Correspondencia, 'id'> => ({
      tipo: 'Entrada',
      remetente: '',
      destinatario: '',
      assunto: '',
      referencia: '',
      data: new Date().toISOString().slice(0, 10),
      prioridade: 'Normal',
      estadoResposta: 'Pendente',
      documentoStoragePath: null,
      documentoNomeFicheiro: null,
      protocoloStoragePath: null,
      protocoloNomeFicheiro: null,
    }),
    [],
  );

  const [form, setForm] = useState<Omit<Correspondencia, 'id'>>(emptyForm);
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);
  const [protocoloFile, setProtocoloFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const clearAnexoPickers = useCallback(() => {
    setDocumentoFile(null);
    setProtocoloFile(null);
  }, []);

  const prepareCreate = useCallback(() => {
    setEditing(null);
    setForm(emptyForm());
    clearAnexoPickers();
  }, [clearAnexoPickers, emptyForm]);

  const resetModal = useCallback(() => {
    setEditing(null);
    setForm(emptyForm());
    clearAnexoPickers();
  }, [clearAnexoPickers, emptyForm]);

  const {
    isNovoRoute,
    showMobileCreate,
    openCreateNavigateOrDialog,
    closeMobileCreate,
    onDialogOpenChange,
    endMobileCreateFlow,
  } = useMobileCreateRoute({
    listPath: LIST_PATH,
    novoPath: NOVO_PATH,
    dialogOpen,
    setDialogOpen,
    prepareCreate,
    resetModal,
  });

  const filtered = correspondencias.filter(c => {
    const matchSearch =
      c.referencia.toLowerCase().includes(search.toLowerCase()) ||
      c.assunto.toLowerCase().includes(search.toLowerCase()) ||
      c.remetente.toLowerCase().includes(search.toLowerCase()) ||
      c.destinatario.toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoFilter === 'todos' || c.tipo === tipoFilter;
    const matchPrioridade = prioridadeFilter === 'todos' || c.prioridade === prioridadeFilter;
    const matchEstado = estadoFilter === 'todos' || c.estadoResposta === estadoFilter;
    return matchSearch && matchTipo && matchPrioridade && matchEstado;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('data');
  const mobileComparators = useMemo(
    () => ({
      data: (a: Correspondencia, b: Correspondencia) => a.data.localeCompare(b.data),
      assunto: (a: Correspondencia, b: Correspondencia) => a.assunto.localeCompare(b.assunto, 'pt', { sensitivity: 'base' }),
    }),
    [],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const openCreate = () => openCreateNavigateOrDialog();

  const openEdit = (c: Correspondencia) => {
    setEditing(c);
    setForm({
      tipo: c.tipo,
      remetente: c.remetente,
      destinatario: c.destinatario,
      assunto: c.assunto,
      referencia: c.referencia,
      data: c.data,
      prioridade: c.prioridade,
      estadoResposta: c.estadoResposta,
      documentoStoragePath: c.documentoStoragePath ?? null,
      documentoNomeFicheiro: c.documentoNomeFicheiro ?? null,
      protocoloStoragePath: c.protocoloStoragePath ?? null,
      protocoloNomeFicheiro: c.protocoloNomeFicheiro ?? null,
    });
    clearAnexoPickers();
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.remetente.trim() || !form.destinatario.trim() || !form.assunto.trim() || !form.data) return;
    if (!hasDocumentoAnexo) {
      toast.error('O documento é obrigatório. Anexe o ficheiro antes de guardar.');
      return;
    }
    if (documentoFile) {
      const err = validateCorrespondenciaAnexoFile(documentoFile);
      if (err) {
        toast.error(err);
        return;
      }
    }
    if (protocoloFile) {
      const err = validateCorrespondenciaAnexoFile(protocoloFile);
      if (err) {
        toast.error(err);
        return;
      }
    }
    if ((documentoFile || protocoloFile) && (!isSupabaseConfigured() || !supabase)) {
      toast.error(
        !editing && documentoFile
          ? 'O documento é obrigatório e requer ligação ao Supabase.'
          : 'Anexos requerem ligação ao Supabase.',
      );
      return;
    }
    if (!editing && !documentoFile) {
      toast.error('O documento é obrigatório. Anexe o ficheiro antes de guardar.');
      return;
    }

    setSaving(true);
    try {
      let payload: Omit<Correspondencia, 'id'> = { ...form };

      if (editing) {
        if (documentoFile && supabase) {
          const patch = await uploadCorrespondenciaAnexo(supabase, editing.id, 'documento', documentoFile);
          payload = { ...payload, ...patch };
        }
        if (protocoloFile && supabase) {
          const patch = await uploadCorrespondenciaAnexo(supabase, editing.id, 'protocolo', protocoloFile);
          payload = { ...payload, ...patch };
        }
        await updateCorrespondencia(editing.id, payload);
      } else {
        const created = await addCorrespondencia(payload);
        const patch: Partial<Correspondencia> = {};
        if (documentoFile && supabase) {
          Object.assign(patch, await uploadCorrespondenciaAnexo(supabase, created.id, 'documento', documentoFile));
        }
        if (protocoloFile && supabase) {
          Object.assign(patch, await uploadCorrespondenciaAnexo(supabase, created.id, 'protocolo', protocoloFile));
        }
        if (Object.keys(patch).length > 0) {
          await updateCorrespondencia(created.id, patch);
        }
      }

      setDialogOpen(false);
      setEditing(null);
      clearAnexoPickers();
      toast.success(editing ? 'Correspondência actualizada.' : 'Correspondência registada.');
      if (isNovoRoute) {
        endMobileCreateFlow();
        navigate(LIST_PATH, { replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Correspondencia) => {
    if (!window.confirm('Remover esta correspondência?')) return;
    try {
      await deleteCorrespondencia(c.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  const hasDocumentoAnexo = Boolean(
    documentoFile || (form.documentoStoragePath ?? editing?.documentoStoragePath)?.trim(),
  );

  const title = editing ? 'Editar correspondência' : 'Nova correspondência';
  const showMobileForm = showMobileCreate || (isMobileViewport && dialogOpen);
  const saveDisabled =
    saving ||
    !form.remetente.trim() ||
    !form.destinatario.trim() ||
    !form.assunto.trim() ||
    !form.data ||
    !hasDocumentoAnexo;

  const formBody = (
    <div className="grid gap-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as Correspondencia['tipo'] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPO_OPTIONS.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Remetente</Label>
        <Input value={form.remetente} onChange={e => setForm(f => ({ ...f, remetente: e.target.value }))} placeholder="Quem envia" />
      </div>
      <div className="space-y-2">
        <Label>Destinatário</Label>
        <Input value={form.destinatario} onChange={e => setForm(f => ({ ...f, destinatario: e.target.value }))} placeholder="Quem recebe" />
      </div>
      <div className="space-y-2">
        <Label>Assunto</Label>
        <Input value={form.assunto} onChange={e => setForm(f => ({ ...f, assunto: e.target.value }))} placeholder="Assunto da correspondência" />
      </div>
      <div className="space-y-2">
        <Label>Referência</Label>
        <Input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} placeholder="Ex: OF-MF-2024-1234" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Prioridade</Label>
          <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v as Correspondencia['prioridade'] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORIDADE_OPTIONS.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Estado resposta</Label>
          <Select value={form.estadoResposta} onValueChange={v => setForm(f => ({ ...f, estadoResposta: v as Correspondencia['estadoResposta'] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTADO_OPTIONS.map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
        <FileDropZone
          label="Documento"
          required
          showRequiredHint={!hasDocumentoAnexo}
          accept={CORRESPONDENCIAS_ANEXOS_ACCEPT}
          selectedFile={documentoFile}
          onFileSelected={setDocumentoFile}
          validateFile={validateCorrespondenciaAnexoFile}
          existingFileName={form.documentoNomeFicheiro ?? editing?.documentoNomeFicheiro}
          disabled={saving}
          uploading={saving && Boolean(documentoFile)}
          compact
          idleSub="ou clique — PDF, Word, Excel ou imagem (máx. 25 MB)"
        />
        <FileDropZone
          label="Protocolo"
          accept={CORRESPONDENCIAS_ANEXOS_ACCEPT}
          selectedFile={protocoloFile}
          onFileSelected={setProtocoloFile}
          validateFile={validateCorrespondenciaAnexoFile}
          existingFileName={form.protocoloNomeFicheiro ?? editing?.protocoloNomeFicheiro}
          disabled={saving}
          uploading={saving && Boolean(protocoloFile)}
          compact
          idleSub="opcional — pode anexar depois na edição"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Correspondências</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova correspondência
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar ref., assunto, remetente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={tipoFilter} onValueChange={v => setTipoFilter(v as Correspondencia['tipo'] | 'todos')}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {TIPO_OPTIONS.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prioridadeFilter} onValueChange={v => setPrioridadeFilter(v as Correspondencia['prioridade'] | 'todos')}>
          <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Prioridade</SelectItem>
            {PRIORIDADE_OPTIONS.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={estadoFilter} onValueChange={v => setEstadoFilter(v as Correspondencia['estadoResposta'] | 'todos')}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Estado resposta</SelectItem>
            {ESTADO_OPTIONS.map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ref.</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Remetente</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Destinatário</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Assunto</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Prioridade</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(c => (
              <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-mono text-xs">{c.referencia}</td>
                <td className="py-3 px-5">{c.tipo}</td>
                <td className="py-3 px-5 text-muted-foreground max-w-32 truncate" title={c.remetente}>{c.remetente}</td>
                <td className="py-3 px-5 text-muted-foreground max-w-32 truncate" title={c.destinatario}>{c.destinatario}</td>
                <td className="py-3 px-5 font-medium max-w-48 truncate" title={c.assunto}>{c.assunto}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(c.data)}</td>
                <td className="py-3 px-5">{c.prioridade}</td>
                <td className="py-3 px-5"><StatusBadge status={c.estadoResposta} /></td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(c); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={sortedMobileRows}
          rowId={c => c.id}
          sortBar={{
            options: [
              { key: 'data', label: 'Data' },
              { key: 'assunto', label: 'Assunto' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={c => ({ title: c.assunto, trailing: <span className="text-xs font-mono text-muted-foreground">{c.referencia}</span> })}
          renderDetails={c => [
            { label: 'Ref.', value: c.referencia },
            { label: 'Tipo', value: c.tipo },
            { label: 'Remetente', value: c.remetente },
            { label: 'Destinatário', value: c.destinatario },
            { label: 'Assunto', value: c.assunto },
            { label: 'Data', value: formatDate(c.data) },
            { label: 'Prioridade', value: c.prioridade },
            { label: 'Estado', value: <StatusBadge status={c.estadoResposta} /> },
          ]}
          renderActions={c => (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => {
                  setViewItem(c);
                  setViewOpen(true);
                }}
                aria-label="Ver"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => openEdit(c)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(c)}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        />
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma correspondência encontrada.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileForm}
          onCloseMobile={() => onDialogOpenChange(false)}
          moduleKicker="Secretaria Geral"
          screenTitle={title}
          desktopContentClassName="max-w-2xl"
          desktopHeader={mobileCreateDesktopHeader(title, 'Registo de entrada ou saída.')}
          formBody={formBody}
          desktopFooter={
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saveDisabled}>
                {saving ? 'A guardar…' : 'Guardar'}
              </Button>
            </DialogFooter>
          }
          mobileFooter={
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 rounded-xl"
                onClick={() => onDialogOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="button" className="min-h-11 flex-1 rounded-xl" disabled={saveDisabled} onClick={() => void save()}>
                {saving ? 'A guardar…' : 'Guardar'}
              </Button>
            </div>
          }
        />
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="grid max-h-[min(90dvh,90vh)] max-w-lg grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{viewItem?.referencia}</DialogTitle>
            <DialogDescription>{viewItem?.assunto}</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain text-sm pr-1">
              <p><span className="text-muted-foreground">Tipo:</span> {viewItem.tipo}</p>
              <p><span className="text-muted-foreground">Remetente:</span> {viewItem.remetente}</p>
              <p><span className="text-muted-foreground">Destinatário:</span> {viewItem.destinatario}</p>
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewItem.data)}</p>
              <p><span className="text-muted-foreground">Prioridade:</span> {viewItem.prioridade}</p>
              <p><span className="text-muted-foreground">Estado:</span> <StatusBadge status={viewItem.estadoResposta} /></p>
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Anexos</p>
                {(['documento', 'protocolo'] as const).map(campo => {
                  const path =
                    campo === 'documento' ? viewItem.documentoStoragePath : viewItem.protocoloStoragePath;
                  const nome =
                    campo === 'documento' ? viewItem.documentoNomeFicheiro : viewItem.protocoloNomeFicheiro;
                  const label = campo === 'documento' ? 'Documento' : 'Protocolo';
                  const url =
                    supabase && path ? correspondenciaAnexoPublicUrl(supabase, path) : null;
                  return (
                    <div key={campo} className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground min-w-[5.5rem]">{label}:</span>
                      {url && nome ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {nome}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
