import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { Correspondencia } from '@/types';
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

const TIPO_OPTIONS: Correspondencia['tipo'][] = ['Entrada', 'Saída'];
const PRIORIDADE_OPTIONS: Correspondencia['prioridade'][] = ['Normal', 'Urgente', 'Confidencial'];
const ESTADO_OPTIONS: Correspondencia['estadoResposta'][] = ['Pendente', 'Respondida', 'Não requer', 'Arquivada'];

export default function CorrespondenciasPage() {
  const { correspondencias, addCorrespondencia, updateCorrespondencia, deleteCorrespondencia } = useData();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<Correspondencia['tipo'] | 'todos'>('todos');
  const [prioridadeFilter, setPrioridadeFilter] = useState<Correspondencia['prioridade'] | 'todos'>('todos');
  const [estadoFilter, setEstadoFilter] = useState<Correspondencia['estadoResposta'] | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Correspondencia | null>(null);
  const [viewItem, setViewItem] = useState<Correspondencia | null>(null);
  const [form, setForm] = useState<Omit<Correspondencia, 'id'>>({
    tipo: 'Entrada',
    remetente: '',
    destinatario: '',
    assunto: '',
    referencia: '',
    data: new Date().toISOString().slice(0, 10),
    prioridade: 'Normal',
    estadoResposta: 'Pendente',
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

  const openCreate = () => {
    setEditing(null);
    setForm({
      tipo: 'Entrada',
      remetente: '',
      destinatario: '',
      assunto: '',
      referencia: '',
      data: new Date().toISOString().slice(0, 10),
      prioridade: 'Normal',
      estadoResposta: 'Pendente',
    });
    setDialogOpen(true);
  };

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
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.remetente.trim() || !form.destinatario.trim() || !form.assunto.trim() || !form.data) return;
    try {
      if (editing) await updateCorrespondencia(editing.id, form);
      else await addCorrespondencia(form);
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
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

      <div className="table-container overflow-x-auto">
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

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma correspondência encontrada.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar correspondência' : 'Nova correspondência'}</DialogTitle>
            <DialogDescription>Registo de entrada ou saída.</DialogDescription>
          </DialogHeader>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.remetente.trim() || !form.destinatario.trim() || !form.assunto.trim() || !form.data}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewItem?.referencia}</DialogTitle>
            <DialogDescription>{viewItem?.assunto}</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Tipo:</span> {viewItem.tipo}</p>
              <p><span className="text-muted-foreground">Remetente:</span> {viewItem.remetente}</p>
              <p><span className="text-muted-foreground">Destinatário:</span> {viewItem.destinatario}</p>
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewItem.data)}</p>
              <p><span className="text-muted-foreground">Prioridade:</span> {viewItem.prioridade}</p>
              <p><span className="text-muted-foreground">Estado:</span> <StatusBadge status={viewItem.estadoResposta} /></p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
