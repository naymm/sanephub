import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useColaboradorId } from '@/hooks/useColaboradorId';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { ReciboSalario } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatKz } from '@/utils/formatters';
import { gerarPdfRecibo } from '@/utils/reciboPdf';
import { selecionarEscalaoIrtPorSalarioBase } from '@/lib/irtCalculo';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, FileDown } from 'lucide-react';
import { toast } from 'sonner';

const MESES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ANO_ACTUAL = new Date().getFullYear();

export default function PortalRecibosPage() {
  const colaboradorId = useColaboradorId();
  const { recibos, colaboradoresTodos, irtEscalaes } = useData();
  const [mesFilter, setMesFilter] = useState<string>('todos');
  const [anoFilter, setAnoFilter] = useState<string>('todos');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<ReciboSalario | null>(null);

  const colaborador = colaboradorId != null ? colaboradoresTodos.find(c => c.id === colaboradorId) ?? null : null;

  const handleGerarPdf = (r: ReciboSalario) => {
    if (!colaborador) {
      toast.error('Dados do colaborador não disponíveis.');
      return;
    }
    try {
      const esc = selecionarEscalaoIrtPorSalarioBase(r.vencimentoBase, irtEscalaes ?? []);
      const url = gerarPdfRecibo(r, colaborador, { irtTaxaPercent: esc?.taxaPercent ?? null });
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('PDF do recibo gerado.');
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast.error('Não foi possível gerar o PDF. Tente novamente.');
    }
  };

  const meusRecibos = colaboradorId == null
    ? []
    : recibos.filter(r => r.colaboradorId === colaboradorId);

  const filtered = meusRecibos.filter(r => {
    const matchMes = mesFilter === 'todos' || r.mesAno.slice(5) === mesFilter;
    const matchAno = !anoFilter || anoFilter === 'todos' || r.mesAno.startsWith(anoFilter);
    return matchMes && matchAno;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  if (colaboradorId == null) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Os Meus Recibos</h1>
        <p className="text-muted-foreground text-center py-12">Não tem um colaborador associado à sua conta. Contacte os Recursos Humanos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="page-header">Os Meus Recibos</h1>
      <p className="text-sm text-muted-foreground">Consulte os seus recibos de salário.</p>

      <div className="flex flex-wrap items-center gap-3">
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
          <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Ano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os anos</SelectItem>
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
            {pagination.slice.map(r => (
              <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{r.mesAno}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.vencimentoBase)}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.subsidioAlimentacao + r.subsidioTransporte + r.outrosSubsidios)}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.inss + r.irt + r.outrasDeducoes)}</td>
                <td className="py-3 px-5 text-right font-mono font-medium">{formatKz(r.liquido)}</td>
                <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                <td className="py-3 px-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhe" onClick={() => { setViewItem(r); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Gerar PDF" onClick={() => handleGerarPdf(r)}><FileDown className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum recibo encontrado.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recibo — {viewItem?.mesAno}</DialogTitle>
            <DialogDescription>Detalhe do seu recibo de vencimento</DialogDescription>
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
              {colaborador && (
                <Button onClick={() => { handleGerarPdf(viewItem); setViewOpen(false); }} className="w-full sm:w-auto">
                  <FileDown className="h-4 w-4 mr-2" />
                  Gerar PDF do recibo
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
