import { useState } from 'react';
import { useData } from '@/context/DataContext';
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
import { Search, Plus, Pencil, Eye, Trash2 } from 'lucide-react';

const TIPO_OPTIONS: DocumentoOficial['tipo'][] = ['Deliberação', 'Despacho', 'Circular', 'Convocatória', 'Comunicado Interno'];
const STATUS_OPTIONS: DocumentoOficial['status'][] = ['Rascunho', 'Em Revisão', 'Aprovado', 'Publicado', 'Arquivado'];

function nextNumero(tipo: DocumentoOficial['tipo'], docs: DocumentoOficial[]): string {
  const prefixMap = { Deliberação: 'DEL', Despacho: 'DES', Circular: 'CIRC', Convocatória: 'CONV', 'Comunicado Interno': 'COM' };
  const prefix = `${prefixMap[tipo]}-${new Date().getFullYear()}-`;
  const nums = docs.filter(d => d.numero.startsWith(prefix)).map(d => parseInt(d.numero.split('-').pop() ?? '0', 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export default function DocumentosOficiaisPage() {
  const { documentosOficiais, setDocumentosOficiais } = useData();
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
  });

  const filtered = documentosOficiais.filter(d => {
    const matchSearch =
      d.numero.toLowerCase().includes(search.toLowerCase()) ||
      d.titulo.toLowerCase().includes(search.toLowerCase()) ||
      d.autor.toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoFilter === 'todos' || d.tipo === tipoFilter;
    const matchStatus = statusFilter === 'todos' || d.status === statusFilter;
    return matchSearch && matchTipo && matchStatus;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      tipo: 'Comunicado Interno',
      numero: nextNumero('Comunicado Interno', documentosOficiais),
      titulo: '',
      data: new Date().toISOString().slice(0, 10),
      autor: '',
      status: 'Rascunho',
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
    });
    setDialogOpen(true);
  };

  const onTipoChange = (tipo: DocumentoOficial['tipo']) => {
    setForm(f => ({ ...f, tipo, numero: nextNumero(tipo, documentosOficiais) }));
  };

  const save = () => {
    if (!form.numero.trim() || !form.titulo.trim() || !form.data || !form.autor.trim()) return;
    if (editing) {
      setDocumentosOficiais(prev => prev.map(d => (d.id === editing.id ? { ...editing, ...form } : d)));
    } else {
      const newId = Math.max(0, ...documentosOficiais.map(d => d.id)) + 1;
      setDocumentosOficiais(prev => [...prev, { id: newId, ...form }]);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const remove = (d: DocumentoOficial) => {
    setDocumentosOficiais(prev => prev.filter(x => x.id !== d.id));
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
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-mono text-xs">{d.numero}</td>
                <td className="py-3 px-5">{d.tipo}</td>
                <td className="py-3 px-5 font-medium max-w-56 truncate">{d.titulo}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(d.data)}</td>
                <td className="py-3 px-5 text-muted-foreground">{d.autor}</td>
                <td className="py-3 px-5"><StatusBadge status={d.status} /></td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(d); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum documento encontrado.</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
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
