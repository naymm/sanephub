import { useState } from 'react';
import { useData } from '@/context/DataContext';
import type { PendenciaDocumental, TipoPendencia, PrioridadePendencia } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Search, Plus, Pencil, Eye, Check } from 'lucide-react';

const TIPO_OPTIONS: TipoPendencia[] = ['Factura em falta', 'Comprovante em falta', 'Proforma em falta', 'Documento fiscal', 'Assinatura', 'Outro'];
const PRIORIDADE_OPTIONS: PrioridadePendencia[] = ['Baixa', 'Média', 'Alta', 'Urgente'];
const STATUS_OPTIONS: PendenciaDocumental['status'][] = ['Pendente', 'Em tratamento', 'Regularizado', 'Vencido'];

export default function PendenciasPage() {
  const { pendencias, setPendencias } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PendenciaDocumental['status'] | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<PendenciaDocumental | null>(null);
  const [viewItem, setViewItem] = useState<PendenciaDocumental | null>(null);
  const [form, setForm] = useState<Omit<PendenciaDocumental, 'id'>>({
    titulo: '',
    tipo: 'Factura em falta',
    descricao: '',
    entidadeRef: '',
    entidadeTipo: 'Requisicao',
    entidadeId: 0,
    prioridade: 'Média',
    responsavel: '',
    status: 'Pendente',
  });

  const filtered = pendencias.filter(p => {
    const matchSearch =
      p.titulo.toLowerCase().includes(search.toLowerCase()) ||
      p.entidadeRef.toLowerCase().includes(search.toLowerCase()) ||
      p.responsavel.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      titulo: '',
      tipo: 'Factura em falta',
      descricao: '',
      entidadeRef: '',
      entidadeTipo: 'Requisicao',
      entidadeId: 0,
      prioridade: 'Média',
      responsavel: '',
      status: 'Pendente',
    });
    setDialogOpen(true);
  };

  const openEdit = (p: PendenciaDocumental) => {
    setEditing(p);
    setForm({
      titulo: p.titulo,
      tipo: p.tipo,
      descricao: p.descricao,
      entidadeRef: p.entidadeRef,
      entidadeTipo: p.entidadeTipo,
      entidadeId: p.entidadeId,
      dataLimite: p.dataLimite,
      prioridade: p.prioridade,
      responsavel: p.responsavel,
      status: p.status,
      observacoes: p.observacoes,
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.titulo.trim()) return;
    if (editing) {
      setPendencias(prev => prev.map(p => (p.id === editing.id ? { ...editing, ...form } : p)));
    } else {
      const newId = Math.max(0, ...pendencias.map(x => x.id)) + 1;
      setPendencias(prev => [...prev, { id: newId, ...form }]);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const marcarRegularizado = (p: PendenciaDocumental) => {
    setPendencias(prev =>
      prev.map(x =>
        x.id === p.id
          ? { ...x, status: 'Regularizado' as const, resolvidoEm: new Date().toISOString().slice(0, 10) }
          : x
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Pendências Documentais</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova Pendência
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as PendenciaDocumental['status'] | 'todos')}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
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
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Título</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Referência</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data limite</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Prioridade</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsável</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{p.titulo}</td>
                <td className="py-3 px-5 text-muted-foreground">{p.tipo}</td>
                <td className="py-3 px-5 font-mono text-xs">{p.entidadeRef}</td>
                <td className="py-3 px-5 text-muted-foreground">{p.dataLimite ? formatDate(p.dataLimite) : '—'}</td>
                <td className="py-3 px-5">{p.prioridade}</td>
                <td className="py-3 px-5 text-muted-foreground">{p.responsavel}</td>
                <td className="py-3 px-5"><StatusBadge status={p.status} /></td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(p); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  {p.status !== 'Regularizado' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => marcarRegularizado(p)} title="Marcar como regularizado"><Check className="h-4 w-4" /></Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma pendência encontrada.</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar pendência' : 'Nova pendência'}</DialogTitle>
            <DialogDescription>Registo de pendência documental.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="ex: Factura REQ-2024-0002" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoPendencia }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v as PrioridadePendencia }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADE_OPTIONS.map(pr => (
                      <SelectItem key={pr} value={pr}>{pr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ref. entidade</Label>
                <Input value={form.entidadeRef} onChange={e => setForm(f => ({ ...f, entidadeRef: e.target.value }))} placeholder="ex: REQ-2024-0002" />
              </div>
              <div className="space-y-2">
                <Label>Tipo entidade</Label>
                <Select value={form.entidadeTipo} onValueChange={v => setForm(f => ({ ...f, entidadeTipo: v as PendenciaDocumental['entidadeTipo'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Requisicao">Requisicao</SelectItem>
                    <SelectItem value="Contrato">Contrato</SelectItem>
                    <SelectItem value="Processo">Processo</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data limite (opcional)</Label>
              <Input type="date" value={form.dataLimite ?? ''} onChange={e => setForm(f => ({ ...f, dataLimite: e.target.value || undefined }))} />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} />
            </div>
            {editing && (
              <>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as PendenciaDocumental['status'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes ?? ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value || undefined }))} rows={2} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.titulo.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewItem?.titulo}</DialogTitle>
            <DialogDescription>Detalhe da pendência</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Tipo:</span> {viewItem.tipo}</p>
              <p><span className="text-muted-foreground">Descrição:</span> {viewItem.descricao}</p>
              <p><span className="text-muted-foreground">Referência:</span> {viewItem.entidadeRef} ({viewItem.entidadeTipo})</p>
              <p><span className="text-muted-foreground">Data limite:</span> {viewItem.dataLimite ? formatDate(viewItem.dataLimite) : '—'}</p>
              <p><span className="text-muted-foreground">Prioridade:</span> {viewItem.prioridade}</p>
              <p><span className="text-muted-foreground">Responsável:</span> {viewItem.responsavel}</p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
              {viewItem.resolvidoEm && <p><span className="text-muted-foreground">Resolvido em:</span> {formatDate(viewItem.resolvidoEm)}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
