import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useData } from '@/context/DataContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { GestaoDocumentoArquivo, GestaoDocumentoPasta, GestaoDocumentoAuditoria } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Folder,
  Upload,
  Search,
  Trash2,
  Eye,
  Download,
  History,
  Plus,
  ChevronRight,
  LayoutGrid,
  List,
  SlidersHorizontal,
  MoreVertical,
  Pencil,
  Move,
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const BUCKET = 'gestao-documentos';

const MODULO_OPTIONS = [
  { value: 'capital-humano', label: 'Capital Humano' },
  { value: 'financas', label: 'Finanças' },
  { value: 'contabilidade', label: 'Contabilidade' },
  { value: 'secretaria', label: 'Secretaria Geral' },
  { value: 'juridico', label: 'Jurídico' },
  { value: 'planeamento', label: 'Planeamento' },
  { value: 'comunicacao-interna', label: 'Comunicação Interna' },
  { value: 'conselho-administracao', label: 'Conselho de Administração' },
] as const;

const ORIGEM_NONE = '__origem_none__';

const ORIGEM_MODULO_OPTIONS = [
  { value: ORIGEM_NONE, label: '— Não especificado —' },
  { value: 'juridico', label: 'Jurídico (contratos / processos)' },
  { value: 'capital-humano', label: 'RH (colaboradores)' },
  { value: 'financas', label: 'Finanças (comprovativos)' },
  { value: 'secretaria', label: 'Secretaria / workflow' },
  { value: 'planeamento', label: 'Planeamento' },
];

const ALLOWED_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx']);

function mapPasta(r: Record<string, unknown>): GestaoDocumentoPasta {
  return {
    id: r.id as number,
    empresaId: r.empresa_id as number,
    parentId: (r.parent_id as number | null) ?? null,
    nome: r.nome as string,
    ordem: (r.ordem as number) ?? 0,
    modulosAcesso: (r.modulos_acesso as string[]) ?? [],
    sectoresAcesso: (r.sectores_acesso as string[]) ?? [],
    createdAt: r.created_at as string,
  };
}

