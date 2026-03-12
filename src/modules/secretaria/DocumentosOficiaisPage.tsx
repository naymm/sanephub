import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { DocumentoOficial } from '@/types';
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
import { Search, Plus, Pencil, Eye, Trash2, FileDown } from 'lucide-react';
import { gerarPdfDespacho } from '@/utils/despachoPdf';

const TIPO_OPTIONS: DocumentoOficial['tipo'][] = ['Deliberação', 'Despacho', 'Circular', 'Convocatória', 'Comunicado Interno'];
const STATUS_OPTIONS: DocumentoOficial['status'][] = ['Rascunho', 'Em Revisão', 'Aprovado', 'Publicado', 'Arquivado'];

function nextNumero(tipo: DocumentoOficial['tipo'], docs: DocumentoOficial[]): string {
  const year = new Date().getFullYear();

  // Despachos seguem o formato 000/GPCA-GS/ANO
  if (tipo === 'Despacho') {
    const pattern = `/GPCA-GS/${year}`;
    const nums = docs
      .filter(d => d.tipo === 'Despacho' && d.numero.endsWith(pattern))
      .map(d => parseInt(d.numero.split('/')[0] ?? '0', 10))
      .filter(n => !Number.isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${String(next).padStart(3, '0')}/GPCA-GS/${year}`;
  }

  // Restantes documentos mantêm o formato anterior PREFIX-ANO-000X
  const prefixMap = { Deliberação: 'DEL', Despacho: 'DES', Circular: 'CIRC', Convocatória: 'CONV', 'Comunicado Interno': 'COM' } as const;
  const prefix = `${prefixMap[tipo]}-${year}-`;
  const nums = docs
    .filter(d => d.tipo === tipo && d.numero.startsWith(prefix))
    .map(d => parseInt(d.numero.split('-').pop() ?? '0', 10))
    .filter(n => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export default function DocumentosOficiaisPage() {
  const { documentosOficiais, addDocumentoOficial, updateDocumentoOficial, deleteDocumentoOficial, empresas, colaboradores } = useData();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<DocumentoOficial['tipo'] | 'todos'>('todos');
  const [statusFilter, setStatusFilter] = useState<DocumentoOficial['status'] | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentoOficial | null>(null);
  const [viewItem, setViewItem] = useState<DocumentoOficial | null>(null);
  const [form, setForm] = useState<Omit<DocumentoOficial, 'id'>>({
    tipo: 'Comunicado Interno',
    numero: '',
    titulo: '',
    data: new Date().toISOString().slice(0, 10),
    autor: '',
    status: 'Rascunho',
    empresaId: null,
    despachoTipo: undefined,
    colaboradorId: null,
    tratamento: undefined,
    funcao: '',
    direccao: '',
    acumulaFuncao: false,
    numeroEspacoExoneracao: '',
    pcaAssinado: false,
    pcaAssinadoEm: undefined,
    pcaAssinadoPor: undefined,
  });
  const [despachoColabSearch, setDespachoColabSearch] = useState('');

  const filtered = documentosOficiais.filter(d => {
    const matchSearch =
      d.numero.toLowerCase().includes(search.toLowerCase()) ||
      d.titulo.toLowerCase().includes(search.toLowerCase()) ||
      d.autor.toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoFilter === 'todos' || d.tipo === tipoFilter;
    const matchStatus = statusFilter === 'todos' || d.status === statusFilter;
    return matchSearch && matchTipo && matchStatus;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const openCreate = () => {
    setEditing(null);
    setForm({
      tipo: 'Comunicado Interno',
      numero: nextNumero('Comunicado Interno', documentosOficiais),
      titulo: '',
      data: new Date().toISOString().slice(0, 10),
      autor: user?.nome ?? '',
      status: 'Rascunho',
      empresaId: null,
      despachoTipo: undefined,
      colaboradorId: null,
      tratamento: undefined,
      funcao: '',
      direccao: '',
      acumulaFuncao: false,
      numeroEspacoExoneracao: '',
      pcaAssinado: false,
      pcaAssinadoEm: undefined,
      pcaAssinadoPor: undefined,
    });
    setDialogOpen(true);
  };

  const openEdit = (d: DocumentoOficial) => {
    setEditing(d);
    setForm({
      tipo: d.tipo,
      numero: d.numero,
      titulo: d.titulo,
      data: d.data,
      autor: d.autor,
      status: d.status,
      empresaId: d.empresaId ?? null,
      despachoTipo: d.despachoTipo,
      colaboradorId: d.colaboradorId ?? null,
      tratamento: d.tratamento,
      funcao: d.funcao ?? '',
      direccao: d.direccao ?? '',
      acumulaFuncao: d.acumulaFuncao ?? false,
      numeroEspacoExoneracao: d.numeroEspacoExoneracao ?? '',
      pcaAssinado: d.pcaAssinado ?? false,
      pcaAssinadoEm: d.pcaAssinadoEm,
      pcaAssinadoPor: d.pcaAssinadoPor,
    });
    setDialogOpen(true);
  };

  const onTipoChange = (tipo: DocumentoOficial['tipo']) => {
    setForm(f => ({
      ...f,
      tipo,
      numero: nextNumero(tipo, documentosOficiais),
      status: tipo === 'Despacho' ? 'Em Revisão' : f.status,
      // Limpar campos específicos de despacho quando muda de tipo
      despachoTipo: tipo === 'Despacho' ? (f.despachoTipo ?? 'Nomeação') : undefined,
      colaboradorId: tipo === 'Despacho' ? f.colaboradorId ?? null : null,
      tratamento: tipo === 'Despacho' ? (f.tratamento ?? 'Sr.') : undefined,
      funcao: tipo === 'Despacho' ? f.funcao ?? '' : '',
      direccao: tipo === 'Despacho' ? f.direccao ?? '' : '',
      acumulaFuncao: tipo === 'Despacho' ? f.acumulaFuncao ?? false : false,
      numeroEspacoExoneracao: tipo === 'Despacho' ? f.numeroEspacoExoneracao ?? '' : '',
      titulo: tipo === 'Despacho' ? despachoTituloBase(f.despachoTipo ?? 'Nomeação') : f.titulo,
    }));
  };

  const isDespacho = form.tipo === 'Despacho';
  const isNomeacao = isDespacho && (form.despachoTipo ?? 'Nomeação') === 'Nomeação';
  const isExoneracao = isDespacho && form.despachoTipo === 'Exoneração';

  const despachoTituloBase = (tipo: DocumentoOficial['despachoTipo'] | undefined): string => {
    if (tipo === 'Exoneração') return 'Despacho de Exoneração';
    if (tipo === 'Nomeação') return 'Despacho de Nomeação';
    return 'Despacho';
  };

  const handleGerarPdfDespacho = async (d: DocumentoOficial) => {
    if (d.tipo !== 'Despacho') {
      toast.error('Apenas despachos podem gerar este PDF.');
      return;
    }
    if (!d.pcaAssinado) {
      toast.error('Despacho ainda não foi assinado pelo PCA.');
      return;
    }
    const col = d.colaboradorId != null ? colaboradores.find(c => c.id === d.colaboradorId) ?? null : null;
    const empresaNome =
      d.empresaId != null
        ? empresas.find(e => e.id === d.empresaId)?.nome
        : undefined;
    try {
      await gerarPdfDespacho(
        d,
        col,
        {
          linha: d.pcaAssinadoPor ?? undefined,
          cargo: d.pcaAssinaturaCargo ?? 'PCA',
          imagemUrl: d.pcaAssinaturaImagemUrl ?? undefined,
        },
        empresaNome
      );
      toast.success('PDF do despacho gerado. Verifique os transferidos.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o PDF do despacho.');
    }
  };

  const save = async () => {
    if (!form.numero.trim() || !form.titulo.trim() || !form.data || !form.autor.trim()) return;
    if (isDespacho) {
      if (!form.empresaId || !form.despachoTipo || !form.colaboradorId) {
        toast.error('Preencha a empresa, o tipo de despacho e o colaborador.');
        return;
      }
      if (isNomeacao) {
        if (!form.tratamento || !form.funcao?.trim() || !form.direccao?.trim()) {
          toast.error('Preencha tratamento, função e direcção da nomeação.');
          return;
        }
      }
      if (isExoneracao) {
        if (!form.numeroEspacoExoneracao?.trim()) {
          toast.error('Indique o número de espaço de exoneração.');
          return;
        }
      }
    }
    try {
      if (editing) await updateDocumentoOficial(editing.id, form);
      else await addDocumentoOficial(form);
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const remove = async (d: DocumentoOficial) => {
    if (!window.confirm(`Remover documento ${d.numero}?`)) return;
    try {
      await deleteDocumentoOficial(d.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Documentos Oficiais</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Novo documento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar número, título ou autor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={tipoFilter} onValueChange={v => setTipoFilter(v as DocumentoOficial['tipo'] | 'todos')}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPO_OPTIONS.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as DocumentoOficial['status'] | 'todos')}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Número</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Título</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Autor</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Assinatura PCA</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(d => (
              <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-mono text-xs">{d.numero}</td>
                <td className="py-3 px-5">{d.tipo}</td>
                <td className="py-3 px-5 font-medium max-w-56 truncate">{d.titulo}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(d.data)}</td>
                <td className="py-3 px-5 text-muted-foreground">{d.autor}</td>
                <td className="py-3 px-5"><StatusBadge status={d.status} /></td>
                <td className="py-3 px-5 text-muted-foreground text-xs">
                  {d.tipo === 'Despacho'
                    ? d.pcaAssinado
                      ? `Assinado por ${d.pcaAssinadoPor ?? 'PCA'} em ${d.pcaAssinadoEm ?? ''}`
                      : 'Pendente de assinatura'
                    : '—'}
                </td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(d); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                  {d.tipo === 'Despacho' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleGerarPdfDespacho(d)}
                      disabled={!d.pcaAssinado}
                      title={d.pcaAssinado ? 'Gerar PDF do despacho' : 'Aguardando assinatura do PCA'}
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum documento encontrado.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar documento' : 'Novo documento'}</DialogTitle>
            <DialogDescription>Documento oficial.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => onTipoChange(v as DocumentoOficial['tipo'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número</Label>
                <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="DEL-2024-0001" />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
            </div>
            {isDespacho && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Empresa do despacho</Label>
                    <Select
                      value={form.empresaId != null ? String(form.empresaId) : ''}
                      onValueChange={v => setForm(f => ({ ...f, empresaId: v ? Number(v) : null }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                      <SelectContent>
                        {empresas.map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de despacho</Label>
                    <Select
                      value={form.despachoTipo ?? 'Nomeação'}
                      onValueChange={v =>
                        setForm(f => ({
                          ...f,
                          despachoTipo: v as DocumentoOficial['despachoTipo'],
                          titulo: despachoTituloBase(v as DocumentoOficial['despachoTipo']),
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nomeação">Nomeação</SelectItem>
                        <SelectItem value="Exoneração">Exoneração</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {isNomeacao && (
                  <div className="grid gap-4 border border-border/60 rounded-md p-3">
                    <p className="text-xs font-medium text-muted-foreground">Dados da Nomeação</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Tratamento</Label>
                        <Select
                          value={form.tratamento ?? 'Sr.'}
                          onValueChange={v => setForm(f => ({ ...f, tratamento: v as 'Sr.' | 'Sr(a).' }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sr.">Sr.</SelectItem>
                            <SelectItem value="Sr(a).">Sr(a).</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Colaborador</Label>
                        <Select
                          value={form.colaboradorId != null ? String(form.colaboradorId) : ''}
                          onValueChange={v => setForm(f => ({ ...f, colaboradorId: v ? Number(v) : null }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Seleccionar colaborador" /></SelectTrigger>
                          <SelectContent>
                            {(form.empresaId ? colaboradores.filter(c => c.empresaId === form.empresaId) : colaboradores).map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Função</Label>
                        <Input value={form.funcao ?? ''} onChange={e => setForm(f => ({ ...f, funcao: e.target.value }))} placeholder="Função/cargo" />
                      </div>
                      <div className="space-y-2">
                        <Label>Direcção</Label>
                        <Input value={form.direccao ?? ''} onChange={e => setForm(f => ({ ...f, direccao: e.target.value }))} placeholder="Direcção/área" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Acumulação de função</Label>
                      <Select
                        value={form.acumulaFuncao ? 'sim' : 'nao'}
                        onValueChange={v => setForm(f => ({ ...f, acumulaFuncao: v === 'sim' }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao">Não acumula</SelectItem>
                          <SelectItem value="sim">Acumula função</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {isExoneracao && (
                  <div className="grid gap-4 border border-border/60 rounded-md p-3">
                    <p className="text-xs font-medium text-muted-foreground">Dados da Exoneração</p>
                    <div className="space-y-2">
                      <Label>Pesquisar colaborador</Label>
                      <Input
                        placeholder="Pesquisar colaborador..."
                        value={despachoColabSearch}
                        onChange={e => setDespachoColabSearch(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Colaborador</Label>
                      <Select
                        value={form.colaboradorId != null ? String(form.colaboradorId) : ''}
                        onValueChange={v => setForm(f => ({ ...f, colaboradorId: v ? Number(v) : null }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Seleccionar colaborador" /></SelectTrigger>
                        <SelectContent>
                          {(form.empresaId ? colaboradores.filter(c => c.empresaId === form.empresaId) : colaboradores)
                            .filter(c => c.nome.toLowerCase().includes(despachoColabSearch.toLowerCase()))
                            .map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Número de espaço de exoneração</Label>
                      <Input
                        value={form.numeroEspacoExoneracao ?? ''}
                        onChange={e => setForm(f => ({ ...f, numeroEspacoExoneracao: e.target.value }))}
                        placeholder="Número de espaço de exoneração"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título do documento" />
            </div>
            <div className="space-y-2">
              <Label>Autor</Label>
              <Input value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} placeholder="Nome do autor" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as DocumentoOficial['status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.numero.trim() || !form.titulo.trim() || !form.data || !form.autor.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewItem?.numero}</DialogTitle>
            <DialogDescription>{viewItem?.titulo}</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Tipo:</span> {viewItem.tipo}</p>
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewItem.data)}</p>
              <p><span className="text-muted-foreground">Autor:</span> {viewItem.autor}</p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
