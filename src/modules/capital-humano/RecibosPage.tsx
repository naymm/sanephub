import { useState } from 'react';
import { useData } from '@/context/DataContext';
import type { ReciboSalario } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatKz } from '@/utils/formatters';
import { gerarPdfRecibo } from '@/utils/reciboPdf';
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
import { Search, Plus, Eye, FileDown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const MESES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ANO_ACTUAL = new Date().getFullYear();

export default function RecibosPage() {
  const { recibos, addRecibo, updateRecibo, deleteRecibo, colaboradores } = useData();
  const [search, setSearch] = useState('');
  const [mesFilter, setMesFilter] = useState<string>('todos');
  const [anoFilter, setAnoFilter] = useState<string>(String(ANO_ACTUAL));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<ReciboSalario | null>(null);
  const [form, setForm] = useState<Omit<ReciboSalario, 'id'>>({
    colaboradorId: 0,
    mesAno: `${ANO_ACTUAL}-11`,
    vencimentoBase: 0,
    subsidioAlimentacao: 25000,
    subsidioTransporte: 20000,
    outrosSubsidios: 0,
    inss: 0,
    irt: 0,
    outrasDeducoes: 0,
    liquido: 0,
    status: 'Emitido',
  });

  const getColabName = (id: number) => colaboradores.find(c => c.id === id)?.nome ?? 'N/A';

  const handleGerarPdf = (r: ReciboSalario) => {
    const col = colaboradores.find(c => c.id === r.colaboradorId);
    if (!col) {
      toast.error('Dados do colaborador não encontrados.');
      return;
    }
    try {
      gerarPdfRecibo(r, col);
      toast.success('Recibo em PDF gerado. Verifique os transferidos.');
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast.error('Não foi possível gerar o PDF. Tente novamente.');
    }
  };

  const filtered = recibos.filter(r => {
    const matchSearch = getColabName(r.colaboradorId).toLowerCase().includes(search.toLowerCase());
    const matchMes = mesFilter === 'todos' || r.mesAno.slice(5) === mesFilter;
    const matchAno = !anoFilter || anoFilter === 'todos' || r.mesAno.startsWith(anoFilter);
    return matchSearch && matchMes && matchAno;
  });

  const calcLiquido = (f: Omit<ReciboSalario, 'id'>) => {
    const bruto = f.vencimentoBase + f.subsidioAlimentacao + f.subsidioTransporte + f.outrosSubsidios;
    const deducoes = f.inss + f.irt + f.outrasDeducoes;
    return Math.max(0, bruto - deducoes);
  };

  const openCreate = () => {
    const colab = colaboradores.find(c => c.status === 'Activo') ?? colaboradores[0];
    const base = colab?.salarioBase ?? 0;
    const mesAno = `${anoFilter && anoFilter !== 'todos' ? anoFilter : ANO_ACTUAL}-${mesFilter && mesFilter !== 'todos' ? mesFilter : '01'}`;
    setForm({
      colaboradorId: colab?.id ?? 0,
      mesAno,
      vencimentoBase: base,
      subsidioAlimentacao: 25000,
      subsidioTransporte: 20000,
      outrosSubsidios: 0,
      inss: 0,
      irt: 0,
      outrasDeducoes: 0,
      liquido: base + 25000 + 20000,
      status: 'Emitido',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.colaboradorId || !form.mesAno || form.vencimentoBase <= 0) return;
    const existente = recibos.find(r => r.colaboradorId === form.colaboradorId && r.mesAno === form.mesAno);
    if (existente) {
      toast.error('Já existe um recibo para este colaborador no mês/ano seleccionado.');
      return;
    }
    const liquido = calcLiquido(form);
    try {
      await addRecibo({ ...form, liquido });
      setDialogOpen(false);
      toast.success('Recibo emitido com sucesso.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao emitir');
    }
  };

  const marcarPago = async (r: ReciboSalario) => {
    try {
      await updateRecibo(r.id, { status: 'Pago' });
      toast.success('Recibo marcado como pago.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao actualizar');
    }
  };

  const remove = async (r: ReciboSalario) => {
    if (!window.confirm(`Remover o recibo de ${getColabName(r.colaboradorId)} (${r.mesAno})?`)) return;
    try {
      await deleteRecibo(r.id);
      toast.success('Recibo removido.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Recibos de Salário</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Emitir Recibo
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar colaborador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {MESES.map((m, i) => (
              <SelectItem key={m} value={m}>{MES_LABELS[i]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={anoFilter} onValueChange={setAnoFilter}>
          <SelectTrigger className="w-[100px] h-9"><SelectValue placeholder="Ano" /></SelectTrigger>
          <SelectContent>
            {[ANO_ACTUAL, ANO_ACTUAL - 1, ANO_ACTUAL - 2].map(a => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Colaborador</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Mês/Ano</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vencimento Base</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Subsídios</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Deduções</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Líquido</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{getColabName(r.colaboradorId)}</td>
                <td className="py-3 px-5 text-muted-foreground">{r.mesAno}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.vencimentoBase)}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.subsidioAlimentacao + r.subsidioTransporte + r.outrosSubsidios)}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.inss + r.irt + r.outrasDeducoes)}</td>
                <td className="py-3 px-5 text-right font-mono font-medium">{formatKz(r.liquido)}</td>
                <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                <td className="py-3 px-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhe" onClick={() => { setViewItem(r); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Gerar PDF" onClick={() => handleGerarPdf(r)}><FileDown className="h-4 w-4" /></Button>
                    {r.status === 'Emitido' && (
                      <Button variant="ghost" size="sm" onClick={() => marcarPago(r)}>Marcar Pago</Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(r)} title="Remover"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum recibo encontrado.</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Emitir recibo</DialogTitle>
            <DialogDescription>Dados do recibo de vencimento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select
                value={form.colaboradorId ? String(form.colaboradorId) : ''}
                onValueChange={v => {
                  const c = colaboradores.find(x => x.id === Number(v));
                  if (c) {
                    const novo = { ...form, colaboradorId: c.id, vencimentoBase: c.salarioBase };
                    setForm({ ...novo, liquido: calcLiquido(novo) });
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {colaboradores.filter(c => c.status === 'Activo').map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome} — {formatKz(c.salarioBase)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês/Ano</Label>
              <div className="flex gap-2">
                <Select value={form.mesAno?.slice(0, 4)} onValueChange={y => setForm(f => ({ ...f, mesAno: `${y}-${form.mesAno?.slice(5) || '01'}` }))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[ANO_ACTUAL, ANO_ACTUAL - 1].map(a => (
                      <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={form.mesAno?.slice(5) || '01'} onValueChange={m => setForm(f => ({ ...f, mesAno: `${f.mesAno?.slice(0, 4) || ANO_ACTUAL}-${m}` }))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={m} value={m}>{MES_LABELS[i]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Vencimento base (Kz)</Label>
              <Input type="number" min={0} value={form.vencimentoBase || ''} onChange={e => { const v = Number(e.target.value) || 0; setForm(prev => ({ ...prev, vencimentoBase: v, liquido: calcLiquido({ ...prev, vencimentoBase: v }) })); }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subs. alimentação</Label>
                <Input type="number" min={0} value={form.subsidioAlimentacao || ''} onChange={e => { const v = Number(e.target.value) || 0; setForm(prev => ({ ...prev, subsidioAlimentacao: v, liquido: calcLiquido({ ...prev, subsidioAlimentacao: v }) })); }} />
              </div>
              <div className="space-y-2">
                <Label>Subs. transporte</Label>
                <Input type="number" min={0} value={form.subsidioTransporte || ''} onChange={e => { const v = Number(e.target.value) || 0; setForm(prev => ({ ...prev, subsidioTransporte: v, liquido: calcLiquido({ ...prev, subsidioTransporte: v }) })); }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>INSS</Label>
                <Input type="number" min={0} value={form.inss || ''} onChange={e => { const v = Number(e.target.value) || 0; setForm(prev => ({ ...prev, inss: v, liquido: calcLiquido({ ...prev, inss: v }) })); }} />
              </div>
              <div className="space-y-2">
                <Label>IRT</Label>
                <Input type="number" min={0} value={form.irt || ''} onChange={e => { const v = Number(e.target.value) || 0; setForm(prev => ({ ...prev, irt: v, liquido: calcLiquido({ ...prev, irt: v }) })); }} />
              </div>
              <div className="space-y-2">
                <Label>Outras ded.</Label>
                <Input type="number" min={0} value={form.outrasDeducoes || ''} onChange={e => { const v = Number(e.target.value) || 0; setForm(prev => ({ ...prev, outrasDeducoes: v, liquido: calcLiquido({ ...prev, outrasDeducoes: v }) })); }} />
              </div>
            </div>
            <p className="text-sm font-medium">Líquido: {formatKz(form.liquido)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.colaboradorId || !form.mesAno || form.vencimentoBase <= 0}>Emitir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recibo — {viewItem && getColabName(viewItem.colaboradorId)}</DialogTitle>
            <DialogDescription>{viewItem?.mesAno}</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Vencimento base:</span> {formatKz(viewItem.vencimentoBase)}</p>
                <p><span className="text-muted-foreground">Subs. alimentação:</span> {formatKz(viewItem.subsidioAlimentacao)}</p>
                <p><span className="text-muted-foreground">Subs. transporte:</span> {formatKz(viewItem.subsidioTransporte)}</p>
                <p><span className="text-muted-foreground">Outros subsídios:</span> {formatKz(viewItem.outrosSubsidios)}</p>
                <p><span className="text-muted-foreground">INSS:</span> {formatKz(viewItem.inss)}</p>
                <p><span className="text-muted-foreground">IRT:</span> {formatKz(viewItem.irt)}</p>
                <p><span className="text-muted-foreground">Outras deduções:</span> {formatKz(viewItem.outrasDeducoes)}</p>
                <p className="font-semibold pt-2 border-t"><span className="text-muted-foreground">Líquido:</span> {formatKz(viewItem.liquido)}</p>
                <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
              </div>
              <Button onClick={() => { handleGerarPdf(viewItem); setViewOpen(false); }} className="w-full sm:w-auto">
                <FileDown className="h-4 w-4 mr-2" />
                Gerar PDF do recibo
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
