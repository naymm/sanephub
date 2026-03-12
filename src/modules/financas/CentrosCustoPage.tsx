import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { CentroCusto } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatKz } from '@/utils/formatters';
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

export default function CentrosCustoPage() {
  const { centrosCusto, addCentroCusto, updateCentroCusto, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const empresaIdForNew = currentEmpresaId === 'consolidado' ? (empresas.find(e => e.activo)?.id ?? 1) : currentEmpresaId;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'Activo' | 'Inactivo'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<CentroCusto | null>(null);
  const [viewItem, setViewItem] = useState<CentroCusto | null>(null);
  const [form, setForm] = useState<Omit<CentroCusto, 'id'>>({
    empresaId: 1,
    codigo: '',
    nome: '',
    descricao: '',
    responsavel: '',
    orcamentoMensal: 0,
    orcamentoAnual: 0,
    gastoActual: 0,
    status: 'Activo',
  });

  const filtered = centrosCusto.filter(cc => {
    const matchSearch =
      cc.codigo.toLowerCase().includes(search.toLowerCase()) ||
      cc.nome.toLowerCase().includes(search.toLowerCase()) ||
      cc.responsavel.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || cc.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const openCreate = () => {
    setEditing(null);
    setForm({
      empresaId: empresaIdForNew,
      codigo: '',
      nome: '',
      descricao: '',
      responsavel: '',
      orcamentoMensal: 0,
      orcamentoAnual: 0,
      gastoActual: 0,
      status: 'Activo',
    });
    setDialogOpen(true);
  };

  const openEdit = (cc: CentroCusto) => {
    setEditing(cc);
    setForm({
      empresaId: cc.empresaId,
      codigo: cc.codigo,
      nome: cc.nome,
      descricao: cc.descricao,
      responsavel: cc.responsavel,
      orcamentoMensal: cc.orcamentoMensal,
      orcamentoAnual: cc.orcamentoAnual,
      gastoActual: cc.gastoActual,
      status: cc.status,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.codigo.trim() || !form.nome.trim()) return;
    try {
      if (editing) await updateCentroCusto(editing.id, form);
      else await addCentroCusto({ ...form, empresaId: form.empresaId ?? empresaIdForNew });
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const percentUtil = (cc: CentroCusto) =>
    cc.orcamentoAnual > 0 ? Math.round((cc.gastoActual / cc.orcamentoAnual) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Centros de Custo</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Novo Centro de Custo
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as 'todos' | 'Activo' | 'Inactivo')}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="Activo">Activo</SelectItem>
            <SelectItem value="Inactivo">Inactivo</SelectItem>
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
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Orçamento Anual</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Gasto</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Utilização</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(cc => (
              <tr key={cc.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-mono">{cc.codigo}</td>
                <td className="py-3 px-5 font-medium">{cc.nome}</td>
                <td className="py-3 px-5 text-muted-foreground">{cc.responsavel}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(cc.orcamentoAnual)}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(cc.gastoActual)}</td>
                <td className="py-3 px-5 text-right">
                  <span className={percentUtil(cc) > 90 ? 'text-destructive font-medium' : ''}>{percentUtil(cc)}%</span>
                </td>
                <td className="py-3 px-5"><StatusBadge status={cc.status} /></td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(cc); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cc)}><Pencil className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum centro de custo encontrado.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar centro de custo' : 'Novo centro de custo'}</DialogTitle>
            <DialogDescription>Dados do centro de custo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="ex: CC-001" disabled={!!editing} />
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
              <Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orçamento Mensal (Kz)</Label>
                <Input type="number" min={0} value={form.orcamentoMensal || ''} onChange={e => setForm(f => ({ ...f, orcamentoMensal: Number(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Orçamento Anual (Kz)</Label>
                <Input type="number" min={0} value={form.orcamentoAnual || ''} onChange={e => setForm(f => ({ ...f, orcamentoAnual: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            {editing && (
              <div className="space-y-2">
                <Label>Gasto Actual (Kz)</Label>
                <Input type="number" min={0} value={form.gastoActual || ''} onChange={e => setForm(f => ({ ...f, gastoActual: Number(e.target.value) || 0 }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as 'Activo' | 'Inactivo' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
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
            <DialogDescription>Detalhe do centro de custo</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Descrição:</span> {viewItem.descricao}</p>
              <p><span className="text-muted-foreground">Responsável:</span> {viewItem.responsavel}</p>
              <p><span className="text-muted-foreground">Orçamento mensal:</span> {formatKz(viewItem.orcamentoMensal)}</p>
              <p><span className="text-muted-foreground">Orçamento anual:</span> {formatKz(viewItem.orcamentoAnual)}</p>
              <p><span className="text-muted-foreground">Gasto actual:</span> {formatKz(viewItem.gastoActual)} ({percentUtil(viewItem)}%)</p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
