import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import type { Pagamento, StatusPagamento } from '@/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Eye } from 'lucide-react';

const METODO_OPTIONS: Pagamento['metodoPagamento'][] = ['Transferência', 'Cheque', 'Numerário', 'Outro'];

const STATUS_OPTIONS: { value: StatusPagamento | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Recebido', label: 'Recebido' },
  { value: 'Em conciliação', label: 'Em conciliação' },
  { value: 'Conciliado', label: 'Conciliado' },
  { value: 'Devolvido', label: 'Devolvido' },
];

export default function PagamentosPage() {
  const { user } = useAuth();
  const { pagamentos, addPagamento, requisicoes } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusPagamento | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Pagamento | null>(null);
  const [form, setForm] = useState<Omit<Pagamento, 'id'>>({
    requisicaoId: 0,
    referencia: '',
    beneficiario: '',
    valor: 0,
    dataPagamento: new Date().toISOString().slice(0, 10),
    metodoPagamento: 'Transferência',
    status: 'Recebido',
    registadoPor: user?.nome ?? '',
    registadoEm: new Date().toISOString().slice(0, 10),
  });

  const requisicoesPagaveis = requisicoes.filter(r => r.status === 'Aprovado' || r.status === 'Enviado à Contabilidade');

  const filtered = pagamentos.filter(p => {
    const req = requisicoes.find(r => r.id === p.requisicaoId);
    const matchSearch =
      p.referencia.toLowerCase().includes(search.toLowerCase()) ||
      p.beneficiario.toLowerCase().includes(search.toLowerCase()) ||
      (req?.num?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRecebido = filtered.reduce((s, p) => s + p.valor, 0);

  const getRequisicaoNum = (reqId: number) => requisicoes.find(r => r.id === reqId)?.num ?? `#${reqId}`;

  const openNew = () => {
    const req = requisicoesPagaveis[0];
    setForm({
      requisicaoId: req?.id ?? 0,
      referencia: `PAG-${new Date().getFullYear()}-${String(pagamentos.length + 1).padStart(4, '0')}`,
      beneficiario: req?.fornecedor ?? '',
      valor: req?.valor ?? 0,
      dataPagamento: new Date().toISOString().slice(0, 10),
      metodoPagamento: 'Transferência',
      status: 'Recebido',
      registadoPor: user?.nome ?? '',
      registadoEm: new Date().toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  };

  const savePagamento = async () => {
    if (!form.requisicaoId || !form.beneficiario.trim() || form.valor <= 0) return;
    try {
      await addPagamento(form);
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao registar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Pagamentos Recebidos</h1>
        <Button onClick={openNew} disabled={requisicoesPagaveis.length === 0} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Registar Pagamento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar (ref., beneficiário)..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusPagamento | 'todos')}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border/80 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total (filtrado)</p>
        <p className="text-xl font-semibold text-foreground">{formatKz(totalRecebido)}</p>
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Referência</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Requisição</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Beneficiário</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data Pagamento</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Método</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-mono text-xs">{p.referencia}</td>
                <td className="py-3 px-5">{getRequisicaoNum(p.requisicaoId)}</td>
                <td className="py-3 px-5 font-medium">{p.beneficiario}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(p.valor)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(p.dataPagamento)}</td>
                <td className="py-3 px-5 text-muted-foreground">{p.metodoPagamento}</td>
                <td className="py-3 px-5"><StatusBadge status={p.status} /></td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(p); setViewOpen(true); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum pagamento encontrado.</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registar pagamento</DialogTitle>
            <DialogDescription>Associe o pagamento a uma requisição aprovada.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Requisição</Label>
              <Select
                value={form.requisicaoId ? String(form.requisicaoId) : ''}
                onValueChange={v => {
                  const id = Number(v);
                  const req = requisicoes.find(r => r.id === id);
                  if (req) setForm(f => ({ ...f, requisicaoId: id, beneficiario: req.fornecedor, valor: req.valor }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar requisição" /></SelectTrigger>
                <SelectContent>
                  {requisicoesPagaveis.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.num} — {r.fornecedor} ({formatKz(r.valor)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referência</Label>
              <Input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Beneficiário</Label>
                <Input value={form.beneficiario} onChange={e => setForm(f => ({ ...f, beneficiario: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Valor (Kz)</Label>
                <Input type="number" min={0} value={form.valor || ''} onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data pagamento</Label>
                <Input type="date" value={form.dataPagamento} onChange={e => setForm(f => ({ ...f, dataPagamento: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Método</Label>
                <Select value={form.metodoPagamento} onValueChange={v => setForm(f => ({ ...f, metodoPagamento: v as Pagamento['metodoPagamento'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METODO_OPTIONS.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conta bancária (opcional)</Label>
              <Input value={form.contaBancaria ?? ''} onChange={e => setForm(f => ({ ...f, contaBancaria: e.target.value || undefined }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={savePagamento} disabled={!form.requisicaoId || !form.beneficiario.trim() || form.valor <= 0}>Registar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewItem?.referencia}</DialogTitle>
            <DialogDescription>Detalhe do pagamento</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Requisição:</span> {getRequisicaoNum(viewItem.requisicaoId)}</p>
              <p><span className="text-muted-foreground">Beneficiário:</span> {viewItem.beneficiario}</p>
              <p><span className="text-muted-foreground">Valor:</span> {formatKz(viewItem.valor)}</p>
              <p><span className="text-muted-foreground">Data pagamento:</span> {formatDate(viewItem.dataPagamento)}</p>
              <p><span className="text-muted-foreground">Método:</span> {viewItem.metodoPagamento}</p>
              {viewItem.contaBancaria && <p><span className="text-muted-foreground">Conta:</span> {viewItem.contaBancaria}</p>}
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
              <p><span className="text-muted-foreground">Registado por:</span> {viewItem.registadoPor} em {formatDate(viewItem.registadoEm)}</p>
              {viewItem.observacoes && <p><span className="text-muted-foreground">Observações:</span> {viewItem.observacoes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
