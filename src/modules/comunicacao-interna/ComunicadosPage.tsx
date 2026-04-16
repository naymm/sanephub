import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import type { Comunicado, ComunicadoTipo } from '@/types';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/context/TenantContext';
import { useNotifications } from '@/context/NotificationContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Pencil, Trash2, Eye, ScrollText, Paperclip, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COMUNICADO_TIPO_OPTIONS, labelComunicadoTipo } from '@/modules/comunicacao-interna/comunicadoTipo';
import { ComunicadoConteudoEditor } from '@/modules/comunicacao-interna/ComunicadoConteudoEditor';
import { comunicadoConteudoToEditorHtml, comunicadoConteudoToPlainText } from '@/modules/comunicacao-interna/comunicadoConteudoHtml';
import {
  podePublicarEmMultiplasEmpresas,
  resolveEmpresaIdsParaPublicacao,
  empresaIdsActivos,
  type AlcancePublicacaoModo,
} from '@/modules/comunicacao-interna/publicacaoAlcanceEmpresas';
import { PublicacaoAlcanceEmpresasFields } from '@/modules/comunicacao-interna/PublicacaoAlcanceEmpresasFields';

const NOTIF_TARGET_PROFILES = ['Admin', 'PCA', 'Planeamento', 'Director', 'RH', 'Financeiro', 'Contabilidade', 'Secretaria', 'Juridico'];

const LIST_PATH = '/comunicacao-interna/comunicados';
const NOVO_PATH = '/comunicacao-interna/comunicados/novo';

const MAX_ANEXO_BYTES = 15 * 1024 * 1024;

function formatDatetimeLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

const emptyForm: Omit<Comunicado, 'id' | 'empresaId'> = {
  titulo: '',
  resumo: '',
  conteudo: '',
  tipo: 'outro',
  anexoUrl: null,
  anexoNome: null,
  publicadoEm: formatDatetimeLocal(new Date()),
};

