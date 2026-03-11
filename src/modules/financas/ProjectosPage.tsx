import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import type { Projecto } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatKz, formatDate } from '@/utils/formatters';
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
import { Search, Plus, Pencil, Eye } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS: Projecto['status'][] = ['Activo', 'Concluído', 'Suspenso', 'Cancelado'];

export default function ProjectosPage() {
  const { projectos, addProjecto, updateProjecto, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const empresaIdForNew = currentEmpresaId === 'consolidado' ? (empresas.find(e => e.activo)?.id ?? 1) : currentEmpresaId;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Projecto['status'] | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Projecto | null>(null);
  const [viewItem, setViewItem] = useState<Projecto | null>(null);
  const [form, setForm] = useState<Omit<Projecto, 'id'>>({
    empresaId: 1,
    codigo: '',
    nome: '',
    descricao: '',
    responsavel: '',
    orcamentoTotal: 0,
    gasto: 0,
    dataInicio: '',
    dataFim: '',
    status: 'Activo',
  });

  const filtered = projectos.filter(p => {
    const matchSearch =
      p.codigo.toLowerCase().includes(search.toLowerCase()) ||
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.responsavel.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCreate = () => {
    setEditing(null);
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      empresaId: empresaIdForNew,
      codigo: '',
      nome: '',
      descricao: '',
      responsavel: '',
      orcamentoTotal: 0,
      gasto: 0,
      dataInicio: today,
      dataFim: today,
      status: 'Activo',
    });
    setDialogOpen(true);
  };

  const openEdit = (p: Projecto) => {
    setEditing(p);
    setForm({
      empresaId: p.empresaId,
      codigo: p.codigo,
      nome: p.nome,
      descricao: p.descricao,
      responsavel: p.responsavel,
      orcamentoTotal: p.orcamentoTotal,
      gasto: p.gasto,
      dataInicio: p.dataInicio,
      dataFim: p.dataFim,
      status: p.status,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.codigo.trim() || !form.nome.trim()) return;
    try {
      if (editing) await updateProjecto(editing.id, form);
      else await addProjecto({ ...form, empresaId: form.empresaId ?? empresaIdForNew });
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const percentGasto = (p: Projecto) => (p.orcamentoTotal > 0 ? Math.round((p.gasto / p.orcamentoTotal) * 100) : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Projectos</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Novo Projecto
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as Projecto['status'] | 'todos')}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
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
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Código</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsável</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Orçamento</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Gasto</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Início / Fim</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-mono">{p.codigo}</td>
                <td className="py-3 px-5 font-medium">{p.nome}</td>
                <td className="py-3 px-5 text-muted-foreground">{p.responsavel}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(p.orcamentoTotal)}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(p.gasto)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(p.dataInicio)} — {formatDate(p.dataFim)}</td>
                <td className="py-3 px-5"><StatusBadge status={p.status} /></td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(p); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum projecto encontrado.</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar projecto' : 'Novo projecto'}</DialogTitle>
            <DialogDescription>Dados do projecto.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="ex: PROJ-001" disabled={!!editing} />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição" />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orçamento Total (Kz)</Label>
                <Input type="number" min={0} value={form.orcamentoTotal || ''} onChange={e => setForm(f => ({ ...f, orcamentoTotal: Number(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Gasto (Kz)</Label>
                <Input type="number" min={0} value={form.gasto || ''} onChange={e => setForm(f => ({ ...f, gasto: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={form.dataFim} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Projecto['status'] }))}>
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
            <Button onClick={save} disabled={!form.codigo.trim() || !form.nome.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewItem?.codigo} — {viewItem?.nome}</DialogTitle>
            <DialogDescription>Detalhe do projecto</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Descrição:</span> {viewItem.descricao}</p>
              <p><span className="text-muted-foreground">Responsável:</span> {viewItem.responsavel}</p>
              <p><span className="text-muted-foreground">Orçamento total:</span> {formatKz(viewItem.orcamentoTotal)}</p>
              <p><span className="text-muted-foreground">Gasto:</span> {formatKz(viewItem.gasto)} ({percentGasto(viewItem)}%)</p>
              <p><span className="text-muted-foreground">Período:</span> {formatDate(viewItem.dataInicio)} — {formatDate(viewItem.dataFim)}</p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
