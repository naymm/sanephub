import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { useAuth } from '@/context/AuthContext';
import type { Declaracao, TipoDeclaracao, StatusDeclaracao } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate } from '@/utils/formatters';
import { gerarPdfDeclaracaoServico } from '@/utils/declaracaoServicoPdf';
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
import { Search, Plus, Pencil, Eye, Check, FileDown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const TIPO_OPTIONS: TipoDeclaracao[] = ['Para Banco', 'Embaixada', 'Rendimentos', 'Outro'];
const STATUS_OPTIONS: StatusDeclaracao[] = ['Pendente', 'Emitida', 'Entregue'];

export default function DeclaracoesPage() {
  const { user } = useAuth();
  const { declaracoes, addDeclaracao, updateDeclaracao, deleteDeclaracao, colaboradores } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusDeclaracao | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Declaracao | null>(null);
  const [viewItem, setViewItem] = useState<Declaracao | null>(null);
  const [form, setForm] = useState<Omit<Declaracao, 'id'>>({
    colaboradorId: 0,
    tipo: 'Para Banco',
    dataPedido: new Date().toISOString().slice(0, 10),
    status: 'Pendente',
  });

  const getColabName = (id: number) => colaboradores.find(c => c.id === id)?.nome ?? 'N/A';

  const handleImprimirPdf = async (d: Declaracao) => {
    if (d.status !== 'Emitida' && d.status !== 'Entregue') {
      toast.error('Só pode imprimir declarações emitidas ou entregues.');
      return;
    }
    const col = colaboradores.find(c => c.id === d.colaboradorId);
    if (!col) {
      toast.error('Dados do colaborador não encontrados.');
      return;
    }
    try {
      await gerarPdfDeclaracaoServico(d, col, {
        linha: user?.assinaturaLinha || user?.nome,
        cargo: user?.assinaturaCargo || user?.cargo,
        imagemUrl: user?.assinaturaImagemUrl,
      });
      toast.success('PDF da declaração gerado. Verifique os transferidos.');
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast.error('Não foi possível gerar o PDF.');
    }
  };

  const filtered = declaracoes.filter(d => {
    const matchSearch = getColabName(d.colaboradorId).toLowerCase().includes(search.toLowerCase()) || d.tipo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const openCreate = () => {
    setEditing(null);
    setForm({
      colaboradorId: colaboradores[0]?.id ?? 0,
      tipo: 'Para Banco',
      dataPedido: new Date().toISOString().slice(0, 10),
      status: 'Pendente',
    });
    setDialogOpen(true);
  };

  const openEdit = (d: Declaracao) => {
    setEditing(d);
    setForm({
      colaboradorId: d.colaboradorId,
      tipo: d.tipo,
      descricao: d.descricao,
      banco: d.banco,
      paisEmbaixada: d.paisEmbaixada,
      dataPedido: d.dataPedido,
      dataEmissao: d.dataEmissao,
      dataEntrega: d.dataEntrega,
      status: d.status,
      emitidoPor: d.emitidoPor,
      observacoes: d.observacoes,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.colaboradorId || !form.dataPedido) return;
    try {
      if (editing) await updateDeclaracao(editing.id, form);
      else await addDeclaracao(form);
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const marcarEmitida = async (d: Declaracao) => {
    const dataEmissao = new Date().toISOString().slice(0, 10);
    const emitidoPor = user?.nome;
    try {
      await updateDeclaracao(d.id, { status: 'Emitida', dataEmissao, emitidoPor });
      const emitida = { ...d, status: 'Emitida' as const, dataEmissao, emitidoPor };
      handleImprimirPdf(emitida);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao actualizar');
    }
  };

  const marcarEntregue = async (d: Declaracao) => {
    try {
      await updateDeclaracao(d.id, { status: 'Entregue', dataEntrega: new Date().toISOString().slice(0, 10) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao actualizar');
    }
  };

  const remove = async (d: Declaracao) => {
    if (!window.confirm('Remover esta declaração?')) return;
    try {
      await deleteDeclaracao(d.id);
      toast.success('Declaração removida.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Declarações</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova Declaração
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusDeclaracao | 'todos')}>
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
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Colaborador</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data pedido</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data emissão</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(d => (
              <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{getColabName(d.colaboradorId)}</td>
                <td className="py-3 px-5 text-muted-foreground">{d.tipo}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(d.dataPedido)}</td>
                <td className="py-3 px-5 text-muted-foreground">{d.dataEmissao ? formatDate(d.dataEmissao) : '—'}</td>
                <td className="py-3 px-5"><StatusBadge status={d.status} /></td>
                <td className="py-3 px-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhe" onClick={() => { setViewItem(d); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                    {(d.status === 'Emitida' || d.status === 'Entregue') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Imprimir PDF" onClick={() => handleImprimirPdf(d)}><FileDown className="h-4 w-4" /></Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(d)} title="Remover"><Trash2 className="h-4 w-4" /></Button>
                    {d.status === 'Pendente' && (
                      <Button variant="ghost" size="sm" onClick={() => marcarEmitida(d)}>Emitir</Button>
                    )}
                    {d.status === 'Emitida' && (
                      <Button variant="ghost" size="sm" onClick={() => marcarEntregue(d)}><Check className="h-4 w-4 mr-1" />Entregue</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma declaração encontrada.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar declaração' : 'Nova declaração'}</DialogTitle>
            <DialogDescription>Pedido de declaração para o colaborador.</DialogDescription>
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
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoDeclaracao }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={form.descricao ?? ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value || undefined }))} placeholder="ex: Crédito habitação" />
            </div>
            <div className="space-y-2">
              <Label>Data pedido</Label>
              <Input type="date" value={form.dataPedido} onChange={e => setForm(f => ({ ...f, dataPedido: e.target.value }))} />
            </div>
            {editing && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data emissão</Label>
                    <Input type="date" value={form.dataEmissao ?? ''} onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value || undefined }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data entrega</Label>
                    <Input type="date" value={form.dataEntrega ?? ''} onChange={e => setForm(f => ({ ...f, dataEntrega: e.target.value || undefined }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as StatusDeclaracao }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Emitido por</Label>
                  <Input value={form.emitidoPor ?? ''} onChange={e => setForm(f => ({ ...f, emitidoPor: e.target.value || undefined }))} />
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
            <Button onClick={save} disabled={!form.colaboradorId || !form.dataPedido}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Declaração — {viewItem && getColabName(viewItem.colaboradorId)}</DialogTitle>
            <DialogDescription>{viewItem?.tipo}</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Tipo:</span> {viewItem.tipo}</p>
                {viewItem.banco && <p><span className="text-muted-foreground">Banco:</span> {viewItem.banco}</p>}
                {viewItem.paisEmbaixada && <p><span className="text-muted-foreground">País (Embaixada):</span> {viewItem.paisEmbaixada}</p>}
                {viewItem.descricao && <p><span className="text-muted-foreground">Descrição:</span> {viewItem.descricao}</p>}
                <p><span className="text-muted-foreground">Data pedido:</span> {formatDate(viewItem.dataPedido)}</p>
                <p><span className="text-muted-foreground">Data emissão:</span> {viewItem.dataEmissao ? formatDate(viewItem.dataEmissao) : '—'}</p>
                <p><span className="text-muted-foreground">Data entrega:</span> {viewItem.dataEntrega ? formatDate(viewItem.dataEntrega) : '—'}</p>
                <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
                {viewItem.emitidoPor && <p><span className="text-muted-foreground">Emitido por:</span> {viewItem.emitidoPor}</p>}
              </div>
              {(viewItem.status === 'Emitida' || viewItem.status === 'Entregue') && (
                <Button onClick={() => { handleImprimirPdf(viewItem); setViewOpen(false); }} className="w-full sm:w-auto">
                  <FileDown className="h-4 w-4 mr-2" />
                  Imprimir PDF (Declaração de Serviço)
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