export default function ComunicadosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.perfil === 'Admin';
  const podeMultiEmpresas = useMemo(() => podePublicarEmMultiplasEmpresas(user), [user]);

  const { currentEmpresaId } = useTenant();
  const empresaIdForMutation = typeof currentEmpresaId === 'number' ? currentEmpresaId : null;

  const { comunicados, empresas, addComunicado, updateComunicado, deleteComunicado } = useData();
  const { addNotification } = useNotifications();

  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<ComunicadoTipo | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Comunicado | null>(null);
  const [form, setForm] = useState<Omit<Comunicado, 'id' | 'empresaId'>>(emptyForm);
  const [anexoDragActive, setAnexoDragActive] = useState(false);
  const anexoDragDepth = useRef(0);
  const anexoFileInputRef = useRef<HTMLInputElement>(null);
  const [editorMountKey, setEditorMountKey] = useState(0);
  const [alcanceModo, setAlcanceModo] = useState<AlcancePublicacaoModo>('empresa_actual');
  const [umaEmpresaId, setUmaEmpresaId] = useState<number | null>(null);
  const [empresasEscolhidas, setEmpresasEscolhidas] = useState<number[]>([]);

  const prepareCreate = useCallback(() => {
    if (!isAdmin) {
      navigate(LIST_PATH, { replace: true });
      return;
    }
    if (!podeMultiEmpresas && !empresaIdForMutation) {
      toast.error('Para criar comunicados, selecione uma empresa (não use “consolidado”).');
      navigate(LIST_PATH, { replace: true });
      return;
    }
    const activos = empresaIdsActivos(empresas);
    setEditing(null);
    setForm({ ...emptyForm, publicadoEm: formatDatetimeLocal(new Date()) });
    anexoDragDepth.current = 0;
    setAnexoDragActive(false);
    setEditorMountKey(k => k + 1);
    if (podeMultiEmpresas) {
      if (typeof currentEmpresaId === 'number') {
        setAlcanceModo('empresa_actual');
        setUmaEmpresaId(currentEmpresaId);
        setEmpresasEscolhidas([currentEmpresaId]);
      } else {
        setAlcanceModo('todas_empresas');
        setUmaEmpresaId(activos[0] ?? null);
        setEmpresasEscolhidas([]);
      }
    } else {
      setAlcanceModo('empresa_actual');
      setUmaEmpresaId(null);
      setEmpresasEscolhidas([]);
    }
  }, [currentEmpresaId, empresas, empresaIdForMutation, isAdmin, navigate, podeMultiEmpresas]);

  const resetModal = useCallback(() => {
    setEditing(null);
    setForm({ ...emptyForm, publicadoEm: formatDatetimeLocal(new Date()) });
    anexoDragDepth.current = 0;
    setAnexoDragActive(false);
    setEditorMountKey(k => k + 1);
    const activos = empresaIdsActivos(empresas);
    if (podeMultiEmpresas) {
      if (typeof currentEmpresaId === 'number') {
        setAlcanceModo('empresa_actual');
        setUmaEmpresaId(currentEmpresaId);
        setEmpresasEscolhidas([currentEmpresaId]);
      } else {
        setAlcanceModo('todas_empresas');
        setUmaEmpresaId(activos[0] ?? null);
        setEmpresasEscolhidas([]);
      }
    } else {
      setAlcanceModo('empresa_actual');
      setUmaEmpresaId(null);
      setEmpresasEscolhidas([]);
    }
  }, [currentEmpresaId, empresas, podeMultiEmpresas]);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...comunicados]
      .filter(c => {
        if (tipoFiltro !== 'todos' && c.tipo !== tipoFiltro) return false;
        if (!q) return true;
        const blob = `${c.titulo} ${c.resumo} ${comunicadoConteudoToPlainText(c.conteudo)}`.toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => new Date(b.publicadoEm).getTime() - new Date(a.publicadoEm).getTime());
  }, [comunicados, search, tipoFiltro]);

  const openCreate = () => {
    if (!isAdmin) return;
    if (!podeMultiEmpresas && !empresaIdForMutation) {
      toast.error('Para criar comunicados, selecione uma empresa (não use “consolidado”).');
      return;
    }
    openCreateNavigateOrDialog();
  };

  const getDraftStorageEmpresaId = (): number | null => {
    if (editing?.empresaId != null) return editing.empresaId;
    if (!podeMultiEmpresas && empresaIdForMutation != null) return empresaIdForMutation;
    if (podeMultiEmpresas) {
      if (alcanceModo === 'empresa_actual' && typeof currentEmpresaId === 'number') return currentEmpresaId;
      if (alcanceModo === 'uma_empresa') return umaEmpresaId;
      if (alcanceModo === 'empresas_escolhidas' && empresasEscolhidas.length) return empresasEscolhidas[0];
      if (alcanceModo === 'todas_empresas') {
        const a = empresaIdsActivos(empresas);
        return a[0] ?? null;
      }
    }
    return empresaIdForMutation;
  };

  const openEdit = (c: Comunicado) => {
    if (!isAdmin) return;
    setEditing(c);
    setForm({
      titulo: c.titulo,
      resumo: c.resumo ?? '',
      conteudo: comunicadoConteudoToEditorHtml(c.conteudo ?? ''),
      tipo: c.tipo,
      anexoUrl: c.anexoUrl ?? null,
      anexoNome: c.anexoNome ?? null,
      publicadoEm: formatDatetimeLocal(new Date(c.publicadoEm)),
    });
    anexoDragDepth.current = 0;
    setAnexoDragActive(false);
    setEditorMountKey(k => k + 1);
    setDialogOpen(true);
  };

  const uploadAnexo = async (file: File) => {
    if (!isSupabaseConfigured() || !supabase) {
      toast.error('Upload de anexo requer Supabase configurado.');
      return;
    }
    if (file.size > MAX_ANEXO_BYTES) {
      toast.error('Ficheiro demasiado grande (máx. 15 MB).');
      return;
    }
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const baseId = editing?.id ?? Date.now();
      const companyPart = String(getDraftStorageEmpresaId() ?? editing?.empresaId ?? '0');
      const path = `comunicacao/${companyPart}/comunicados/c-${baseId}-${Date.now()}.${ext}`;
      const bucket = 'comunicados';
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error || !data?.path) throw new Error(error?.message || 'Erro ao fazer upload');
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path);
      setForm(f => ({ ...f, anexoUrl: pub.publicUrl, anexoNome: file.name }));
      toast.success('Anexo carregado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível carregar o anexo.');
    }
  };

  const save = async () => {
    if (!isAdmin) return;
    let targetEmpresaIds: number[] | null = null;
    if (!editing) {
      const r = resolveEmpresaIdsParaPublicacao({
        podeMulti: podeMultiEmpresas,
        modo: alcanceModo,
        empresaIdContexto: empresaIdForMutation,
        umaEmpresaId,
        empresasEscolhidas,
        todasEmpresasActivasIds: empresaIdsActivos(empresas),
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      targetEmpresaIds = r.ids;
    }
    const titulo = form.titulo.trim();
    if (!titulo) {
      toast.error('O título é obrigatório.');
      return;
    }

    const dt = new Date(form.publicadoEm);
    if (Number.isNaN(dt.getTime())) {
      toast.error('Data/hora de publicação inválida.');
      return;
    }

    const payload: Partial<Comunicado> = {
      titulo,
      resumo: (form.resumo ?? '').trim(),
      conteudo: (form.conteudo ?? '').trim(),
      tipo: form.tipo,
      anexoUrl: form.anexoUrl ?? null,
      anexoNome: form.anexoNome ?? null,
      publicadoEm: dt.toISOString(),
    };

    try {
      if (editing) {
        await updateComunicado(editing.id, payload);
        toast.success('Comunicado actualizado.');
        setDialogOpen(false);
        setEditing(null);
      } else {
        const ids = targetEmpresaIds!;
        const createdList: Comunicado[] = [];
        for (const empresaId of ids) {
          const created = await addComunicado({
            empresaId,
            ...payload,
          });
          createdList.push(created);
        }

        if (createdList.length) {
          addNotification({
            tipo: 'info',
            titulo: ids.length > 1 ? 'Novos comunicados' : 'Novo comunicado',
            mensagem:
              ids.length > 1
                ? `Foram publicados ${ids.length} comunicados: ${titulo}`
                : `Foi publicado: ${createdList[0].titulo}`,
            moduloOrigem: 'comunicacao-interna',
            destinatarioPerfil: NOTIF_TARGET_PROFILES,
            link: `/comunicacao-interna/comunicados/${createdList[0].id}`,
          });
        }

        toast.success(ids.length > 1 ? `Criados ${ids.length} comunicados.` : 'Comunicado criado.');

        setDialogOpen(false);
        setEditing(null);
        if (isNovoRoute) {
          endMobileCreateFlow();
          navigate(LIST_PATH, { replace: true });
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar comunicado.');
    }
  };

  const remove = async (c: Comunicado) => {
    if (!isAdmin) return;
    if (!window.confirm(`Remover comunicado "${c.titulo}"?`)) return;
    try {
      await deleteComunicado(c.id);
      toast.success('Comunicado removido.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover comunicado.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            Comunicados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Feriados, tolerâncias de ponto, avisos internos e documentos oficiais (PDF, Word) em anexo.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Novo comunicado
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar comunicados..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={tipoFiltro} onValueChange={v => setTipoFiltro(v as ComunicadoTipo | 'todos')}>
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {COMUNICADO_TIPO_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div
            key={c.id}
            className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm leading-snug">{c.titulo}</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-primary/40 text-primary shrink-0 max-w-[9rem] truncate">
                  {labelComunicadoTipo(c.tipo)}
                </span>
              </div>

              {c.resumo ? (
                <p className="text-xs text-muted-foreground line-clamp-3">{c.resumo}</p>
              ) : (
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {comunicadoConteudoToPlainText(c.conteudo) || '—'}
                </p>
              )}

              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{new Date(c.publicadoEm).toLocaleString('pt-PT')}</span>
                {c.anexoUrl && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Paperclip className="h-3 w-3" />
                    Anexo
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigate(`/comunicacao-interna/comunicados/${c.id}`)}
                  title="Ver"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => void remove(c)}
                      title="Apagar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-sm text-muted-foreground py-10 border border-border/80 rounded-xl bg-card text-center">
            Sem comunicados para este contexto.
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileCreate}
          onCloseMobile={closeMobileCreate}
          moduleKicker="Comunicação Interna"
          screenTitle={editing ? 'Editar comunicado' : 'Novo comunicado'}
          desktopContentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
          desktopHeader={mobileCreateDesktopHeader(
            editing ? 'Editar comunicado' : 'Novo comunicado',
            'Tipo, texto e opcionalmente um documento em anexo (contratação, nomeação, etc.).',
          )}
          formBody={
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Título</Label>
                <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
              </div>

              {editing ? (
                <p className="text-xs text-muted-foreground">
                  Empresa:{' '}
                  <span className="font-medium text-foreground">
                    {empresas.find(e => e.id === editing.empresaId)?.nome ?? `ID ${editing.empresaId}`}
                  </span>
                </p>
              ) : null}

              {!editing && podeMultiEmpresas ? (
                <PublicacaoAlcanceEmpresasFields
                  empresas={empresas}
                  currentEmpresaId={currentEmpresaId}
                  modo={alcanceModo}
                  onModoChange={m => {
                    setAlcanceModo(m);
                    const act = empresaIdsActivos(empresas);
                    if (m === 'empresas_escolhidas' && empresasEscolhidas.length === 0 && typeof currentEmpresaId === 'number') {
                      setEmpresasEscolhidas([currentEmpresaId]);
                    }
                    if (m === 'uma_empresa' && umaEmpresaId == null && act[0] != null) setUmaEmpresaId(act[0]);
                  }}
                  umaEmpresaId={umaEmpresaId}
                  onUmaEmpresaIdChange={setUmaEmpresaId}
                  empresasEscolhidas={empresasEscolhidas}
                  onEmpresasEscolhidasChange={setEmpresasEscolhidas}
                />
              ) : null}

              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as ComunicadoTipo }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMUNICADO_TIPO_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Resumo (opcional)</Label>
                <Textarea
                  value={form.resumo ?? ''}
                  onChange={e => setForm(f => ({ ...f, resumo: e.target.value }))}
                  rows={2}
                  placeholder="Uma linha para a listagem…"
                />
              </div>

              <div className="grid gap-2">
                <Label>Texto do comunicado</Label>
                <ComunicadoConteudoEditor
                  key={editorMountKey}
                  value={form.conteudo ?? ''}
                  onChange={html => setForm(f => ({ ...f, conteudo: html }))}
                />
              </div>

              <div className="grid gap-2">
                <Label>Data/hora de publicação</Label>
                <Input
                  type="datetime-local"
                  value={form.publicadoEm}
                  onChange={e => setForm(f => ({ ...f, publicadoEm: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label>Anexo (PDF, Word, etc.)</Label>
                <div
                  className={cn(
                    'cursor-pointer rounded-lg border-2 border-dashed px-3 py-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    anexoDragActive
                      ? 'border-primary bg-primary/10'
                      : 'border-border/80 bg-muted/20 hover:border-muted-foreground/40 hover:bg-muted/30',
                  )}
                  onClick={() => anexoFileInputRef.current?.click()}
                  onDragEnter={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    anexoDragDepth.current += 1;
                    setAnexoDragActive(true);
                  }}
                  onDragLeave={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    anexoDragDepth.current -= 1;
                    if (anexoDragDepth.current <= 0) {
                      anexoDragDepth.current = 0;
                      setAnexoDragActive(false);
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
                    anexoDragDepth.current = 0;
                    setAnexoDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void uploadAnexo(file);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      anexoFileInputRef.current?.click();
                    }
                  }}
                >
                  <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-medium text-foreground">
                    {form.anexoUrl ? 'Arraste outro ficheiro ou clique para substituir' : 'Arraste o documento aqui ou clique para seleccionar'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF, Word — máximo 15 MB</p>
                  <input
                    ref={anexoFileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) void uploadAnexo(file);
                      e.target.value = '';
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  O ficheiro fica disponível para download na ficha do comunicado.
                </div>
                {form.anexoUrl && (
                  <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-sm">
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{form.anexoNome || 'Anexo'}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Remover anexo"
                      onClick={e => {
                        e.stopPropagation();
                        setForm(f => ({ ...f, anexoUrl: null, anexoNome: null }));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          }
          desktopFooter={
            <DialogFooter>
              <Button variant="outline" onClick={() => onDialogOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void save()} className="bg-primary text-primary-foreground">
                {editing ? 'Guardar alterações' : 'Criar comunicado'}
              </Button>
            </DialogFooter>
          }
          mobileFooter={
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-xl" onClick={closeMobileCreate}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1 rounded-xl bg-primary text-primary-foreground"
                onClick={() => void save()}
              >
                {editing ? 'Guardar alterações' : 'Criar comunicado'}
              </Button>
            </div>
          }
        />
      </Dialog>
    </div>
  );
}
