import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { useAuth } from '@/context/AuthContext';
import type { Falta, TipoFalta } from '@/types';
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
import { Search, Plus, Pencil, Eye } from 'lucide-react';

const TIPO_OPTIONS: TipoFalta[] = ['Justificada', 'Injustificada', 'Atestado Médico', 'Licença'];

export default function FaltasPage() {
  const { user } = useAuth();
  const { faltas, addFalta, updateFalta, deleteFalta, colaboradores } = useData();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoFalta | 'todos'>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Falta | null>(null);
  const [viewItem, setViewItem] = useState<Falta | null>(null);
  const [form, setForm] = useState<Omit<Falta, 'id'>>({
    colaboradorId: 0,
    data: new Date().toISOString().slice(0, 10),
    tipo: 'Justificada',
    motivo: '',
    registadoPor: user?.nome ?? '',
  });

  const getColabName = (id: number) => colaboradores.find(c => c.id === id)?.nome ?? 'N/A';

  const filtered = faltas.filter(f => {
    const matchSearch = getColabName(f.colaboradorId).toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoFilter === 'todos' || f.tipo === tipoFilter;
    let matchDate = true;
    if (dataInicio) matchDate = matchDate && f.data >= dataInicio;
    if (dataFim) matchDate = matchDate && f.data <= dataFim;
    return matchSearch && matchTipo && matchDate;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const openCreate = () => {
    setEditing(null);
    setForm({
      colaboradorId: colaboradores[0]?.id ?? 0,
      data: new Date().toISOString().slice(0, 10),
      tipo: 'Justificada',
      motivo: '',
      registadoPor: user?.nome ?? '',
    });
    setDialogOpen(true);
  };

  const openEdit = (f: Falta) => {
    setEditing(f);
    setForm({
      colaboradorId: f.colaboradorId,
      data: f.data,
      tipo: f.tipo,
      motivo: f.motivo,
      registadoPor: f.registadoPor,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.colaboradorId || !form.data) return;
    try {
      if (editing) await updateFalta(editing.id, form);
      else await addFalta(form);
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const remove = async (f: Falta) => {
    if (!window.confirm('Remover este registo de falta?')) return;
    try {
      await deleteFalta(f.id);
      toast.success('Registo de falta removido.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Faltas & Efectividade</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Registar Falta
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar colaborador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={tipoFilter} onValueChange={v => setTipoFilter(v as TipoFalta | 'todos')}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {TIPO_OPTIONS.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[140px] h-9" placeholder="De" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[140px] h-9" placeholder="Até" />
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Colaborador</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Motivo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Registado por</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(f => (
              <tr key={f.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{getColabName(f.colaboradorId)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(f.data)}</td>
                <td className="py-3 px-5">{f.tipo}</td>
                <td className="py-3 px-5 text-muted-foreground max-w-48 truncate">{f.motivo || '—'}</td>
                <td className="py-3 px-5 text-muted-foreground">{f.registadoPor}</td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(f); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(f)}>×</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma falta encontrada.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar falta' : 'Registar falta'}</DialogTitle>
            <DialogDescription>Dados da falta.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={form.colaboradorId ? String(form.colaboradorId) : ''} onValueChange={v => setForm(f => ({ ...f, colaboradorId: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome} — {c.departamento}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoFalta }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Opcional para injustificada" />
            </div>
            <div className="space-y-2">
              <Label>Registado por</Label>
              <Input value={form.registadoPor} onChange={e => setForm(f => ({ ...f, registadoPor: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.colaboradorId || !form.data}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Falta — {viewItem && getColabName(viewItem.colaboradorId)}</DialogTitle>
            <DialogDescription>Detalhe</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewItem.data)}</p>
              <p><span className="text-muted-foreground">Tipo:</span> {viewItem.tipo}</p>
              <p><span className="text-muted-foreground">Motivo:</span> {viewItem.motivo || '—'}</p>
              <p><span className="text-muted-foreground">Registado por:</span> {viewItem.registadoPor}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
