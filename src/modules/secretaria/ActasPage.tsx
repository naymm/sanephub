import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { Acta } from '@/types';
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
import { Textarea } from '@/components/ui/textarea';

const STATUS_OPTIONS: Acta['status'][] = ['Rascunho', 'Em Revisão', 'Aprovada', 'Publicada', 'Arquivada'];

function nextNumero(actas: Acta[]): string {
  const year = new Date().getFullYear();
  const prefix = `ACT-${year}-`;
  const nums = actas.filter(a => a.numero.startsWith(prefix)).map(a => parseInt(a.numero.split('-')[2], 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export default function ActasPage() {
  const { actas, addActa, updateActa, deleteActa, reunioes } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Acta['status'] | 'todos'>('todos');
  const [reuniaoFilter, setReuniaoFilter] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Acta | null>(null);
  const [viewItem, setViewItem] = useState<Acta | null>(null);
  const [form, setForm] = useState<Omit<Acta, 'id'>>({
    reuniaoId: reunioes[0]?.id ?? 0,
    numero: '',
    data: new Date().toISOString().slice(0, 10),
    titulo: '',
    conteudo: '',
    status: 'Rascunho',
  });

  const getReuniaoTitulo = (id: number) => reunioes.find(r => r.id === id)?.titulo ?? 'N/A';

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

  const openCreate = () => {
    setEditing(null);
    setForm({
      reuniaoId: reunioes[0]?.id ?? 0,
      numero: nextNumero(actas),
      data: new Date().toISOString().slice(0, 10),
      titulo: '',
      conteudo: '',
      aprovadaPor: undefined,
      status: 'Rascunho',
    });
    setDialogOpen(true);
  };

  const openEdit = (a: Acta) => {
    setEditing(a);
    setForm({
      reuniaoId: a.reuniaoId,
      numero: a.numero,
      data: a.data,
      titulo: a.titulo,
      conteudo: a.conteudo,
      aprovadaPor: a.aprovadaPor,
      status: a.status,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.reuniaoId || !form.numero.trim() || !form.data || !form.titulo.trim()) return;
    try {
      if (editing) await updateActa(editing.id, form);
      else await addActa(form);
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
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

      <div className="table-container overflow-x-auto">
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

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma acta encontrada.</p>}
      {reunioes.length === 0 && <p className="text-sm text-amber-600">Crie pelo menos uma reunião para poder registar actas.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar acta' : 'Nova acta'}</DialogTitle>
            <DialogDescription>Acta da reunião.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Reunião</Label>
              <Select value={form.reuniaoId ? String(form.reuniaoId) : ''} onValueChange={v => setForm(f => ({ ...f, reuniaoId: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar reunião" /></SelectTrigger>
                <SelectContent>
                  {reunioes.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.titulo} — {formatDate(r.data)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número</Label>
                <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="ACT-2024-001" />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Acta — Reunião de Direcção" />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} placeholder="Resumo e deliberações..." rows={5} />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.reuniaoId || !form.numero.trim() || !form.data || !form.titulo.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewItem?.numero}</DialogTitle>
            <DialogDescription>{viewItem?.titulo}</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Reunião:</span> {getReuniaoTitulo(viewItem.reuniaoId)}</p>
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewItem.data)}</p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
              {viewItem.aprovadaPor && <p><span className="text-muted-foreground">Aprovada por:</span> {viewItem.aprovadaPor}</p>}
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
