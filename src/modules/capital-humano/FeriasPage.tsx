import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { useAuth } from '@/context/AuthContext';
import type { Ferias, StatusFerias } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate, diasEntre } from '@/utils/formatters';
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
import { Search, Plus, Pencil, Eye, Check, X, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const STATUS_OPTIONS: { value: StatusFerias | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Aprovado', label: 'Aprovado' },
  { value: 'Rejeitado', label: 'Rejeitado' },
  { value: 'Cancelado', label: 'Cancelado' },
];

export default function FeriasPage() {
  const { user } = useAuth();
  const { ferias, addFerias, updateFerias, deleteFerias, colaboradores } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFerias | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editing, setEditing] = useState<Ferias | null>(null);
  const [viewItem, setViewItem] = useState<Ferias | null>(null);
  const [rejectItem, setRejectItem] = useState<Ferias | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [form, setForm] = useState<Omit<Ferias, 'id'>>({
    colaboradorId: 0,
    dataInicio: '',
    dataFim: '',
    dias: 0,
    status: 'Pendente',
    solicitadoEm: new Date().toISOString().slice(0, 10),
  });

  const getColabName = (id: number) => colaboradores.find(c => c.id === id)?.nome ?? 'N/A';
  const getColabDept = (id: number) => colaboradores.find(c => c.id === id)?.departamento ?? '';

  const filtered = ferias.filter(f => {
    const name = getColabName(f.colaboradorId).toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || f.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const updateDias = (inicio: string, fim: string) => {
    const d = diasEntre(inicio, fim);
    setForm(prev => ({ ...prev, dias: d >= 0 ? d : 0 }));
  };

  const openCreate = () => {
    setEditing(null);
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      colaboradorId: colaboradores[0]?.id ?? 0,
      dataInicio: today,
      dataFim: today,
      dias: 1,
      status: 'Pendente',
      solicitadoEm: today,
    });
    setDialogOpen(true);
  };

  const openEdit = (f: Ferias) => {
    setEditing(f);
    setForm({
      colaboradorId: f.colaboradorId,
      dataInicio: f.dataInicio,
      dataFim: f.dataFim,
      dias: f.dias,
      status: f.status,
      motivo: f.motivo,
      solicitadoEm: f.solicitadoEm,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.colaboradorId || !form.dataInicio || !form.dataFim || form.dias <= 0) return;
    try {
      if (editing) await updateFerias(editing.id, form);
      else await addFerias(form);
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? 'Pedido de férias actualizado.' : 'Pedido de férias registado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const handleApprove = async (f: Ferias) => {
    try {
      await updateFerias(f.id, { status: 'Aprovado' });
      toast.success('Férias aprovadas.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao aprovar');
    }
  };

  const handleReject = async () => {
    if (!rejectItem) return;
    try {
      await updateFerias(rejectItem.id, { status: 'Rejeitado', motivo: motivoRejeicao.trim() || undefined });
      setRejectOpen(false);
      setRejectItem(null);
      setMotivoRejeicao('');
      toast.error('Férias rejeitadas.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao rejeitar');
    }
  };

  const handleCancel = async (f: Ferias) => {
    try {
      await updateFerias(f.id, { status: 'Cancelado' });
      toast.info('Pedido cancelado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao cancelar');
    }
  };

  const remove = async (f: Ferias) => {
    if (!window.confirm(`Remover o pedido de férias de ${getColabName(f.colaboradorId)} (${f.dataInicio}–${f.dataFim})?`)) return;
    try {
      await deleteFerias(f.id);
      toast.success('Pedido de férias removido.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Gestão de Férias</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Novo Pedido
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar colaborador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFerias | 'todos')}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Colaborador</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Departamento</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Início</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fim</th>
              <th className="text-center py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Dias</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Solicitado em</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(f => (
              <tr key={f.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{getColabName(f.colaboradorId)}</td>
                <td className="py-3 px-5 text-muted-foreground">{getColabDept(f.colaboradorId)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(f.dataInicio)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(f.dataFim)}</td>
                <td className="py-3 px-5 text-center">{f.dias}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(f.solicitadoEm)}</td>
                <td className="py-3 px-5"><StatusBadge status={f.status} /></td>
                <td className="py-3 px-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(f); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                    {(f.status === 'Pendente' || f.status === 'Aprovado') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                    )}
                    {f.status === 'Pendente' && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => handleApprove(f)} title="Aprovar"><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setRejectItem(f); setRejectOpen(true); }} title="Rejeitar"><X className="h-4 w-4" /></Button>
                      </>
                    )}
                    {f.status === 'Pendente' && (
                      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleCancel(f)}>Cancelar</Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(f)} title="Remover"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum pedido de férias encontrado.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar pedido de férias' : 'Novo pedido de férias'}</DialogTitle>
            <DialogDescription>Período e colaborador.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select
                value={form.colaboradorId ? String(form.colaboradorId) : ''}
                onValueChange={v => setForm(f => ({ ...f, colaboradorId: Number(v) }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {colaboradores.filter(c => c.status === 'Activo').map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome} — {c.departamento}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data início</Label>
                <Input type="date" value={form.dataInicio} onChange={e => { setForm(f => ({ ...f, dataInicio: e.target.value })); updateDias(e.target.value, form.dataFim); }} />
              </div>
              <div className="space-y-2">
                <Label>Data fim</Label>
                <Input type="date" value={form.dataFim} onChange={e => { setForm(f => ({ ...f, dataFim: e.target.value })); updateDias(form.dataInicio, e.target.value); }} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dias (calculado)</Label>
              <Input type="number" min={1} value={form.dias} onChange={e => setForm(f => ({ ...f, dias: Number(e.target.value) || 0 }))} />
            </div>
            {editing && (
              <div className="space-y-2">
                <Label>Data solicitação</Label>
                <Input type="date" value={form.solicitadoEm} onChange={e => setForm(f => ({ ...f, solicitadoEm: e.target.value }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.colaboradorId || !form.dataInicio || !form.dataFim || form.dias <= 0}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Férias — {viewItem && getColabName(viewItem.colaboradorId)}</DialogTitle>
            <DialogDescription>Detalhe do pedido</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Período:</span> {formatDate(viewItem.dataInicio)} a {formatDate(viewItem.dataFim)} ({viewItem.dias} dias)</p>
              <p><span className="text-muted-foreground">Solicitado em:</span> {formatDate(viewItem.solicitadoEm)}</p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
              {viewItem.motivo && <p><span className="text-muted-foreground">Motivo (rejeição):</span> {viewItem.motivo}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={open => { if (!open) setRejectItem(null); setRejectOpen(open); setMotivoRejeicao(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar pedido de férias</DialogTitle>
            <DialogDescription>Indique o motivo da rejeição (opcional).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)} placeholder="ex: Período indisponível" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
