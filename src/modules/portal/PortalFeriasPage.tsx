import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useColaboradorId } from '@/hooks/useColaboradorId';
import type { Ferias } from '@/types';
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
import { Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS: { value: Ferias['status'] | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Aprovado', label: 'Aprovado' },
  { value: 'Rejeitado', label: 'Rejeitado' },
  { value: 'Cancelado', label: 'Cancelado' },
];

export default function PortalFeriasPage() {
  const colaboradorId = useColaboradorId();
  const { ferias, setFerias } = useData();
  const [statusFilter, setStatusFilter] = useState<Ferias['status'] | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Ferias | null>(null);
  const [form, setForm] = useState<Omit<Ferias, 'id'>>({
    colaboradorId: 0,
    dataInicio: '',
    dataFim: '',
    dias: 0,
    status: 'Pendente',
    solicitadoEm: new Date().toISOString().slice(0, 10),
  });

  const minhasFerias = colaboradorId == null
    ? []
    : ferias.filter(f => f.colaboradorId === colaboradorId);

  const filtered = minhasFerias.filter(f => {
    const matchStatus = statusFilter === 'todos' || f.status === statusFilter;
    return matchStatus;
  });

  const updateDias = (inicio: string, fim: string) => {
    const d = diasEntre(inicio, fim);
    setForm(prev => ({ ...prev, dias: d >= 0 ? d : 0 }));
  };

  const openCreate = () => {
    if (colaboradorId == null) return;
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      colaboradorId,
      dataInicio: today,
      dataFim: today,
      dias: 1,
      status: 'Pendente',
      solicitadoEm: today,
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.colaboradorId || !form.dataInicio || !form.dataFim || form.dias <= 0) return;
    const newId = Math.max(0, ...ferias.map(f => f.id)) + 1;
    setFerias(prev => [...prev, { id: newId, ...form }]);
    setDialogOpen(false);
    toast.success('Pedido de férias enviado. Aguarde aprovação dos Recursos Humanos.');
  };

  if (colaboradorId == null) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">As Minhas Férias</h1>
        <p className="text-muted-foreground text-center py-12">Não tem um colaborador associado à sua conta. Contacte os Recursos Humanos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">As Minhas Férias</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Solicitar Férias
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Consulte os seus pedidos de férias e solicite novos períodos.</p>

      <Select value={statusFilter} onValueChange={v => setStatusFilter(v as Ferias['status'] | 'todos')}>
        <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Início</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fim</th>
              <th className="text-center py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Dias</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Solicitado em</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{formatDate(f.dataInicio)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(f.dataFim)}</td>
                <td className="py-3 px-5 text-center">{f.dias}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(f.solicitadoEm)}</td>
                <td className="py-3 px-5"><StatusBadge status={f.status} /></td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(f); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum pedido de férias encontrado.</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar férias</DialogTitle>
            <DialogDescription>Indique o período desejado. O pedido será analisado pelos Recursos Humanos.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
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
              <Input type="number" min={1} value={form.dias} readOnly className="bg-muted/50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.dataInicio || !form.dataFim || form.dias <= 0}>Enviar pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhe do pedido de férias</DialogTitle>
            <DialogDescription>Período e estado</DialogDescription>
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
    </div>
  );
}