function mapArquivo(r: Record<string, unknown>): GestaoDocumentoArquivo {
  return {
    id: r.id as number,
    empresaId: r.empresa_id as number,
    pastaId: r.pasta_id as number,
    titulo: r.titulo as string,
    observacao: (r.observacao as string) ?? '',
    storagePath: r.storage_path as string,
    nomeFicheiro: r.nome_ficheiro as string,
    mimeType: (r.mime_type as string) ?? '',
    tamanhoBytes: Number(r.tamanho_bytes ?? 0),
    tipoFicheiro: (r.tipo_ficheiro as string) ?? '',
    modulosAcesso: (r.modulos_acesso as string[]) ?? [],
    sectoresAcesso: (r.sectores_acesso as string[]) ?? [],
    origemModulo: (r.origem_modulo as string | null) ?? null,
    uploadedBy: (r.uploaded_by as number | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapAudit(r: Record<string, unknown>): GestaoDocumentoAuditoria {
  return {
    id: r.id as number,
    arquivoId: r.arquivo_id as number,
    profileId: (r.profile_id as number | null) ?? null,
    accao: r.accao as GestaoDocumentoAuditoria['accao'],
    detalhe: (r.detalhe as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  };
}

function labelAccaoGestao(accao: string): string {
  const map: Record<string, string> = {
    upload: 'Carregamento',
    view: 'Visualização',
    download: 'Descarga',
    delete: 'Eliminação',
    move: 'Movido',
  };
  return map[accao] ?? accao;
}

function extensaoDeNome(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : '';
}

/** Nome do ficheiro sem extensão, normalizado e em maiúsculas (pt), para sugerir título ao anexar. */
function tituloSugeridoDeNomeArquivo(nome: string): string {
  const i = nome.lastIndexOf('.');
  const base = i >= 0 ? nome.slice(0, i) : nome;
  const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.toLocaleUpperCase('pt-PT');
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeFileName(n: string): string {
  return n.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
}

type TreeNode = GestaoDocumentoPasta & { children: TreeNode[] };

function buildTree(pastas: GestaoDocumentoPasta[]): TreeNode[] {
  const byParent = new Map<number | null, GestaoDocumentoPasta[]>();
  for (const p of pastas) {
    const k = p.parentId;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(p);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'));
  }
  const walk = (parentId: number | null): TreeNode[] => {
    const list = byParent.get(parentId) ?? [];
    return list.map(p => ({
      ...p,
      children: walk(p.id),
    }));
  };
  return walk(null);
}

/** Pasta `rootId` e todas as subpastas (para eliminar ficheiros antes do DELETE em cascata). */
function collectSubtreeFolderIds(rootId: number, allPastas: GestaoDocumentoPasta[]): number[] {
  const byParent = new Map<number | null, number[]>();
  for (const p of allPastas) {
    const k = p.parentId;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(p.id);
  }
  const out: number[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    for (const cid of byParent.get(id) ?? []) stack.push(cid);
  }
  return out;
}

function findNodeById(nodes: TreeNode[], id: number): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const inner = findNodeById(n.children, id);
    if (inner) return inner;
  }
  return null;
}

function getBreadcrumbTrail(
  currentId: number | null,
  pastas: GestaoDocumentoPasta[],
): { id: number | null; nome: string }[] {
  const root = { id: null as number | null, nome: 'Documentos' };
  if (currentId == null) return [root];
  const byId = new Map(pastas.map(p => [p.id, p]));
  const chain: { id: number; nome: string }[] = [];
  let id: number | null = currentId;
  const guard = new Set<number>();
  while (id != null && !guard.has(id)) {
    guard.add(id);
    const p = byId.get(id);
    if (!p) break;
    chain.unshift({ id: p.id, nome: p.nome });
    id = p.parentId;
  }
  return [root, ...chain];
}

function fileExtLabel(tipo: string): string {
  if (tipo === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(tipo)) return 'DOC';
  if (['xls', 'xlsx'].includes(tipo)) return 'XLS';
  return '—';
}

/** Indicador de tipo neutro (sem cores de marca). */
function FileTypeBadge({ tipo, compact }: { tipo: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md border border-border/80 bg-muted/40 font-medium text-muted-foreground shrink-0 tabular-nums',
        compact ? 'h-8 w-9 text-[10px]' : 'h-11 w-12 text-xs',
      )}
    >
      {fileExtLabel(tipo)}
    </div>
  );
}

function canManageFolders(perfil: string, empresaId?: number | null): boolean {
  if (perfil === 'Admin') return true;
  if (perfil === 'PCA') return true;
  if (perfil === 'Secretaria' && empresaId != null) return true;
  return false;
}

function canUpload(perfil: string, empresaId?: number | null): boolean {
  if (perfil === 'Admin') return true;
  if (perfil === 'PCA') return true;
  if (empresaId == null) return false;
  return ['Secretaria', 'Financeiro', 'Juridico', 'RH', 'Contabilidade'].includes(perfil);
}

export default function GestaoDocumentosPage() {
  const { user } = useAuth();
  const { currentEmpresaId } = useTenant();
  const { departamentos } = useData();

  const empresaIdNum =
    currentEmpresaId === 'consolidado' ? null : (currentEmpresaId as number);

  const [pastas, setPastas] = useState<GestaoDocumentoPasta[]>([]);
  const [arquivos, setArquivos] = useState<GestaoDocumentoArquivo[]>([]);
  const [selectedPastaId, setSelectedPastaId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [qTitulo, setQTitulo] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroModulo, setFiltroModulo] = useState<string>('todos');
  const [filtroSector, setFiltroSector] = useState<string>('todos');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [novaPastaOpen, setNovaPastaOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<GestaoDocumentoAuditoria[]>([]);
  const [auditArquivoTitulo, setAuditArquivoTitulo] = useState('');

  const [formTitulo, setFormTitulo] = useState('');
  const [formObs, setFormObs] = useState('');
  const [formPastaId, setFormPastaId] = useState<number | null>(null);
  const [formModulos, setFormModulos] = useState<string[]>([]);
  const [formSectores, setFormSectores] = useState<string[]>([]);
  const [formOrigem, setFormOrigem] = useState(ORIGEM_NONE);
  const [formFile, setFormFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [novaPastaNome, setNovaPastaNome] = useState('');
  const [novaPastaParentId, setNovaPastaParentId] = useState<number | null>(null);
  const [novaPastaModulos, setNovaPastaModulos] = useState<string[]>([]);
  const [novaPastaSectores, setNovaPastaSectores] = useState<string[]>([]);
  const [deletingPasta, setDeletingPasta] = useState(false);

  const [editPastaOpen, setEditPastaOpen] = useState(false);
  const [editPastaId, setEditPastaId] = useState<number | null>(null);
  const [editPastaNome, setEditPastaNome] = useState('');
  const [editPastaModulos, setEditPastaModulos] = useState<string[]>([]);
  const [editPastaSectores, setEditPastaSectores] = useState<string[]>([]);
  const [savingPastaEdit, setSavingPastaEdit] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [moverOpen, setMoverOpen] = useState(false);
  const [moverArquivo, setMoverArquivo] = useState<GestaoDocumentoArquivo | null>(null);
  const [moverDestinoPastaId, setMoverDestinoPastaId] = useState<number | null>(null);
  const [savingMover, setSavingMover] = useState(false);

  const tree = useMemo(() => buildTree(pastas), [pastas]);

  const childFolders = useMemo((): TreeNode[] => {
    if (selectedPastaId == null) return tree;
    return findNodeById(tree, selectedPastaId)?.children ?? [];
  }, [tree, selectedPastaId]);

  const breadcrumbTrail = useMemo(
    () => getBreadcrumbTrail(selectedPastaId, pastas),
    [selectedPastaId, pastas],
  );

  const filtrosActivosCount = useMemo(() => {
    let n = 0;
    if (qTitulo.trim()) n++;
    if (filtroTipo !== 'todos') n++;
    if (filtroModulo !== 'todos') n++;
    if (filtroSector !== 'todos') n++;
    if (dataDe) n++;
    if (dataAte) n++;
    return n;
  }, [qTitulo, filtroTipo, filtroModulo, filtroSector, dataDe, dataAte]);

  const nomesDepartamentos = useMemo(
    () => [...new Set(departamentos.map(d => d.nome).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')),
    [departamentos],
  );

  const loadAll = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase || empresaIdNum == null) {
      setPastas([]);
      setArquivos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: pRows, error: e1 }, { data: aRows, error: e2 }] = await Promise.all([
        supabase
          .from('gestao_documentos_pastas')
          .select('*')
          .eq('empresa_id', empresaIdNum)
          .order('ordem')
          .order('nome'),
        supabase.from('gestao_documentos_arquivos').select('*').eq('empresa_id', empresaIdNum),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setPastas((pRows ?? []).map(r => mapPasta(r as Record<string, unknown>)));
      setArquivos((aRows ?? []).map(r => mapArquivo(r as Record<string, unknown>)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [empresaIdNum]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const pastaNomeById = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of pastas) m.set(p.id, p.nome);
    return m;
  }, [pastas]);

  const pastaPathById = useMemo(() => {
    const byId = new Map(pastas.map(p => [p.id, p]));
    const path = (id: number): string => {
      const parts: string[] = [];
      let c: GestaoDocumentoPasta | undefined = byId.get(id);
      const guard = new Set<number>();
      while (c && !guard.has(c.id)) {
        guard.add(c.id);
        parts.unshift(c.nome);
        c = c.parentId != null ? byId.get(c.parentId) : undefined;
      }
      return parts.join(' / ');
    };
    const m = new Map<number, string>();
    for (const p of pastas) m.set(p.id, path(p.id));
    return m;
  }, [pastas]);

  const arquivosFiltrados = useMemo(() => {
    let list = arquivos;
    if (selectedPastaId != null) {
      list = list.filter(a => a.pastaId === selectedPastaId);
    }
    const qt = qTitulo.trim().toLowerCase();
    if (qt) list = list.filter(a => a.titulo.toLowerCase().includes(qt) || a.nomeFicheiro.toLowerCase().includes(qt));
    if (filtroTipo !== 'todos') {
      list = list.filter(a => a.tipoFicheiro === filtroTipo);
    }
    if (filtroModulo !== 'todos') {
      list = list.filter(
        a => a.modulosAcesso.length === 0 || a.modulosAcesso.includes(filtroModulo),
      );
    }
    if (filtroSector !== 'todos') {
      list = list.filter(
        a => a.sectoresAcesso.length === 0 || a.sectoresAcesso.includes(filtroSector),
      );
    }
    if (dataDe) {
      const t = new Date(dataDe).getTime();
      list = list.filter(a => new Date(a.createdAt).getTime() >= t);
    }
    if (dataAte) {
      const t = new Date(dataAte).getTime() + 86400000;
      list = list.filter(a => new Date(a.createdAt).getTime() < t);
    }
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [arquivos, selectedPastaId, qTitulo, filtroTipo, filtroModulo, filtroSector, dataDe, dataAte]);

  const logAudit = async (
    arquivoId: number,
    accao: GestaoDocumentoAuditoria['accao'],
    detalhe: Record<string, unknown> = {},
  ) => {
    if (!supabase || !user?.id) return null;
    const { error } = await supabase.from('gestao_documentos_auditoria').insert({
      arquivo_id: arquivoId,
      profile_id: user.id,
      accao,
      detalhe,
    });
    return error;
  };

  const publicUrl = (path: string) => {
    if (!supabase) return '';
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const abrirVer = async (a: GestaoDocumentoArquivo) => {
    const url = publicUrl(a.storagePath);
    if (!url) return;
    await logAudit(a.id, 'view', { nome: a.nomeFicheiro });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const abrirDownload = async (a: GestaoDocumentoArquivo) => {
    const url = publicUrl(a.storagePath);
    if (!url) return;
    await logAudit(a.id, 'download', { nome: a.nomeFicheiro });
    const link = document.createElement('a');
    link.href = url;
    link.download = a.nomeFicheiro;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const abrirAuditoria = async (a: GestaoDocumentoArquivo) => {
    if (!supabase) return;
    setAuditArquivoTitulo(a.titulo);
    const { data, error } = await supabase
      .from('gestao_documentos_auditoria')
      .select('*')
      .eq('arquivo_id', a.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAuditRows((data ?? []).map(r => mapAudit(r as Record<string, unknown>)));
    setAuditOpen(true);
  };

  const eliminarArquivo = async (a: GestaoDocumentoArquivo) => {
    if (!supabase) return;
    if (!window.confirm(`Eliminar o documento "${a.titulo}"?`)) return;
    try {
      await logAudit(a.id, 'delete', { nome: a.nomeFicheiro });
      const { error: st } = await supabase.storage.from(BUCKET).remove([a.storagePath]);
      if (st) console.warn(st);
      const { error } = await supabase.from('gestao_documentos_arquivos').delete().eq('id', a.id);
      if (error) throw error;
      toast.success('Documento eliminado.');
      void loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao eliminar');
    }
  };

  const openMover = (a: GestaoDocumentoArquivo) => {
    setMoverArquivo(a);
    const alt = pastas.find(p => p.id !== a.pastaId);
    setMoverDestinoPastaId(alt?.id ?? null);
    setMoverOpen(true);
  };

  const executarMover = async () => {
    if (!supabase || !moverArquivo || moverDestinoPastaId == null || empresaIdNum == null) {
      toast.error('Seleccione a pasta de destino.');
      return;
    }
    if (moverDestinoPastaId === moverArquivo.pastaId) {
      toast.error('Escolha uma pasta diferente da actual.');
      return;
    }
    const destPasta = pastas.find(p => p.id === moverDestinoPastaId);
    if (!destPasta || destPasta.empresaId !== moverArquivo.empresaId) {
      toast.error('Pasta de destino inválida.');
      return;
    }
    setSavingMover(true);
    try {
      const fromPath = pastaPathById.get(moverArquivo.pastaId) ?? '';
      const toPath = pastaPathById.get(moverDestinoPastaId) ?? '';
      const { data, error } = await supabase
        .from('gestao_documentos_arquivos')
        .update({ pasta_id: moverDestinoPastaId, updated_at: new Date().toISOString() })
        .eq('id', moverArquivo.id)
        .eq('empresa_id', empresaIdNum)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (data == null) {
        toast.error(
          'Não foi possível mover (0 linhas). Confirme permissões de gestão documental e políticas RLS.',
        );
        return;
      }
      const auditErr = await logAudit(moverArquivo.id, 'move', {
        de_pasta_id: moverArquivo.pastaId,
        de_pasta_caminho: fromPath,
        para_pasta_id: moverDestinoPastaId,
        para_pasta_caminho: toPath,
        titulo: moverArquivo.titulo,
      });
      if (auditErr) {
        console.warn(auditErr);
        toast.success('Documento movido.', {
          description:
            'O registo de auditoria não foi gravado. Execute a migração 20260320000024_gestao_documentos_auditoria_accao_move.sql no Supabase (acção "move").',
          duration: 12_000,
        });
      } else {
        toast.success('Documento movido.');
      }
      setMoverOpen(false);
      setMoverArquivo(null);
      void loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao mover o documento');
    } finally {
      setSavingMover(false);
    }
  };

  const guardarUpload = async () => {
    if (!supabase || empresaIdNum == null || !user?.id || formPastaId == null) {
      toast.error('Seleccione uma pasta e ficheiro.');
      return;
    }
    const f = formFile;
    if (!f || !formTitulo.trim()) {
      toast.error('Título e ficheiro são obrigatórios.');
      return;
    }
    const ext = extensaoDeNome(f.name);
    if (!ALLOWED_EXT.has(ext)) {
      toast.error('Formato não permitido. Use PDF, Word ou Excel.');
      return;
    }
    setSaving(true);
    try {
      const safe = sanitizeFileName(f.name);
      const objectPath = `${crypto.randomUUID()}_${safe}`;
      const fullPath = `${empresaIdNum}/${objectPath}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(fullPath, f, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: ins, error: insErr } = await supabase
        .from('gestao_documentos_arquivos')
        .insert({
          empresa_id: empresaIdNum,
          pasta_id: formPastaId,
          titulo: formTitulo.trim(),
          observacao: formObs.trim(),
          storage_path: fullPath,
          nome_ficheiro: f.name,
          mime_type: f.type || 'application/octet-stream',
          tamanho_bytes: f.size,
          tipo_ficheiro: ext,
          modulos_acesso: formModulos,
          sectores_acesso: formSectores,
          origem_modulo: formOrigem === ORIGEM_NONE ? null : formOrigem,
          uploaded_by: user.id,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      const newId = (ins as { id: number }).id;
      await supabase.from('gestao_documentos_auditoria').insert({
        arquivo_id: newId,
        profile_id: user.id,
        accao: 'upload',
        detalhe: { nome: f.name, titulo: formTitulo.trim() },
      });
      toast.success('Documento carregado.');
      setUploadOpen(false);
      setFormTitulo('');
      setFormObs('');
      setFormFile(null);
      setFormModulos([]);
      setFormSectores([]);
      setFormOrigem(ORIGEM_NONE);
      void loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro no upload');
    } finally {
      setSaving(false);
    }
  };

  const criarPasta = async () => {
    if (!supabase || empresaIdNum == null || !novaPastaNome.trim()) return;
    try {
      const { error } = await supabase.from('gestao_documentos_pastas').insert({
        empresa_id: empresaIdNum,
        parent_id: novaPastaParentId,
        nome: novaPastaNome.trim(),
        ordem: 99,
        modulos_acesso: novaPastaModulos,
        sectores_acesso: novaPastaSectores,
      });
      if (error) throw error;
      toast.success('Pasta criada.');
      setNovaPastaOpen(false);
      setNovaPastaNome('');
      setNovaPastaModulos([]);
      setNovaPastaSectores([]);
      void loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar pasta');
    }
  };

  const eliminarPasta = async (pastaId: number) => {
    if (!supabase || empresaIdNum == null || !user?.id) return;
    const nome = pastas.find(p => p.id === pastaId)?.nome ?? 'esta pasta';
    const folderIds = collectSubtreeFolderIds(pastaId, pastas);
    const filesInTree = arquivos.filter(a => folderIds.includes(a.pastaId));
    const subCount = folderIds.length - 1;
    const msg =
      filesInTree.length === 0 && subCount === 0
        ? `Eliminar a pasta "${nome}"?`
        : `Eliminar a pasta "${nome}"${subCount > 0 ? ` e ${subCount} subpasta(s)` : ''}${filesInTree.length > 0 ? ` e ${filesInTree.length} documento(s)` : ''}? Esta acção não pode ser anulada.`;
    if (!window.confirm(msg)) return;
    setDeletingPasta(true);
    try {
      for (const a of filesInTree) {
        await logAudit(a.id, 'delete', {
          nome: a.nomeFicheiro,
          motivo: 'eliminação de pasta',
          pasta_alvo: pastaId,
        });
      }
      const paths = filesInTree.map(a => a.storagePath).filter(Boolean);
      if (paths.length > 0) {
        const { error: stErr } = await supabase.storage.from(BUCKET).remove(paths);
        if (stErr) console.warn(stErr);
      }
      if (filesInTree.length > 0) {
        const { error: delA } = await supabase
          .from('gestao_documentos_arquivos')
          .delete()
          .in(
            'id',
            filesInTree.map(a => a.id),
          );
        if (delA) throw delA;
      }
      const { error: delP } = await supabase.from('gestao_documentos_pastas').delete().eq('id', pastaId);
      if (delP) throw delP;
      toast.success('Pasta eliminada.');
      setSelectedPastaId(prev => (prev != null && folderIds.includes(prev) ? null : prev));
      void loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao eliminar pasta');
    } finally {
      setDeletingPasta(false);
    }
  };

  const toggleModulo = (v: string) => {
    setFormModulos(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));
  };

  const toggleSector = (v: string) => {
    setFormSectores(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));
  };

  const toggleNovaPastaModulo = (v: string) => {
    setNovaPastaModulos(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));
  };
  const toggleNovaPastaSector = (v: string) => {
    setNovaPastaSectores(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));
  };
  const toggleEditPastaModulo = (v: string) => {
    setEditPastaModulos(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));
  };
  const toggleEditPastaSector = (v: string) => {
    setEditPastaSectores(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));
  };

  const openEditPasta = (p: GestaoDocumentoPasta) => {
    setEditPastaId(p.id);
    setEditPastaNome(p.nome);
    setEditPastaModulos([...p.modulosAcesso]);
    setEditPastaSectores([...p.sectoresAcesso]);
    setEditPastaOpen(true);
  };

  const isGestaoPastasPermColumnsMissing = (msg: string) =>
    /modulos_acesso|sectores_acesso|column.*does not exist|Could not find the/i.test(msg);

  const salvarEdicaoPasta = async () => {
    if (!supabase || editPastaId == null || !editPastaNome.trim()) return;
    setSavingPastaEdit(true);
    try {
      const nomeTrim = editPastaNome.trim();
      const payloadFull = {
        nome: nomeTrim,
        modulos_acesso: editPastaModulos,
        sectores_acesso: editPastaSectores,
      };
      let { data, error } = await supabase
        .from('gestao_documentos_pastas')
        .update(payloadFull)
        .eq('id', editPastaId)
        .select('id')
        .maybeSingle();

      // Sem migração 22: colunas inexistentes — tentar guardar só o nome para o Admin não ficar bloqueado.
      if (error) {
        const msg =
          typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: string }).message)
            : 'Erro desconhecido';
        if (isGestaoPastasPermColumnsMissing(msg)) {
          const retry = await supabase
            .from('gestao_documentos_pastas')
            .update({ nome: nomeTrim })
            .eq('id', editPastaId)
            .select('id')
            .maybeSingle();
          data = retry.data;
          error = retry.error;
          if (!error && data != null) {
            toast.success('Nome da pasta actualizado.', {
              description:
                'As permissões por módulo/sector não foram gravadas: execute no Supabase o ficheiro supabase/migrations/20260320000022_gestao_documentos_pastas_permissoes.sql (SQL Editor ou supabase db push).',
              duration: 12_000,
            });
            setEditPastaOpen(false);
            setEditPastaId(null);
            void loadAll();
            return;
          }
        }
      }

      if (error) {
        const msg =
          typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: string }).message)
            : 'Erro desconhecido';
        const hint =
          typeof error === 'object' && error !== null && 'hint' in error && (error as { hint?: string }).hint
            ? ` ${(error as { hint: string }).hint}`
            : '';
        const details =
          typeof error === 'object' && error !== null && 'details' in error && (error as { details?: string }).details
            ? ` (${(error as { details: string }).details})`
            : '';
        if (isGestaoPastasPermColumnsMissing(msg)) {
          toast.error(
            'Aplique a migração de permissões nas pastas: ficheiro 20260320000022_gestao_documentos_pastas_permissoes.sql (colunas modulos_acesso / sectores_acesso). SQL Editor ou: supabase db push.',
            { duration: 14_000 },
          );
        } else if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')) {
          toast.error('Já existe uma pasta com este nome no mesmo nível. Escolha outro nome.');
        } else {
          toast.error(`${msg}${details}${hint}`);
        }
        return;
      }
      if (data == null) {
        toast.error(
          'Não foi possível guardar (0 linhas actualizadas). Confirme que é Admin/PCA na mesma empresa da pasta e que as políticas RLS permitem UPDATE.',
        );
        return;
      }
      toast.success('Pasta actualizada.');
      setEditPastaOpen(false);
      setEditPastaId(null);
      void loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar a pasta');
    } finally {
      setSavingPastaEdit(false);
    }
  };

  const openUploadDialog = () => {
    setFormPastaId(selectedPastaId ?? pastas[0]?.id ?? null);
    setFormTitulo('');
    setFormObs('');
    setFormFile(null);
    setFormModulos([]);
    setFormSectores([]);
    setFormOrigem(ORIGEM_NONE);
    setUploadOpen(true);
  };

  if (!user || !hasModuleAccess(user, 'gestao-documentos')) {
    return <p className="text-sm text-muted-foreground">Sem acesso a este módulo.</p>;
  }

  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-muted-foreground">Configure o Supabase para usar a gestão documental.</p>;
  }

  if (currentEmpresaId === 'consolidado') {
    return (
      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-sm">
        <p className="font-medium">Seleccione uma empresa no contexto (topo) para gerir documentos.</p>
        <p className="text-muted-foreground">A gestão documental é por empresa.</p>
      </div>
    );
  }

  const manage = canManageFolders(user.perfil, user.empresaId);
  const uploadOk = canUpload(user.perfil, user.empresaId);
  /** Quem vê documentos nesta empresa pode mover entre pastas (RLS: migração `20260320000025_gestao_arquivos_update_leitores_mover.sql`). */
  const canMoverArquivos = empresaIdNum != null;
  /** Quem pode criar pastas (Admin / PCA / Secretaria) pode também eliminá-las — coerente com RLS `gestao_documentos_pode_gerir`. */
  const canEliminarPastas = manage;
  /** Editar nome e permissões da pasta (RLS: update já permitido a quem gere pastas; UI só Admin). */
  const canEditPastaAdmin = user.perfil === 'Admin';

  const limparFiltros = () => {
    setQTitulo('');
    setFiltroTipo('todos');
    setFiltroModulo('todos');
    setFiltroSector('todos');
    setDataDe('');
    setDataAte('');
  };

  return (
    <>
    <div className="mx-auto max-w-6xl space-y-6 pb-6">
      <div className="border-b border-border/80 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-base font-medium tracking-tight text-foreground">Gestão de Documentos</h1>
            <nav className="flex flex-wrap items-center gap-0.5 text-sm text-muted-foreground" aria-label="Caminho da pasta">
              {breadcrumbTrail.map((seg, i) => (
                <Fragment key={seg.id === null ? 'root' : seg.id}>
                  {i > 0 ? <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0 opacity-50" /> : null}
                  <button
                    type="button"
                    onClick={() => setSelectedPastaId(seg.id)}
                    className={cn(
                      'max-w-[200px] truncate rounded px-0.5 py-0 text-left transition-colors hover:text-foreground',
                      (seg.id === null ? selectedPastaId === null : selectedPastaId === seg.id)
                        ? 'font-medium text-foreground'
                        : 'hover:underline',
                    )}
                  >
                    {seg.nome}
                  </button>
                </Fragment>
              ))}
            </nav>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[280px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Pesquisar…"
                value={qTitulo}
                onChange={e => setQTitulo(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <div className="mr-auto flex rounded-md border border-border p-0.5">
            <Button
              type="button"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('grid')}
              title="Grelha"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('list')}
              title="Lista"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {filtrosActivosCount > 0 ? (
                  <span className="rounded bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">{filtrosActivosCount}</span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(100vw-2rem,360px)] p-3" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground">Filtros</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={limparFiltros}>
                    Limpar
                  </Button>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Tipo de ficheiro</Label>
                    <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="doc">Word (.doc)</SelectItem>
                        <SelectItem value="docx">Word (.docx)</SelectItem>
                        <SelectItem value="xls">Excel (.xls)</SelectItem>
                        <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Módulo (acesso)</Label>
                    <Select value={filtroModulo} onValueChange={setFiltroModulo}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {MODULO_OPTIONS.map(m => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sector</Label>
                    <Select value={filtroSector} onValueChange={setFiltroSector}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {nomesDepartamentos.map(n => (
                          <SelectItem key={n} value={n}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Desde</Label>
                      <Input className="h-9" type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Até</Label>
                      <Input className="h-9" type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {manage ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-normal"
                  onClick={() => {
                    setNovaPastaParentId(selectedPastaId);
                    setNovaPastaModulos([]);
                    setNovaPastaSectores([]);
                    setNovaPastaOpen(true);
                  }}
                >
                  <Folder className="mr-1.5 h-3.5 w-3.5" />
                  Nova pasta
                </Button>
                {canEditPastaAdmin && selectedPastaId != null ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-normal"
                    onClick={() => {
                      const p = pastas.find(x => x.id === selectedPastaId);
                      if (p) openEditPasta(p);
                    }}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar pasta
                  </Button>
                ) : null}
                {canEliminarPastas && selectedPastaId != null ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-normal text-destructive hover:bg-destructive/10"
                    disabled={deletingPasta}
                    onClick={() => void eliminarPasta(selectedPastaId)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Eliminar pasta
                  </Button>
                ) : null}
              </>
            ) : null}
            {uploadOk ? (
              <Button size="sm" className="h-8" onClick={openUploadDialog} disabled={pastas.length === 0}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Carregar
              </Button>
            ) : null}
          </div>
        </div>

      <div className="min-h-[50vh]">
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">A carregar…</p>
        ) : (
          <>
            {childFolders.length > 0 ? (
              <section className="mb-8">
                <p className="mb-2 text-xs text-muted-foreground">Pastas</p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 sm:max-w-3xl">
                  {childFolders.map(folder => (
                    <div key={folder.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setSelectedPastaId(folder.id)}
                        className="flex w-full flex-col items-center rounded-lg border border-transparent px-2 py-3 text-center transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Folder className="mb-1.5 h-8 w-8 text-muted-foreground" />
                        <span className="line-clamp-2 text-xs leading-tight text-foreground">{folder.nome}</span>
                      </button>
                      {canEditPastaAdmin ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-0 top-0 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                          title="Editar pasta"
                          onClick={e => {
                            e.stopPropagation();
                            openEditPasta(folder);
                          }}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      ) : null}
                      {canEliminarPastas ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                          title="Eliminar pasta"
                          disabled={deletingPasta}
                          onClick={e => {
                            e.stopPropagation();
                            void eliminarPasta(folder.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : tree.length === 0 ? (
              <div className="mb-8 rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                Sem pastas. Crie uma ou execute as migrações.
              </div>
            ) : null}

            <section>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Ficheiros
                  <span className="text-foreground/70">
                    {' '}
                    · {selectedPastaId != null ? pastaNomeById.get(selectedPastaId) : 'todas as pastas'}
                  </span>
                </p>
                <span className="text-xs tabular-nums text-muted-foreground">{arquivosFiltrados.length}</span>
              </div>

              {arquivosFiltrados.length === 0 ? (
                <div className="rounded-lg border border-border/60 py-12 text-center text-sm text-muted-foreground">
                  Nenhum documento.
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-3">
                  {arquivosFiltrados.map(a => (
                    <div
                      key={a.id}
                      className="group relative rounded-lg border border-border/60 bg-card/30 p-2.5 transition-colors hover:bg-muted/30"
                    >
                      <button
                        type="button"
                        className="flex w-full flex-col text-left"
                        onDoubleClick={() => void abrirVer(a)}
                      >
                        <div className="mx-auto">
                          <FileTypeBadge tipo={a.tipoFicheiro} />
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs font-medium leading-snug">{a.titulo}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{a.nomeFicheiro}</p>
                        <p className="mt-1.5 text-[10px] text-muted-foreground">
                          {formatBytes(a.tamanhoBytes)} · {format(new Date(a.createdAt), 'd MMM yyyy', { locale: pt })}
                        </p>
                      </button>
                      <div className="absolute right-0.5 top-0.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => void abrirVer(a)}>
                              <Eye className="mr-2 h-3.5 w-3.5" />
                              Abrir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void abrirDownload(a)}>
                              <Download className="mr-2 h-3.5 w-3.5" />
                              Descarregar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void abrirAuditoria(a)}>
                              <History className="mr-2 h-3.5 w-3.5" />
                              Auditoria
                            </DropdownMenuItem>
                            {canMoverArquivos ? (
                              <DropdownMenuItem onClick={() => openMover(a)}>
                                <Move className="mr-2 h-3.5 w-3.5" />
                                Mover para…
                              </DropdownMenuItem>
                            ) : null}
                            {manage ? (
                              <>
                                {canMoverArquivos ? <DropdownMenuSeparator /> : null}
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => void eliminarArquivo(a)}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <div className="hidden grid-cols-[1fr_72px_88px_36px] gap-2 border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground sm:grid">
                    <span>Nome</span>
                    <span className="text-right">Tamanho</span>
                    <span>Data</span>
                    <span />
                  </div>
                  <ul className="divide-y divide-border/60">
                    {arquivosFiltrados.map(a => (
                      <li
                        key={a.id}
                        className="flex flex-col gap-1.5 px-2 py-2 sm:grid sm:grid-cols-[1fr_72px_88px_36px] sm:items-center sm:gap-2 sm:px-3"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 items-center gap-2.5 text-left sm:col-span-1"
                          onDoubleClick={() => void abrirVer(a)}
                        >
                          <FileTypeBadge tipo={a.tipoFicheiro} compact />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{a.titulo}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{a.nomeFicheiro}</p>
                          </div>
                        </button>
                        <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:inline">
                          {formatBytes(a.tamanhoBytes)}
                        </span>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {format(new Date(a.createdAt), 'd MMM yyyy', { locale: pt })}
                        </span>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => void abrirVer(a)}>
                                <Eye className="mr-2 h-3.5 w-3.5" />
                                Abrir
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void abrirDownload(a)}>
                                <Download className="mr-2 h-3.5 w-3.5" />
                                Descarregar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void abrirAuditoria(a)}>
                                <History className="mr-2 h-3.5 w-3.5" />
                                Auditoria
                              </DropdownMenuItem>
                              {canMoverArquivos ? (
                                <DropdownMenuItem onClick={() => openMover(a)}>
                                  <Move className="mr-2 h-3.5 w-3.5" />
                                  Mover para…
                                </DropdownMenuItem>
                              ) : null}
                              {manage ? (
                                <>
                                  {canMoverArquivos ? <DropdownMenuSeparator /> : null}
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => void eliminarArquivo(a)}
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo documento</DialogTitle>
            <DialogDescription>
              PDF, Word ou Excel. Defina quem pode consultar por módulo e por sector (departamento). Deixe vazio para
              permitir a todos os perfis com acesso ao tenant conforme políticas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <Label className="text-base">Ficheiro</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  setFormFile(f);
                  if (f) setFormTitulo(tituloSugeridoDeNomeArquivo(f.name));
                }}
              />
              {formFile ? (
                <p className="text-xs text-muted-foreground">
                  {extensaoDeNome(formFile.name).toUpperCase()} · {formatBytes(formFile.size)}
                </p>
              ) : null}
              <div className="space-y-2 pt-1">
                <Label htmlFor="gestao-doc-upload-titulo">Título</Label>
                <Input
                  id="gestao-doc-upload-titulo"
                  value={formTitulo}
                  onChange={e => setFormTitulo(e.target.value.toLocaleUpperCase('pt-PT'))}
                  placeholder="Ex.: ORÇAMENTO Q1 2026"
                  className="font-medium uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Em maiúsculas; sugerido a partir do nome do ficheiro ao anexar.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pasta</Label>
              <Select
                value={formPastaId != null ? String(formPastaId) : ''}
                onValueChange={v => setFormPastaId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar pasta" />
                </SelectTrigger>
                <SelectContent>
                  {pastas.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {pastaPathById.get(p.id) ?? p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Módulos com acesso</Label>
              <p className="text-xs text-muted-foreground">Vazio = sem restrição extra por módulo (todos os que já vêem o tenant).</p>
              <div className="grid grid-cols-1 gap-2 rounded-md border p-3 max-h-36 overflow-y-auto">
                {MODULO_OPTIONS.map(m => (
                  <label key={m.value} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={formModulos.includes(m.value)} onCheckedChange={() => toggleModulo(m.value)} />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sectores com acesso (departamento)</Label>
              <p className="text-xs text-muted-foreground">Vazio = qualquer departamento.</p>
              <div className="grid grid-cols-1 gap-2 rounded-md border p-3 max-h-32 overflow-y-auto">
                {nomesDepartamentos.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Cadastre departamentos em Configurações.</span>
                ) : (
                  nomesDepartamentos.map(n => (
                    <label key={n} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={formSectores.includes(n)} onCheckedChange={() => toggleSector(n)} />
                      {n}
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Origem (módulo de negócio)</Label>
              <Select value={formOrigem} onValueChange={setFormOrigem}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGEM_MODULO_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={formObs} onChange={e => setFormObs(e.target.value)} rows={3} placeholder="Notas internas…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void guardarUpload()} disabled={saving}>
              {saving ? 'A guardar…' : 'Carregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={novaPastaOpen}
        onOpenChange={o => {
          setNovaPastaOpen(o);
          if (!o) {
            setNovaPastaModulos([]);
            setNovaPastaSectores([]);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
            <DialogDescription>Subpasta ou raiz. Permissões vazias = visível a quem já acede ao tenant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Pasta pai (opcional)</Label>
              <Select
                value={novaPastaParentId != null ? String(novaPastaParentId) : '__root__'}
                onValueChange={v => setNovaPastaParentId(v === '__root__' ? null : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">Raiz</SelectItem>
                  {pastas.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome da pasta</Label>
              <Input value={novaPastaNome} onChange={e => setNovaPastaNome(e.target.value)} placeholder="Ex.: Orçamentos" />
            </div>
            <div className="space-y-2">
              <Label>Módulos com acesso à pasta</Label>
              <p className="text-xs text-muted-foreground">Vazio = sem filtro extra por módulo nesta pasta.</p>
              <div className="max-h-32 space-y-2 overflow-y-auto rounded-md border p-2">
                {MODULO_OPTIONS.map(m => (
                  <label key={m.value} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={novaPastaModulos.includes(m.value)} onCheckedChange={() => toggleNovaPastaModulo(m.value)} />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sectores (departamento)</Label>
              <p className="text-xs text-muted-foreground">Vazio = todos os sectores.</p>
              <div className="max-h-28 space-y-2 overflow-y-auto rounded-md border p-2">
                {nomesDepartamentos.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Sem departamentos configurados.</span>
                ) : (
                  nomesDepartamentos.map(n => (
                    <label key={n} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={novaPastaSectores.includes(n)} onCheckedChange={() => toggleNovaPastaSector(n)} />
                      {n}
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaPastaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void criarPasta()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPastaOpen} onOpenChange={setEditPastaOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar pasta</DialogTitle>
            <DialogDescription>
              Nome e permissões aplicam-se a esta pasta e restringem a visibilidade dos ficheiros nela (além das permissões
              de cada documento).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editPastaNome} onChange={e => setEditPastaNome(e.target.value)} placeholder="Nome da pasta" />
            </div>
            <div className="space-y-2">
              <Label>Módulos com acesso</Label>
              <p className="text-xs text-muted-foreground">Vazio = sem filtro extra por módulo.</p>
              <div className="max-h-32 space-y-2 overflow-y-auto rounded-md border p-2">
                {MODULO_OPTIONS.map(m => (
                  <label key={m.value} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={editPastaModulos.includes(m.value)} onCheckedChange={() => toggleEditPastaModulo(m.value)} />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sectores</Label>
              <p className="text-xs text-muted-foreground">Vazio = todos.</p>
              <div className="max-h-28 space-y-2 overflow-y-auto rounded-md border p-2">
                {nomesDepartamentos.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Sem departamentos configurados.</span>
                ) : (
                  nomesDepartamentos.map(n => (
                    <label key={n} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={editPastaSectores.includes(n)} onCheckedChange={() => toggleEditPastaSector(n)} />
                      {n}
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPastaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void salvarEdicaoPasta()} disabled={savingPastaEdit || !editPastaNome.trim()}>
              {savingPastaEdit ? 'A guardar…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={moverOpen}
        onOpenChange={o => {
          setMoverOpen(o);
          if (!o) {
            setMoverArquivo(null);
            setMoverDestinoPastaId(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mover documento</DialogTitle>
            <DialogDescription>
              {moverArquivo ? (
                <>
                  <span className="font-medium text-foreground">{moverArquivo.titulo}</span>
                  <span className="block mt-1 text-xs">
                    Origem: {pastaPathById.get(moverArquivo.pastaId) ?? '—'}
                  </span>
                </>
              ) : (
                'Seleccione a pasta de destino na mesma empresa.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Pasta de destino</Label>
              {pastas.filter(p => moverArquivo == null || p.id !== moverArquivo.pastaId).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Crie outra pasta para poder mover o documento.
                </p>
              ) : (
                <Select
                  value={moverDestinoPastaId != null ? String(moverDestinoPastaId) : ''}
                  onValueChange={v => setMoverDestinoPastaId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar pasta" />
                  </SelectTrigger>
                  <SelectContent>
                    {pastas
                      .filter(p => moverArquivo == null || p.id !== moverArquivo.pastaId)
                      .map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {pastaPathById.get(p.id) ?? p.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoverOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void executarMover()}
              disabled={
                savingMover ||
                moverArquivo == null ||
                moverDestinoPastaId == null ||
                moverDestinoPastaId === moverArquivo.pastaId ||
                pastas.filter(p => moverArquivo == null || p.id !== moverArquivo.pastaId).length === 0
              }
            >
              {savingMover ? 'A mover…' : 'Mover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Auditoria</DialogTitle>
            <DialogDescription>{auditArquivoTitulo}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh] pr-3">
            <ul className="space-y-2 text-sm">
              {auditRows.length === 0 ? (
                <li className="text-muted-foreground">Sem registos.</li>
              ) : (
                auditRows.map(r => (
                  <li key={r.id} className="rounded-md border border-border/60 px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <Badge variant="outline">{labelAccaoGestao(r.accao)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(r.createdAt), "d MMM yyyy HH:mm:ss", { locale: pt })}
                      </span>
                    </div>
                    {r.accao === 'move' &&
                    typeof r.detalhe.para_pasta_caminho === 'string' &&
                    r.detalhe.para_pasta_caminho ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        De: {String(r.detalhe.de_pasta_caminho ?? '—')} → Para: {r.detalhe.para_pasta_caminho}
                      </p>
                    ) : null}
                    {r.profileId != null ? (
                      <p className="text-xs text-muted-foreground mt-1">Perfil #{r.profileId}</p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
